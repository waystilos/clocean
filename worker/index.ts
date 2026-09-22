import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  Env,
  WorkspaceTree,
  TreeNode,
  DocContent,
  TaskItem,
  TasksData,
  PhotosData,
  ActivitiesData,
  DocComment,
  DocCommentsData,
  MentionNotification,
  UserNotificationsData,
  DocRevision,
  DocRevisionsData,
  WorkspaceFavoritesData,
} from "./types.ts";
import { R2Database } from "./storage/r2Db.ts";
import { getAuthEmail, requireAuth } from "./auth/cfAccess.ts";
import { DocSessionDO } from "./durable_objects/DocSessionDO.ts";
import { extractMentions, dispatchMentionNotification } from "./notifications/emailNotifier.ts";
import { z } from "zod";
import {
  CreateWorkspaceSchema,
  InviteMemberSchema,
  UpdateMemberRoleSchema,
  SaveDocSchema,
  ShareDocSchema,
  TaskItemSchema,
  AddCommentSchema,
  MentionNotificationPayloadSchema,
  UpdateUserProfileSchema,
  CreateTreeNodeSchema,
  UpdateTreeNodeSchema,
  ToggleFavoriteSchema,
} from "./schemas.ts";

export { DocSessionDO };

// Security Utility: Sanitize filename to prevent R2 path traversal and header injection
export function sanitizeFilename(filename: string): string {
  const basename = filename.replace(/\\/g, "/").split("/").pop() || "unnamed_file";
  const sanitized = basename
    .replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, "_")
    .replace(/\.\.+/g, ".")
    .replace(/["'\r\n]/g, "")
    .trim();
  return sanitized || "unnamed_file";
}

// Security Utility: Enforce safe identifier format for IDs and document slugs
export function isValidId(id: string): boolean {
  return typeof id === "string" && /^[a-zA-Z0-9_\-\.]+$/.test(id) && !id.includes("..");
}

// Security Utility: Validate Origin header during WebSocket handshake to prevent CSWSH
export function isAllowedOrigin(originHeader: string | null | undefined, requestUrl: string, env?: Env): boolean {
  if (!originHeader) return true; // Direct non-browser requests or same-site
  try {
    const reqHost = new URL(requestUrl).host;
    const originUrl = new URL(originHeader);

    // Match exact host or loopback development
    if (originUrl.host === reqHost) return true;
    if (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1") return true;

    // Check configured allowed origins
    if (env?.ALLOWED_ORIGINS) {
      const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
      if (allowed.includes(originHeader) || allowed.includes(originUrl.origin)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Safe extensions allowed for inline rendering (all other formats forced to attachment)
const SAFE_INLINE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".txt"];
const ALLOWED_AVATAR_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const app = new Hono<{ Bindings: Env }>();

// Hardened CORS: dynamically validate origin and allow credentials
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return "*";
      if (isAllowedOrigin(origin, c.req.url, c.env)) return origin;
      return null;
    },
    allowHeaders: ["Content-Type", "Authorization", "x-user-email", "x-workspace-id", "Range", "If-Match"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Helper: Extract active workspace ID from header or query (defaulting to "default")
export function getWorkspaceId(c: any): string {
  const headerWs = c.req.header("x-workspace-id");
  const queryWs = c.req.query("ws");
  const ws = headerWs || queryWs || "default";
  return isValidId(ws) ? ws : "default";
}

// Middleware: Auto-seed R2 database on first run and enforce auth in production
app.use("/api/*", async (c, next) => {
  // Public document viewing endpoints are accessible without Zero Trust auth
  if (c.req.path.startsWith("/api/public/")) {
    return next();
  }

  // Enforce Cloudflare Zero Trust authentication in production
  const authRes = requireAuth(c.req.raw, c.env);
  if (authRes instanceof Response) {
    return authRes;
  }

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  await db.ensureSeeded();
  await next();
});

// Auth & Real User Profile Endpoints (Backed by R2)
app.get("/api/me", async (c) => {
  const email = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfile(email);
  return c.json(profile);
});

app.put("/api/user/profile", async (c) => {
  const email = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const json = await c.req.json().catch(() => null);
  const parsed = UpdateUserProfileSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid profile payload", details: parsed.error.issues }, 400);
  }

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfile(email);
  if (parsed.data.name !== undefined) profile.name = parsed.data.name;
  if (parsed.data.bio !== undefined) profile.bio = parsed.data.bio;
  profile.updatedAt = new Date().toISOString();
  await db.putUserProfile(profile);
  return c.json(profile);
});

app.post("/api/user/avatar", async (c) => {
  const email = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const body = await c.req.parseBody();
  const file = body["avatar"] as File | undefined;
  if (!file) return c.json({ error: "No avatar image provided" }, 400);

  // Validate avatar file size (max 5 MB)
  if (file.size > MAX_AVATAR_SIZE) {
    return c.json({ error: "Avatar file exceeds maximum 5MB limit" }, 413);
  }

  // Validate avatar MIME type
  if (file.type && !ALLOWED_AVATAR_MIMES.includes(file.type)) {
    return c.json({ error: "Invalid image format. Allowed: PNG, JPEG, WEBP, GIF" }, 400);
  }

  const avatarKey = `workspaces/default/avatars/${encodeURIComponent(email)}.png`;
  await c.env.CLOCEAN_STORAGE.put(avatarKey, file.stream(), {
    httpMetadata: { contentType: file.type || "image/png" },
  });

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfile(email);
  profile.avatar = `/api/user/avatar/${encodeURIComponent(email)}?t=${Date.now()}`;
  profile.updatedAt = new Date().toISOString();
  await db.putUserProfile(profile);

  return c.json(profile);
});

app.get("/api/user/avatar/:email", async (c) => {
  const email = c.req.param("email");
  const avatarKey = `workspaces/default/avatars/${encodeURIComponent(email)}.png`;
  const object = await c.env.CLOCEAN_STORAGE.get(avatarKey);
  if (!object) {
    return c.redirect(
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`
    );
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("X-Content-Type-Options", "nosniff");
  const hasBody = "body" in object && object.body;
  return new Response(hasBody ? object.body : null, { headers, status: hasBody ? 200 : 304 });
});

// --- Organization & Team Workspace Endpoints ---
app.get("/api/workspaces", async (c) => {
  const email = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const workspaces = await db.getUserWorkspaces(email);
  return c.json(workspaces);
});

app.post("/api/workspaces", async (c) => {
  const email = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const json = await c.req.json().catch(() => null);
  const parsed = CreateWorkspaceSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "Workspace name is required" }, 400);
  }
  const body = parsed.data;
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfile(email);
  const meta = await db.createWorkspace(
    body.name,
    body.icon || "layers",
    email,
    profile.name
  );
  return c.json({ ...meta, role: "owner" }, 201);
});

app.get("/api/workspaces/:wsId/members", async (c) => {
  const wsId = c.req.param("wsId");
  if (!isValidId(wsId)) return c.json({ error: "Invalid workspace ID" }, 400);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const members = await db.getWorkspaceMembers(wsId);
  return c.json(members);
});

app.post("/api/workspaces/:wsId/members", async (c) => {
  const wsId = c.req.param("wsId");
  if (!isValidId(wsId)) return c.json({ error: "Invalid workspace ID" }, 400);
  const requesterEmail = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const currentMembers = await db.getWorkspaceMembers(wsId);
  const requester = currentMembers.find(
    (m) => m.email.toLowerCase() === requesterEmail.toLowerCase()
  );

  if (requester && requester.role !== "owner" && requester.role !== "admin") {
    return c.json({ error: "Only workspace owners and admins can invite members" }, 403);
  }
  if (!requester && wsId !== "default") {
    return c.json({ error: "Only workspace owners and admins can invite members" }, 403);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = InviteMemberSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "Valid email is required" }, 400);
  }
  const body = parsed.data;

  await db.addWorkspaceMember(
    wsId,
    body.email,
    body.name || body.email.split("@")[0],
    body.role || "member"
  );

  const wsMeta = await db.getWorkspaceMetadata(wsId);
  const senderProfile = await db.getUserProfile(requesterEmail);
  const memberSender = currentMembers.find(
    (m) => m.email.toLowerCase() === requesterEmail.toLowerCase()
  );
  const senderName = memberSender?.name || senderProfile.name;
  const senderAvatar = memberSender?.avatar || senderProfile.avatar;

  // Dispatch rich invitation email to invitee
  const inviteNotification: MentionNotification = {
    id: `invite-${crypto.randomUUID()}`,
    workspaceId: wsId,
    workspaceName: wsMeta?.name || "Clocean Workspace",
    type: "invite",
    inviteRole: body.role || "member",
    sender: {
      name: senderName,
      email: requesterEmail,
      avatar: senderAvatar,
    },
    recipientEmail: body.email.trim(),
    recipientName: body.name || body.email.split("@")[0],
    contextSnippet: `You have been invited by ${senderName} to collaborate in ${
      wsMeta?.name || "Clocean Workspace"
    } as ${body.role === "admin" ? "an Admin" : "a Member"}.`,
    timestamp: "Just now",
    emailStatus: "delivered",
    read: false,
  };
  await dispatchMentionNotification(c.env, db, inviteNotification, new URL(c.req.url).origin);

  await db.appendActivity(wsId, {
    title: `${senderName} invited ${body.email.trim()} as ${body.role || "member"}`,
    type: "doc",
    user: senderName,
  });

  const updated = await db.getWorkspaceMembers(wsId);
  return c.json(updated);
});

app.put("/api/workspaces/:wsId/members/:email/role", async (c) => {
  const wsId = c.req.param("wsId");
  if (!isValidId(wsId)) return c.json({ error: "Invalid workspace ID" }, 400);

  const targetEmail = decodeURIComponent(c.req.param("email")).trim();
  if (!targetEmail || !targetEmail.includes("@")) {
    return c.json({ error: "Invalid target email" }, 400);
  }

  const requesterEmail = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const currentMembers = await db.getWorkspaceMembers(wsId);
  const requester = currentMembers.find(
    (m) => m.email.toLowerCase() === requesterEmail.toLowerCase()
  );

  // Must be owner or admin to change roles
  if (requester && requester.role !== "owner" && requester.role !== "admin") {
    return c.json({ error: "Only workspace owners and admins can update member roles" }, 403);
  }
  if (!requester && wsId !== "default") {
    return c.json({ error: "Only workspace owners and admins can update member roles" }, 403);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = UpdateMemberRoleSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Role must be 'admin' or 'member'" }, 400);
  }
  const body = parsed.data;

  const result = await db.updateWorkspaceMemberRole(wsId, targetEmail, body.role);
  if (!result.success) {
    return c.json({ error: result.error || "Failed to update member role" }, 400);
  }

  return c.json(result.members);
});

// Workspace Tree Endpoints
app.get("/api/tree", async (c) => {
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  return c.json(data || { workspaceId: ws, nodes: [], updatedAt: new Date().toISOString() });
});

app.post("/api/tree/node", async (c) => {
  const ws = getWorkspaceId(c);
  const json = await c.req.json().catch(() => null);
  const parsed = CreateTreeNodeSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid tree node payload", details: parsed.error.issues }, 400);
  }

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data, etag } = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  if (!data) return c.json({ error: "Tree not found" }, 404);

  const body = parsed.data;
  const newNode: TreeNode = {
    id: body.id && isValidId(body.id) ? body.id : `node-${crypto.randomUUID()}`,
    name: sanitizeFilename(body.name),
    type: body.type,
    parentId: body.parentId || null,
    size: body.size || 0,
    mimeType: body.mimeType,
    updatedAt: "Just now",
    createdAt: new Date().toISOString(),
    tags: body.tags || [],
  };

  data.nodes.unshift(newNode);
  data.updatedAt = new Date().toISOString();

  // If creating a doc, also initialize its content.json in R2
  if (newNode.type === "doc") {
    const docData: DocContent = {
      id: newNode.id,
      title: newNode.name,
      tags: newNode.tags || [],
      content: "",
      updatedAt: new Date().toISOString(),
      attachments: [],
    };
    await db.putJson(`workspaces/${ws}/docs/${newNode.id}/content.json`, docData);
  }

  await db.putJson(`workspaces/${ws}/tree.json`, data, etag || undefined);
  return c.json(newNode);
});

app.put("/api/tree/node/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid node ID parameter" }, 400);
  const ws = getWorkspaceId(c);

  const json = await c.req.json().catch(() => null);
  const parsed = UpdateTreeNodeSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid tree node update payload", details: parsed.error.issues }, 400);
  }

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data, etag } = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  if (!data) return c.json({ error: "Tree not found" }, 404);

  const node = data.nodes.find((n) => n.id === id);
  if (!node) return c.json({ error: "Node not found" }, 404);

  const body = parsed.data;
  if (body.name) node.name = sanitizeFilename(body.name);
  if (body.parentId !== undefined) node.parentId = body.parentId;
  if (body.tags) node.tags = body.tags;
  node.updatedAt = "Just now";

  await db.putJson(`workspaces/${ws}/tree.json`, data, etag || undefined);
  return c.json(node);
});

app.delete("/api/tree/node/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid node ID parameter" }, 400);
  const ws = getWorkspaceId(c);

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data, etag } = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  if (!data) return c.json({ error: "Tree not found" }, 404);

  data.nodes = data.nodes.filter((n) => n.id !== id);
  data.updatedAt = new Date().toISOString();

  await db.putJson(`workspaces/${ws}/tree.json`, data, etag || undefined);
  return c.json({ success: true, deletedId: id });
});

// Document Content Endpoints
app.get("/api/docs/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid document ID parameter" }, 400);
  const ws = getWorkspaceId(c);

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<DocContent>(`workspaces/${ws}/docs/${id}/content.json`);
  if (!data) {
    // If not found, return empty template
    return c.json({
      id,
      title: "Untitled Document",
      tags: [],
      content: "",
      updatedAt: new Date().toISOString(),
      attachments: [],
    });
  }
  return c.json(data);
});

app.put("/api/docs/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid document ID parameter" }, 400);
  const ws = getWorkspaceId(c);
  const json = await c.req.json().catch(() => null);
  const parsed = SaveDocSchema.partial().safeParse(json);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "Invalid document payload" }, 400);
  }
  const body = parsed.data;
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const existing = (await db.getJson<DocContent>(`workspaces/${ws}/docs/${id}/content.json`)).data;

  const rawTitle = body.title ?? existing?.title ?? "Untitled";
  const safeTitle = sanitizeFilename(rawTitle).slice(0, 200);

  const updatedDoc: DocContent = {
    id,
    title: safeTitle,
    tags: body.tags ?? existing?.tags ?? [],
    content: (body.content ?? existing?.content ?? "").slice(0, 5 * 1024 * 1024), // Max 5 MB markdown
    updatedAt: new Date().toISOString(),
    attachments: body.attachments ?? existing?.attachments ?? [],
    icon: body.icon ?? existing?.icon,
    cover: body.cover ?? existing?.cover,
    isPublic: body.isPublic ?? existing?.isPublic,
    publicToken: body.publicToken ?? existing?.publicToken,
  };

  await db.putJson(`workspaces/${ws}/docs/${id}/content.json`, updatedDoc);

  // Sync title & icon in tree
  const treeRes = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  if (treeRes.data) {
    const node = treeRes.data.nodes.find((n) => n.id === id);
    if (node) {
      let treeChanged = false;
      if (node.name !== updatedDoc.title) {
        node.name = updatedDoc.title;
        treeChanged = true;
      }
      if (updatedDoc.icon && node.icon !== updatedDoc.icon) {
        node.icon = updatedDoc.icon;
        treeChanged = true;
      }
      if (treeChanged) {
        node.updatedAt = "Just now";
        await db.putJson(`workspaces/${ws}/tree.json`, treeRes.data);
      }
    }
  }

  // Save revision snapshot if content changed and non-empty
  if (body.content !== undefined && body.content !== existing?.content && updatedDoc.content.trim().length > 0) {
    const senderEmail = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
    const senderProfile = await db.getUserProfile(senderEmail);
    const revId = `rev-${Date.now()}`;
    const newRev: DocRevision = {
      id: revId,
      timestamp: new Date().toISOString(),
      title: safeTitle,
      author: {
        name: senderProfile.name,
        email: senderEmail,
        avatar: senderProfile.avatar,
      },
      snippet: updatedDoc.content.slice(0, 120).trim(),
      content: updatedDoc.content,
    };
    await db.putJson(`workspaces/${ws}/docs/${id}/revisions/${revId}.json`, newRev);
    const revListRes = await db.getJson<DocRevisionsData>(`workspaces/${ws}/docs/${id}/revisions.json`);
    const revList = revListRes.data || { docId: id, revisions: [] };
    revList.revisions = [newRev, ...revList.revisions].slice(0, 25);
    await db.putJson(`workspaces/${ws}/docs/${id}/revisions.json`, revList);
  }

  // Detect @ mentions in document content and dispatch email notifications to mentioned teammates
  if (body.content) {
    const senderEmail = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
    const members = await db.getWorkspaceMembers(ws);
    const newMentions = extractMentions(body.content, members, senderEmail);
    const existingMentions = existing?.content ? extractMentions(existing.content, members, senderEmail) : [];
    const existingEmails = new Set(existingMentions.map((m) => m.email.toLowerCase()));

    const newlyMentioned = newMentions.filter((m) => !existingEmails.has(m.email.toLowerCase()));
    if (newlyMentioned.length > 0) {
      const wsMeta = await db.getWorkspaceMetadata(ws);
      const senderProfile = await db.getUserProfile(senderEmail);
      for (const member of newlyMentioned) {
        const notif: MentionNotification = {
          id: `notif-${crypto.randomUUID()}`,
          workspaceId: ws,
          workspaceName: wsMeta?.name || "Clocean Main",
          documentId: id,
          documentTitle: safeTitle,
          sender: {
            name: senderProfile.name,
            email: senderEmail,
            avatar: senderProfile.avatar,
          },
          recipientEmail: member.email,
          recipientName: member.name,
          contextSnippet: body.content.slice(0, 160).trim(),
          timestamp: "Just now",
          emailStatus: "delivered",
          read: false,
        };
        await dispatchMentionNotification(c.env, db, notif, new URL(c.req.url).origin);
        await db.appendActivity(ws, {
          title: `${senderProfile.name} mentioned @${member.name} in "${safeTitle}"`,
          type: "doc",
          user: senderProfile.name,
        });
      }
    }
  }

  return c.json(updatedDoc);
});

// Document Revisions Endpoints
app.get("/api/docs/:id/revisions", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid document ID parameter" }, 400);
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const res = await db.getJson<DocRevisionsData>(`workspaces/${ws}/docs/${id}/revisions.json`);
  return c.json(res.data?.revisions || []);
});

app.post("/api/docs/:id/revisions/:revId/restore", async (c) => {
  const id = c.req.param("id");
  const revId = c.req.param("revId");
  if (!isValidId(id) || !isValidId(revId)) return c.json({ error: "Invalid ID parameter" }, 400);
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const revRes = await db.getJson<DocRevision>(`workspaces/${ws}/docs/${id}/revisions/${revId}.json`);
  if (!revRes.data) return c.json({ error: "Revision not found" }, 404);

  const docRes = await db.getJson<DocContent>(`workspaces/${ws}/docs/${id}/content.json`);
  const doc = docRes.data || {
    id,
    title: revRes.data.title,
    tags: [],
    content: revRes.data.content,
    updatedAt: new Date().toISOString(),
    attachments: [],
  };
  doc.content = revRes.data.content;
  doc.title = revRes.data.title;
  doc.updatedAt = new Date().toISOString();
  await db.putJson(`workspaces/${ws}/docs/${id}/content.json`, doc);
  return c.json(doc);
});

// Document Public Sharing Endpoints
app.post("/api/docs/:id/share", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid document ID parameter" }, 400);
  const ws = getWorkspaceId(c);
  const json = await c.req.json().catch(() => null);
  const parsed = ShareDocSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "isPublic boolean is required" }, 400);
  }
  const body = parsed.data;
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const docRes = await db.getJson<DocContent>(`workspaces/${ws}/docs/${id}/content.json`);
  if (!docRes.data) return c.json({ error: "Document not found" }, 404);

  const doc = docRes.data;
  doc.isPublic = !!body.isPublic;
  if (doc.isPublic && !doc.publicToken) {
    doc.publicToken = `pub-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  await db.putJson(`workspaces/${ws}/docs/${id}/content.json`, doc);

  if (doc.isPublic && doc.publicToken) {
    await db.putJson(`public/shares/${doc.publicToken}.json`, {
      workspaceId: ws,
      docId: id,
    });
  }
  return c.json({ isPublic: doc.isPublic, publicToken: doc.publicToken });
});

// Public Read-Only Endpoint (Exempt from Auth)
app.get("/api/public/docs/:token", async (c) => {
  const token = c.req.param("token");
  if (!isValidId(token)) return c.json({ error: "Invalid share token" }, 400);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const lookup = await db.getJson<{ workspaceId: string; docId: string }>(`public/shares/${token}.json`);
  if (!lookup.data) return c.json({ error: "Public document not found or revoked" }, 404);

  const { workspaceId, docId } = lookup.data;
  const docRes = await db.getJson<DocContent>(`workspaces/${workspaceId}/docs/${docId}/content.json`);
  if (!docRes.data || !docRes.data.isPublic || docRes.data.publicToken !== token) {
    return c.json({ error: "Public document not found or sharing disabled" }, 404);
  }

  // Return strictly public metadata: zero leakage of internal ids, members, or comments
  return c.json({
    id: docRes.data.id,
    title: docRes.data.title,
    content: docRes.data.content,
    tags: docRes.data.tags || [],
    icon: docRes.data.icon,
    cover: docRes.data.cover,
    updatedAt: docRes.data.updatedAt,
  });
});

// Workspace Favorites Endpoints
app.get("/api/workspaces/:ws/favorites", async (c) => {
  const ws = c.req.param("ws") || getWorkspaceId(c);
  if (!isValidId(ws)) return c.json({ error: "Invalid workspace ID" }, 400);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const res = await db.getJson<WorkspaceFavoritesData>(`workspaces/${ws}/favorites.json`);
  return c.json(res.data?.docIds || []);
});

app.post("/api/workspaces/:ws/favorites", async (c) => {
  const ws = c.req.param("ws") || getWorkspaceId(c);
  if (!isValidId(ws)) return c.json({ error: "Invalid workspace ID" }, 400);

  const json = await c.req.json().catch(() => null);
  const parsed = ToggleFavoriteSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid favorites payload", details: parsed.error.issues }, 400);
  }
  if (!isValidId(parsed.data.docId)) return c.json({ error: "Invalid doc ID" }, 400);

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const res = await db.getJson<WorkspaceFavoritesData>(`workspaces/${ws}/favorites.json`);
  const favs = res.data || { workspaceId: ws, docIds: [] };
  if (favs.docIds.includes(parsed.data.docId)) {
    favs.docIds = favs.docIds.filter((id) => id !== parsed.data.docId);
  } else {
    favs.docIds.push(parsed.data.docId);
  }
  await db.putJson(`workspaces/${ws}/favorites.json`, favs);
  return c.json(favs.docIds);
});

// Document Comments & Discussions Endpoints
app.get("/api/docs/:id/comments", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid document ID parameter" }, 400);
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const res = await db.getJson<DocCommentsData>(`workspaces/${ws}/docs/${id}/comments.json`);
  return c.json(res.data?.comments || []);
});

app.post("/api/docs/:id/comments", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid document ID parameter" }, 400);
  const ws = getWorkspaceId(c);
  const senderEmail = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";

  const json = await c.req.json().catch(() => null);
  const parsed = AddCommentSchema.extend({ documentTitle: z.string().optional() }).safeParse(json);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "Comment text is required" }, 400);
  }
  const body = parsed.data;

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const senderProfile = await db.getUserProfile(senderEmail);
  const members = await db.getWorkspaceMembers(ws);
  const memberSender = members.find((m) => m.email.toLowerCase() === senderEmail.toLowerCase());
  const senderName = memberSender?.name || senderProfile.name;
  const senderAvatar = memberSender?.avatar || senderProfile.avatar;
  const wsMeta = await db.getWorkspaceMetadata(ws);
  const docRes = await db.getJson<DocContent>(`workspaces/${ws}/docs/${id}/content.json`);
  const docTitle = body.documentTitle || docRes.data?.title || "Document";

  const mentioned = extractMentions(body.text, members, senderEmail);
  const comment: DocComment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    docId: id,
    user: {
      name: senderName,
      email: senderEmail,
      avatar: senderAvatar,
    },
    text: body.text.trim(),
    mentions: mentioned.map((m) => m.email),
    createdAt: new Date().toISOString(),
  };

  const commentsKey = `workspaces/${ws}/docs/${id}/comments.json`;
  const existingComments = await db.getJson<DocCommentsData>(commentsKey);
  const list = existingComments.data?.comments || [];
  list.push(comment);
  await db.putJson(commentsKey, { docId: id, comments: list });

  // Dispatch email notifications to all mentioned teammates
  for (const member of mentioned) {
    const notif: MentionNotification = {
      id: `notif-${crypto.randomUUID()}`,
      workspaceId: ws,
      workspaceName: wsMeta?.name || "Clocean Main",
      documentId: id,
      documentTitle: docTitle,
      sender: {
        name: senderName,
        email: senderEmail,
        avatar: senderAvatar,
      },
      recipientEmail: member.email,
      recipientName: member.name,
      contextSnippet: body.text.trim(),
      timestamp: "Just now",
      emailStatus: "delivered",
      read: false,
    };
    await dispatchMentionNotification(c.env, db, notif, new URL(c.req.url).origin);
  }

  await db.appendActivity(ws, {
    title: `${senderProfile.name} commented on "${docTitle}"`,
    type: "doc",
    user: senderProfile.name,
  });

  return c.json(comment, 201);
});

