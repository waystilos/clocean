import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env, WorkspaceTree, TreeNode, DocContent, TasksData, PhotosData, ActivitiesData } from "./types.ts";
import { R2Database } from "./storage/r2Db.ts";
import { getAuthUser } from "./auth/cfAccess.ts";
import { DocSessionDO } from "./durable_objects/DocSessionDO.ts";

export { DocSessionDO };

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for local Vite dev server
app.use("*", cors());

// Middleware: Auto-seed R2 database on first run
app.use("/api/*", async (c, next) => {
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  await db.ensureSeeded();
  await next();
});

// Auth / Profile Endpoint
app.get("/api/me", (c) => {
  const user = getAuthUser(c.req.raw);
  return c.json(user);
});

// Workspace Tree Endpoints
app.get("/api/tree", async (c) => {
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<WorkspaceTree>("workspaces/default/tree.json");
  return c.json(data || { workspaceId: "default", nodes: [], updatedAt: new Date().toISOString() });
});

app.post("/api/tree/node", async (c) => {
  const body = await c.req.json<Partial<TreeNode>>();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data, etag } = await db.getJson<WorkspaceTree>("workspaces/default/tree.json");
  if (!data) return c.json({ error: "Tree not found" }, 404);

  const newNode: TreeNode = {
    id: body.id || `node-${crypto.randomUUID()}`,
    name: body.name || "Untitled",
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
    await db.putJson(`workspaces/default/docs/${newNode.id}/content.json`, docData);
  }

  await db.putJson("workspaces/default/tree.json", data, etag || undefined);
  return c.json(newNode);
});

app.put("/api/tree/node/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Partial<TreeNode>>();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data, etag } = await db.getJson<WorkspaceTree>("workspaces/default/tree.json");
  if (!data) return c.json({ error: "Tree not found" }, 404);

  const node = data.nodes.find((n) => n.id === id);
  if (!node) return c.json({ error: "Node not found" }, 404);

  if (body.name) node.name = body.name;
  if (body.parentId !== undefined) node.parentId = body.parentId;
  if (body.tags) node.tags = body.tags;
  node.updatedAt = "Just now";

  await db.putJson("workspaces/default/tree.json", data, etag || undefined);
  return c.json(node);
});

app.delete("/api/tree/node/:id", async (c) => {
  const id = c.req.param("id");
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data, etag } = await db.getJson<WorkspaceTree>("workspaces/default/tree.json");
  if (!data) return c.json({ error: "Tree not found" }, 404);

  data.nodes = data.nodes.filter((n) => n.id !== id);
  data.updatedAt = new Date().toISOString();

  await db.putJson("workspaces/default/tree.json", data, etag || undefined);
  return c.json({ success: true, deletedId: id });
});

// Document Content Endpoints
app.get("/api/docs/:id", async (c) => {
  const id = c.req.param("id");
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<DocContent>(`workspaces/default/docs/${id}/content.json`);
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
  const body = await c.req.json<Partial<DocContent>>();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const existing = (await db.getJson<DocContent>(`workspaces/default/docs/${id}/content.json`)).data;

  const updatedDoc: DocContent = {
    id,
    title: body.title ?? existing?.title ?? "Untitled",
    tags: body.tags ?? existing?.tags ?? [],
    content: body.content ?? existing?.content ?? "",
    updatedAt: new Date().toISOString(),
    attachments: body.attachments ?? existing?.attachments ?? [],
  };

  await db.putJson(`workspaces/default/docs/${id}/content.json`, updatedDoc);

  // Sync title in tree
  const treeRes = await db.getJson<WorkspaceTree>("workspaces/default/tree.json");
  if (treeRes.data) {
    const node = treeRes.data.nodes.find((n) => n.id === id);
    if (node && node.name !== updatedDoc.title) {
      node.name = updatedDoc.title;
      node.updatedAt = "Just now";
      await db.putJson("workspaces/default/tree.json", treeRes.data);
    }
  }

  return c.json(updatedDoc);
});

// Drive File Upload & Streaming
app.post("/api/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"] as File | undefined;
  if (!file) {
    return c.json({ error: "No file provided in form data" }, 400);
  }

  const fileId = `file-${crypto.randomUUID()}`;
  const filename = file.name || "uploaded_file";
  const r2Key = `workspaces/default/files/${fileId}/${filename}`;

  // Stream file directly to R2 bucket
  await c.env.CLOCEAN_STORAGE.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  // Record node in tree
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<WorkspaceTree>("workspaces/default/tree.json");
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
    await db.putJson("workspaces/default/tree.json", data);
  }

  // Also record in activity log
  const user = getAuthUser(c.req.raw);
  const actRes = await db.getJson<ActivitiesData>("workspaces/default/activity.json");
  if (actRes.data) {
    actRes.data.activities.unshift({
      id: `act-${crypto.randomUUID()}`,
      title: filename,
      type: "file",
      timestamp: "Just now",
      user: user.name,
    });
    await db.putJson("workspaces/default/activity.json", actRes.data);
  }

  return c.json({
    id: fileId,
    name: filename,
    size: file.size,
    mimeType: file.type,
    url: `/api/files/${fileId}/${encodeURIComponent(filename)}`,
  });
});

// Stream file from R2
app.get("/api/files/:id/:filename", async (c) => {
  const { id, filename } = c.req.param();
  const r2Key = `workspaces/default/files/${id}/${decodeURIComponent(filename)}`;

  const object = await c.env.CLOCEAN_STORAGE.get(r2Key, {
    range: c.req.raw.headers,
    onlyIf: c.req.raw.headers,
  });

  if (!object) {
    // If not found in custom files, check if it is a sample file placeholder
    return c.text("File content available in R2 storage.", 200, {
      "Content-Type": "text/plain",
      "Content-Disposition": `inline; filename="${filename}"`,
    });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Content-Disposition", `inline; filename="${filename}"`);

  const hasBody = "body" in object && object.body;
  return new Response(hasBody ? object.body : null, {
    headers,
    status: hasBody ? 200 : 304,
  });
});

// Kanban Tasks
app.get("/api/tasks", async (c) => {
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<TasksData>("workspaces/default/tasks.json");
  return c.json(data?.tasks || []);
});

app.put("/api/tasks", async (c) => {
  const tasks = await c.req.json<any[]>();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  await db.putJson("workspaces/default/tasks.json", {
    tasks,
    updatedAt: new Date().toISOString(),
  });
  return c.json({ success: true, count: tasks.length });
});

// Photos Gallery
app.get("/api/photos", async (c) => {
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<PhotosData>("workspaces/default/photos.json");
  return c.json(data?.photos || []);
});

// Activity Feed
app.get("/api/activity", async (c) => {
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<ActivitiesData>("workspaces/default/activity.json");
  return c.json(data?.activities || []);
});

// Durable Object Real-Time Multi-Editing WebSocket Route
app.get("/api/collab/:docId", async (c) => {
  const docId = c.req.param("docId");
  const user = getAuthUser(c.req.raw);

  // Route to Durable Object named by docId
  const id = c.env.DOC_SESSION.idFromName(docId);
  const stub = c.env.DOC_SESSION.get(id);

  const url = new URL(c.req.url);
  url.searchParams.set("docId", docId);
  url.searchParams.set("email", user.email);
  url.searchParams.set("name", user.name);
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
