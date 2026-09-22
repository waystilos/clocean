import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  Env,
  WorkspaceTree,
  TreeNode,
  DocContent,
  TasksData,
  PhotosData,
  ActivitiesData,
  DocComment,
  DocCommentsData,
  MentionNotification,
  UserNotificationsData,
} from "./types.ts";
import { R2Database } from "./storage/r2Db.ts";
import { getAuthEmail, requireAuth } from "./auth/cfAccess.ts";
import { DocSessionDO } from "./durable_objects/DocSessionDO.ts";
import { extractMentions, dispatchMentionNotification } from "./notifications/emailNotifier.ts";

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
  const body = await c.req.json<{ name?: string; bio?: string }>();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfile(email);
  if (body.name) profile.name = body.name.slice(0, 100);
  if (body.bio !== undefined) profile.bio = body.bio.slice(0, 500);
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
  const body = await c.req.json<{ name: string; icon?: string }>();
  if (!body.name || !body.name.trim()) {
    return c.json({ error: "Workspace name is required" }, 400);
  }
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfile(email);
  const meta = await db.createWorkspace(
    body.name.trim().slice(0, 60),
    body.icon || "📁",
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

  const body = await c.req.json<{ email: string; name?: string; role?: "admin" | "member" }>();
  if (!body.email || !body.email.includes("@")) {
    return c.json({ error: "Valid email is required" }, 400);
  }

  await db.addWorkspaceMember(
    wsId,
    body.email,
    body.name || body.email.split("@")[0],
    body.role || "member"
  );
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

  const body = await c.req.json<{ role: "admin" | "member" }>();
  if (body.role !== "admin" && body.role !== "member") {
    return c.json({ error: "Role must be 'admin' or 'member'" }, 400);
  }

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
  const body = await c.req.json<Partial<TreeNode>>();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data, etag } = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  if (!data) return c.json({ error: "Tree not found" }, 404);

  const newNode: TreeNode = {
    id: body.id || `node-${crypto.randomUUID()}`,
    name: body.name ? sanitizeFilename(body.name) : "Untitled",
    type: body.type || "doc",
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

  const body = await c.req.json<Partial<TreeNode>>();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data, etag } = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  if (!data) return c.json({ error: "Tree not found" }, 404);

  const node = data.nodes.find((n) => n.id === id);
  if (!node) return c.json({ error: "Node not found" }, 404);

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

  const body = await c.req.json<Partial<DocContent>>();
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
  };

  await db.putJson(`workspaces/${ws}/docs/${id}/content.json`, updatedDoc);

  // Sync title in tree
  const treeRes = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  if (treeRes.data) {
    const node = treeRes.data.nodes.find((n) => n.id === id);
    if (node && node.name !== updatedDoc.title) {
      node.name = updatedDoc.title;
      node.updatedAt = "Just now";
      await db.putJson(`workspaces/${ws}/tree.json`, treeRes.data);
    }
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
          emailStatus: "simulated",
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

  const body = await c.req.json<{ text: string; documentTitle?: string }>();
  if (!body.text || !body.text.trim()) {
    return c.json({ error: "Comment text is required" }, 400);
  }

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
      emailStatus: "simulated",
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
  const body = await c.req.json<{
    documentId: string;
    documentTitle: string;
    text: string;
  }>();

  if (!body.text || !body.documentId) {
    return c.json({ error: "Text and documentId are required" }, 400);
  }

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
      emailStatus: "simulated",
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
    // If not found in custom files, check if it is a sample file placeholder
    return c.text("File content available in R2 storage.", 200, {
      "Content-Type": "text/plain",
      "Content-Disposition": `inline; filename="${safeFilename}"`,
    });
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
  const tasks = await c.req.json<any[]>();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
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