// Notifications Endpoints
app.get("/api/notifications", async (c) => {
  const email = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const key = `workspaces/registry/users/${encodeURIComponent(email)}/notifications.json`;
  const res = await db.getJson<UserNotificationsData>(key);
  return c.json(res.data?.notifications || []);
});

app.put("/api/notifications/read", async (c) => {
  const email = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const key = `workspaces/registry/users/${encodeURIComponent(email)}/notifications.json`;
  const res = await db.getJson<UserNotificationsData>(key);
  if (res.data) {
    res.data.notifications.forEach((n) => (n.read = true));
    await db.putJson(key, res.data);
  }
  return c.json({ success: true });
});

app.post("/api/notifications/mention", async (c) => {
  const ws = getWorkspaceId(c);
  const senderEmail = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const json = await c.req.json().catch(() => null);
  const parsed = MentionNotificationPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Text and documentId are required" }, 400);
  }
  const body = parsed.data;

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const members = await db.getWorkspaceMembers(ws);
  const senderProfile = await db.getUserProfile(senderEmail);
  const memberSender = members.find((m) => m.email.toLowerCase() === senderEmail.toLowerCase());
  const senderName = memberSender?.name || senderProfile.name;
  const senderAvatar = memberSender?.avatar || senderProfile.avatar;
  const wsMeta = await db.getWorkspaceMetadata(ws);
  const mentioned = extractMentions(body.text, members, senderEmail);

  const dispatched: MentionNotification[] = [];
  for (const member of mentioned) {
    const lines = body.text.split("\n");
    const matchedLine =
      lines.find(
        (l) =>
          l.toLowerCase().includes(member.email.toLowerCase()) ||
          l.toLowerCase().includes(member.name.toLowerCase())
      ) || body.text.slice(0, 150);

    const notification: MentionNotification = {
      id: `notif-${crypto.randomUUID()}`,
      workspaceId: ws,
      workspaceName: wsMeta?.name || "Clocean Main",
      documentId: body.documentId,
      documentTitle: body.documentTitle || "Document",
      sender: {
        name: senderName,
        email: senderEmail,
        avatar: senderAvatar,
      },
      recipientEmail: member.email,
      recipientName: member.name,
      contextSnippet: matchedLine.trim(),
      timestamp: "Just now",
      emailStatus: "delivered",
      read: false,
    };

    await dispatchMentionNotification(c.env, db, notification, new URL(c.req.url).origin);
    dispatched.push(notification);

    await db.appendActivity(ws, {
      title: `${senderProfile.name} mentioned @${member.name} in "${body.documentTitle || "Document"}"`,
      type: "doc",
      user: senderProfile.name,
    });
  }

  return c.json({ dispatched: dispatched.length, notifications: dispatched });
});

