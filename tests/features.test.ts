import { describe, it, expect } from "vitest";

const BASE_URL = "http://127.0.0.1:8787";

describe("Clocean Core Features Integration Suite", () => {
  const testDocId = `feat-doc-${Date.now()}`;

  // 1. Document Page Icon, Cover, and Content Updates
  it("should create a document with page icon and cover banner", async () => {
    const res = await fetch(`${BASE_URL}/api/docs/${testDocId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Product Requirements Document",
        content: "Initial PRD draft with overview.",
        icon: "zap",
        cover: "gradient-sunset",
      }),
    });

    expect(res.status).toBe(200);
    const doc = (await res.json()) as any;
    expect(doc.id).toBe(testDocId);
    expect(doc.title).toBe("Product Requirements Document");
    expect(doc.icon).toBe("zap");
    expect(doc.cover).toBe("gradient-sunset");
  });

  // 2. Document Revision Snapshotting & Restoration
  it("should capture a revision when updating document content and support restore", async () => {
    // Update content to create a revision of the previous version
    const updateRes = await fetch(`${BASE_URL}/api/docs/${testDocId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Product Requirements Document v2",
        content: "Updated PRD draft with user stories and edge cases.",
        icon: "zap",
        cover: "gradient-sunset",
      }),
    });
    expect(updateRes.status).toBe(200);

    // Fetch revision history
    const revsRes = await fetch(`${BASE_URL}/api/docs/${testDocId}/revisions`);
    expect(revsRes.status).toBe(200);
    const revisions = (await revsRes.json()) as any[];
    expect(Array.isArray(revisions)).toBe(true);
    expect(revisions.length).toBeGreaterThanOrEqual(1);

    // Find the initial revision
    const initialRev = revisions.find((r) => r.title === "Product Requirements Document");
    expect(initialRev).toBeDefined();
    expect(initialRev.content).toBe("Initial PRD draft with overview.");

    // Restore to initial revision
    const restoreRes = await fetch(
      `${BASE_URL}/api/docs/${testDocId}/revisions/${initialRev.id}/restore`,
      { method: "POST" }
    );
    expect(restoreRes.status).toBe(200);
    const restoredDoc = (await restoreRes.json()) as any;
    expect(restoredDoc.content).toBe("Initial PRD draft with overview.");
    expect(restoredDoc.title).toBe("Product Requirements Document");

    // Verify document content matches restored version
    const getDocRes = await fetch(`${BASE_URL}/api/docs/${testDocId}`);
    expect(getDocRes.status).toBe(200);
    const currentDoc = (await getDocRes.json()) as any;
    expect(currentDoc.content).toBe("Initial PRD draft with overview.");
  });

  // 3. Document Public Sharing ("Publish to Web")
  it("should generate a public share token and serve read-only document anonymously", async () => {
    // Enable public sharing
    const shareRes = await fetch(`${BASE_URL}/api/docs/${testDocId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: true }),
    });
    expect(shareRes.status).toBe(200);
    const shareData = (await shareRes.json()) as any;
    expect(shareData.isPublic).toBe(true);
    expect(typeof shareData.publicToken).toBe("string");
    expect(shareData.publicToken.startsWith("pub-")).toBe(true);

    const token = shareData.publicToken;

    // Fetch public document endpoint (unauthenticated)
    const publicRes = await fetch(`${BASE_URL}/api/public/docs/${token}`);
    expect(publicRes.status).toBe(200);
    const pubDoc = (await publicRes.json()) as any;
    expect(pubDoc.id).toBe(testDocId);
    expect(pubDoc.title).toBe("Product Requirements Document");
    expect(pubDoc.content).toBe("Initial PRD draft with overview.");
    expect(pubDoc.icon).toBe("zap");

    // Disable public sharing
    const unshareRes = await fetch(`${BASE_URL}/api/docs/${testDocId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: false }),
    });
    expect(unshareRes.status).toBe(200);

    // Verify public link now 404s
    const revokedRes = await fetch(`${BASE_URL}/api/public/docs/${token}`);
    expect(revokedRes.status).toBe(404);
  });

  // 4. Workspace Favorites Toggle
  it("should allow starring and unstarring documents in workspace favorites", async () => {
    // Add to favorites
    const addRes = await fetch(`${BASE_URL}/api/workspaces/default/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId: testDocId }),
    });
    expect(addRes.status).toBe(200);
    const addDocIds = (await addRes.json()) as string[];
    expect(Array.isArray(addDocIds)).toBe(true);
    expect(addDocIds).toContain(testDocId);

    // Verify GET favorites
    const getRes = await fetch(`${BASE_URL}/api/workspaces/default/favorites`);
    expect(getRes.status).toBe(200);
    const docIds = (await getRes.json()) as string[];
    expect(docIds).toContain(testDocId);

    // Toggle off from favorites
    const removeRes = await fetch(`${BASE_URL}/api/workspaces/default/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId: testDocId }),
    });
    expect(removeRes.status).toBe(200);
    const removeDocIds = (await removeRes.json()) as string[];
    expect(Array.isArray(removeDocIds)).toBe(true);
    expect(removeDocIds).not.toContain(testDocId);
  });

  // 5. Sprint Tasks Schema Compatibility for Kanban & Table Views
  it("should manage tasks with metadata required for both Kanban and Table spreadsheet views", async () => {
    // 1. Get existing tasks
    const getRes = await fetch(`${BASE_URL}/api/tasks`);
    expect(getRes.status).toBe(200);
    const currentTasks = (await getRes.json()) as any[];

    const taskId = `task-spec-${Date.now()}`;
    const newTask = {
      id: taskId,
      title: "Design Cloudflare Durable Objects Schema",
      status: "todo",
      priority: "urgent",
      assignee: "Alex Rivera",
      dueDate: "2026-10-01",
      subtasks: [
        { id: "sub-1", title: "Review R2 locking", completed: true },
        { id: "sub-2", title: "Add broadcast throttler", completed: false },
      ],
    };

    const updateRes = await fetch(`${BASE_URL}/api/tasks`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([...currentTasks, newTask]),
    });
    expect(updateRes.status).toBe(200);

    // Verify task persists with all table and kanban fields intact
    const verifyRes = await fetch(`${BASE_URL}/api/tasks`);
    expect(verifyRes.status).toBe(200);
    const savedTasks = (await verifyRes.json()) as any[];
    const found = savedTasks.find((t) => t.id === taskId);
    expect(found).toBeDefined();
    expect(found.title).toBe(newTask.title);
    expect(found.status).toBe("todo");
    expect(found.priority).toBe("urgent");
    expect(found.assignee).toBe("Alex Rivera");
    expect(found.dueDate).toBe("2026-10-01");
    expect(found.subtasks.length).toBe(2);
    expect(found.subtasks[0].completed).toBe(true);
  });
});