app.post("/api/notifications/test", async (c) => {
  const ws = getWorkspaceId(c);
  const senderEmail = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const wsMeta = await db.getWorkspaceMetadata(ws);
  const senderProfile = await db.getUserProfile(senderEmail);

  const testNotification: MentionNotification = {
    id: `notif-test-${crypto.randomUUID()}`,
    workspaceId: ws,
    workspaceName: wsMeta?.name || "Clocean Workspace",
    type: "test",
    sender: {
      name: senderProfile.name,
      email: senderEmail,
      avatar: senderProfile.avatar,
    },
    recipientEmail: senderEmail,
    recipientName: senderProfile.name,
    contextSnippet:
      "This is a test notification verifying that your Clocean email notification engine is properly configured.",
    timestamp: "Just now",
    emailStatus: "delivered",
    read: false,
  };

  const result = await dispatchMentionNotification(
    c.env,
    db,
    testNotification,
    new URL(c.req.url).origin
  );
  return c.json({ success: true, notification: testNotification, deliveryStatus: result.status });
});

// Drive File Upload & Streaming
app.post("/api/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"] as File | undefined;
  if (!file) {
    return c.json({ error: "No file provided in form data" }, 400);
  }

  // Security: Enforce maximum file upload size (100 MB)
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: "File exceeds maximum 100MB limit" }, 413);
  }

  const ws = getWorkspaceId(c);
  const fileId = `file-${crypto.randomUUID()}`;
  // Security: Sanitize filename to prevent R2 path traversal
  const filename = sanitizeFilename(file.name || "uploaded_file");
  const r2Key = `workspaces/${ws}/files/${fileId}/${filename}`;

  // Stream file directly to R2 bucket
  await c.env.CLOCEAN_STORAGE.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  // Record node in tree
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  const newNode: TreeNode = {
    id: fileId,
    name: filename,
    type: "file",
    parentId: null,
    size: file.size,
    mimeType: file.type,
    updatedAt: "Just now",
    createdAt: new Date().toISOString(),
    r2Key,
  };

  if (data) {
    data.nodes.unshift(newNode);
    await db.putJson(`workspaces/${ws}/tree.json`, data);
  }

  // If image, also record in photos gallery in R2
  if (file.type && file.type.startsWith("image/")) {
    const photosRes = await db.getJson<PhotosData>(`workspaces/${ws}/photos.json`);
    if (photosRes.data) {
      photosRes.data.photos.unshift({
        id: fileId,
        name: filename.replace(/\.[^/.]+$/, ""),
        url: `/api/files/${fileId}/${encodeURIComponent(filename)}`,
        size: file.size,
        album: "Uploads",
        uploadedAt: "Just now",
      });
      await db.putJson(`workspaces/${ws}/photos.json`, photosRes.data);
    }
  }

  // Also record in activity log
  const email = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const user = await db.getUserProfile(email);
  const actRes = await db.getJson<ActivitiesData>(`workspaces/${ws}/activity.json`);
  if (actRes.data) {
    actRes.data.activities.unshift({
      id: `act-${crypto.randomUUID()}`,
      title: filename,
      type: "file",
      timestamp: "Just now",
      user: user.name,
    });
    await db.putJson(`workspaces/${ws}/activity.json`, actRes.data);
  }

  return c.json({
    id: fileId,
    name: filename,
    size: file.size,
    mimeType: file.type,
    url: `/api/files/${fileId}/${encodeURIComponent(filename)}`,
  });
});

// Stream file from R2 with XSS sandboxing & security headers
app.get("/api/files/:id/:filename", async (c) => {
  const { id, filename } = c.req.param();

  // Security: Validate file ID and sanitize filename
  if (!isValidId(id)) {
    return c.json({ error: "Invalid file ID parameter" }, 400);
  }

  const ws = getWorkspaceId(c);
  const safeFilename = sanitizeFilename(decodeURIComponent(filename));
  const r2Key = `workspaces/${ws}/files/${id}/${safeFilename}`;

  let object = await c.env.CLOCEAN_STORAGE.get(r2Key, {
    range: c.req.raw.headers,
    onlyIf: c.req.raw.headers,
  });

  if (!object && ws !== "default") {
    // Fallback check default workspace if file was originally there
    object = await c.env.CLOCEAN_STORAGE.get(`workspaces/default/files/${id}/${safeFilename}`, {
      range: c.req.raw.headers,
      onlyIf: c.req.raw.headers,
    });
  }

  if (!object) {
    return c.json({ error: "File not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  // Security Headers: Prevent stored XSS and MIME sniffing
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "sandbox; default-src 'none';");
  headers.set("X-Frame-Options", "SAMEORIGIN");

  // Only allow inline disposition for safe non-executable formats (images & PDF)
  const ext = safeFilename.toLowerCase().slice(safeFilename.lastIndexOf("."));
  const isInlineSafe = SAFE_INLINE_EXTENSIONS.includes(ext);
  const dispositionType = isInlineSafe ? "inline" : "attachment";
  headers.set("Content-Disposition", `${dispositionType}; filename="${safeFilename.replace(/["\r\n\\]/g, "")}"`);

  const bodyStream = "body" in object ? (object as R2ObjectBody).body : null;
  return new Response(bodyStream, {
    headers,
    status: bodyStream ? 200 : 304,
  });
});

// Kanban Tasks
app.get("/api/tasks", async (c) => {
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<TasksData>(`workspaces/${ws}/tasks.json`);
  return c.json(data?.tasks || []);
});

app.put("/api/tasks", async (c) => {
  const ws = getWorkspaceId(c);
  const json = await c.req.json().catch(() => null);
  const parsed = z.array(TaskItemSchema).safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid tasks array payload" }, 400);
  }
  const tasks = parsed.data;
  const senderEmail = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const existing = await db.getJson<TasksData>(`workspaces/${ws}/tasks.json`);
  const previousTasks = existing.data?.tasks || [];
  const prevMap = new Map<string, TaskItem>(previousTasks.map((t) => [t.id, t]));

  const members = await db.getWorkspaceMembers(ws);
  const wsMeta = await db.getWorkspaceMetadata(ws);
  const senderProfile = await db.getUserProfile(senderEmail);
  const memberSender = members.find((m) => m.email.toLowerCase() === senderEmail.toLowerCase());
  const senderName = memberSender?.name || senderProfile.name;
  const senderAvatar = memberSender?.avatar || senderProfile.avatar;

  // Detect newly added or updated tasks with @ mentions or assignee assignments
  for (const task of tasks) {
    const prev = prevMap.get(task.id);
    const combinedText = `${task.title} ${task.description || ""}`;
    const mentions = extractMentions(combinedText, members, senderEmail);

    // Also check if an assignee is set who is not the sender and wasn't previously assigned
    const assigneeEmail =
      typeof task.assignee === "object" && task.assignee !== null
        ? task.assignee.email?.toLowerCase()
        : typeof task.assignee === "string" && task.assignee.includes("@")
        ? task.assignee.toLowerCase()
        : undefined;
    const prevAssigneeRaw = prev?.assignee as any;
    const prevAssigneeEmail =
      typeof prevAssigneeRaw === "object" && prevAssigneeRaw !== null
        ? prevAssigneeRaw.email?.toLowerCase()
        : typeof prevAssigneeRaw === "string" && prevAssigneeRaw.includes("@")
        ? prevAssigneeRaw.toLowerCase()
        : undefined;
    const isNewAssignee =
      assigneeEmail &&
      assigneeEmail !== senderEmail.toLowerCase() &&
      assigneeEmail !== prevAssigneeEmail;

    const notifiedEmails = new Set<string>();

    for (const member of mentions) {
      notifiedEmails.add(member.email.toLowerCase());
      const notif: MentionNotification = {
        id: `notif-task-${crypto.randomUUID()}`,
        workspaceId: ws,
        workspaceName: wsMeta?.name || "Clocean Workspace",
        type: "task",
        taskId: task.id,
        taskTitle: task.title,
        sender: {
          name: senderName,
          email: senderEmail,
          avatar: senderAvatar,
        },
        recipientEmail: member.email,
        recipientName: member.name,
        contextSnippet: task.title,
        timestamp: "Just now",
        emailStatus: "delivered",
        read: false,
      };
      await dispatchMentionNotification(c.env, db, notif, new URL(c.req.url).origin);
    }

    if (isNewAssignee && !notifiedEmails.has(assigneeEmail)) {
      const assignedMember = members.find((m) => m.email.toLowerCase() === assigneeEmail);
      if (assignedMember) {
        const notif: MentionNotification = {
          id: `notif-task-${crypto.randomUUID()}`,
          workspaceId: ws,
          workspaceName: wsMeta?.name || "Clocean Workspace",
          type: "task",
          taskId: task.id,
          taskTitle: task.title,
          sender: {
            name: senderName,
            email: senderEmail,
            avatar: senderAvatar,
          },
          recipientEmail: assignedMember.email,
          recipientName: assignedMember.name,
          contextSnippet: `Assigned to: "${task.title}"`,
          timestamp: "Just now",
          emailStatus: "delivered",
          read: false,
        };
        await dispatchMentionNotification(c.env, db, notif, new URL(c.req.url).origin);
      }
    }
  }

  await db.putJson(`workspaces/${ws}/tasks.json`, {
    tasks,
    updatedAt: new Date().toISOString(),
  });
  return c.json({ success: true, count: tasks.length });
});

// Photos Gallery
app.get("/api/photos", async (c) => {
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<PhotosData>(`workspaces/${ws}/photos.json`);
  return c.json(data?.photos || []);
});

// Activity Feed
app.get("/api/activity", async (c) => {
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<ActivitiesData>(`workspaces/${ws}/activity.json`);
  return c.json(data?.activities || []);
});

// Durable Object Real-Time Multi-Editing WebSocket Route (Hardened with CSWSH protection)
app.get("/api/collab/:docId", async (c) => {
  const docId = c.req.param("docId");

  // Security: Validate document ID
  if (!isValidId(docId)) {
    return c.text("Invalid document ID", 400);
  }

  // Security: Cross-Site WebSocket Hijacking (CSWSH) protection
  const origin = c.req.header("origin");
  if (!isAllowedOrigin(origin, c.req.url, c.env)) {
    return c.text("Forbidden: Cross-Site WebSocket Hijacking blocked", 403);
  }

  const ws = getWorkspaceId(c);
  const email = getAuthEmail(c.req.raw, c.env) || "alex@clocean.co";
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const user = await db.getUserProfile(email);

  // Route to Durable Object named by workspaceId:docId
  const roomId = `${ws}:${docId}`;
  const id = c.env.DOC_SESSION.idFromName(roomId);
  const stub = c.env.DOC_SESSION.get(id);

  const url = new URL(c.req.url);
  const queryName = url.searchParams.get("name");
  url.searchParams.set("workspaceId", ws);
  url.searchParams.set("docId", docId);
  url.searchParams.set("email", user.email);
  url.searchParams.set("name", queryName ? sanitizeFilename(queryName).slice(0, 60) : user.name);
  url.searchParams.set("avatar", user.avatar);

  const request = new Request(url.toString(), c.req.raw);
  return stub.fetch(request);
});

// Static Assets fallback for Cloudflare Pages / Workers static assets
app.get("*", async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Clocean API Gateway Active", 200);
});

export default app;
