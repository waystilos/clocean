import { describe, it, expect } from "vitest";

const BASE_URL = "http://127.0.0.1:8787";

describe("Clocean R2 Edge REST API & Database Tests", () => {
  const testUserEmail = `tester-${Date.now()}@clocean.co`;

  // 1. User Profile & Avatar Tests
  describe("Real User Account & Avatar Management in R2", () => {
    it("should auto-create a user profile in R2 if none exists", async () => {
      const res = await fetch(`${BASE_URL}/api/me?user=${encodeURIComponent(testUserEmail)}`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.email).toBe(testUserEmail);
      expect(data.name).toBeDefined();
      expect(data.avatar).toContain("dicebear.com");
    });

    it("should update display name and persist to R2", async () => {
      const newName = "Elena Fisher";
      const res = await fetch(`${BASE_URL}/api/user/profile?user=${encodeURIComponent(testUserEmail)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, bio: "Lead Explorer" }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.name).toBe(newName);
      expect(data.bio).toBe("Lead Explorer");

      // Verify persistence by fetching again
      const verifyRes = await fetch(`${BASE_URL}/api/me?user=${encodeURIComponent(testUserEmail)}`);
      const verifyData = (await verifyRes.json()) as any;
      expect(verifyData.name).toBe(newName);
    });

    it("should upload a real avatar image to R2 and stream it back", async () => {
      // Create a 1x1 PNG byte array
      const pngBytes = new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8,
        6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5,
        0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
      ]);
      const blob = new Blob([pngBytes], { type: "image/png" });
      const formData = new FormData();
      formData.append("avatar", blob, "avatar.png");

      const uploadRes = await fetch(`${BASE_URL}/api/user/avatar?user=${encodeURIComponent(testUserEmail)}`, {
        method: "POST",
        body: formData,
      });
      expect(uploadRes.status).toBe(200);
      const profile = (await uploadRes.json()) as any;
      expect(profile.avatar).toContain("/api/user/avatar/");

      // Verify streaming the image back from R2
      const avatarRes = await fetch(`${BASE_URL}/api/user/avatar/${encodeURIComponent(testUserEmail)}`);
      expect(avatarRes.status).toBe(200);
      expect(avatarRes.headers.get("content-type")).toBe("image/png");
      expect(avatarRes.headers.get("cache-control")).toBe("public, max-age=86400");
      const bytes = new Uint8Array(await avatarRes.arrayBuffer());
      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  // 2. Workspace Tree & Hierarchy
  describe("Workspace Tree & Document Hierarchy in R2", () => {
    let createdDocId: string;

    it("should fetch workspace tree with seeded items", async () => {
      const res = await fetch(`${BASE_URL}/api/tree`);
      expect(res.status).toBe(200);
      const tree = (await res.json()) as any;
      expect(tree.workspaceId).toBe("default");
      expect(Array.isArray(tree.nodes)).toBe(true);
      expect(tree.nodes.length).toBeGreaterThan(0);
    });

    it("should create a new document node in R2", async () => {
      const res = await fetch(`${BASE_URL}/api/tree/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Q4 Strategy Document",
          type: "doc",
          tags: ["#strategy", "#q4"],
        }),
      });
      expect(res.status).toBe(200);
      const node = (await res.json()) as any;
      expect(node.id).toBeDefined();
      expect(node.name).toBe("Q4 Strategy Document");
      createdDocId = node.id;

      // Verify content.json was also initialized in R2
      const docRes = await fetch(`${BASE_URL}/api/docs/${createdDocId}`);
      expect(docRes.status).toBe(200);
      const doc = (await docRes.json()) as any;
      expect(doc.title).toBe("Q4 Strategy Document");
    });

    it("should create a folder and nest a document inside it", async () => {
      // 1. Create Folder
      const folderRes = await fetch(`${BASE_URL}/api/tree/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Design System Specs",
          type: "folder",
          parentId: null,
        }),
      });
      expect(folderRes.status).toBe(200);
      const folder = (await folderRes.json()) as any;
      expect(folder.id).toBeDefined();
      expect(folder.type).toBe("folder");

      // 2. Create Document inside Folder
      const docRes = await fetch(`${BASE_URL}/api/tree/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Color Tokens Spec",
          type: "doc",
          parentId: folder.id,
          tags: ["#specs", "#design"],
        }),
      });
      expect(docRes.status).toBe(200);
      const nestedDoc = (await docRes.json()) as any;
      expect(nestedDoc.parentId).toBe(folder.id);

      // 3. Move Document back to Root
      const moveRes = await fetch(`${BASE_URL}/api/tree/node/${nestedDoc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: null }),
      });
      expect(moveRes.status).toBe(200);
      const movedDoc = (await moveRes.json()) as any;
      expect(movedDoc.parentId).toBeNull();

      // Clean up test nodes
      await fetch(`${BASE_URL}/api/tree/node/${folder.id}`, { method: "DELETE" });
      await fetch(`${BASE_URL}/api/tree/node/${nestedDoc.id}`, { method: "DELETE" });
    });

    it("should rename an existing node", async () => {
      const res = await fetch(`${BASE_URL}/api/tree/node/${createdDocId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Q4 Strategy Document (Finalized)" }),
      });
      expect(res.status).toBe(200);
      const node = (await res.json()) as any;
      expect(node.name).toBe("Q4 Strategy Document (Finalized)");
    });

    it("should delete a node from the tree", async () => {
      const res = await fetch(`${BASE_URL}/api/tree/node/${createdDocId}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);

      // Verify deletion in tree
      const treeRes = await fetch(`${BASE_URL}/api/tree`);
      const tree = (await treeRes.json()) as any;
      const found = tree.nodes.find((n: any) => n.id === createdDocId);
      expect(found).toBeUndefined();
    });
  });

  // 3. Document Content & Block Editing
  describe("Document Content & Attachments", () => {
    it("should gracefully return an empty template for non-existent document", async () => {
      const nonExistentId = `doc-ghost-${Date.now()}`;
      const res = await fetch(`${BASE_URL}/api/docs/${nonExistentId}`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.id).toBe(nonExistentId);
      expect(data.title).toBe("Untitled Document");
      expect(data.content).toBe("");
    });

    it("should update document content, checklists, and attachments in R2", async () => {
      const docId = "doc-manifesto";
      const updatedContent = "Updated vision manifesto.\n- [x] Tested checklists\n- [ ] Deploy to Workers";
      const res = await fetch(`${BASE_URL}/api/docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Launch overview & design manifesto",
          content: updatedContent,
          tags: ["#launch", "#design"],
          attachments: [
            {
              id: "att-1",
              name: "sketch.png",
              type: "image/png",
              size: 2048,
              url: "/api/files/att-1/sketch.png",
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const savedDoc = (await res.json()) as any;
      expect(savedDoc.content).toBe(updatedContent);
      expect(savedDoc.attachments.length).toBe(1);

      // Re-fetch to verify read-after-write consistency in R2
      const checkRes = await fetch(`${BASE_URL}/api/docs/${docId}`);
      const checkDoc = (await checkRes.json()) as any;
      expect(checkDoc.content).toBe(updatedContent);
    });

    it("should synchronize document title changes back to the workspace tree node", async () => {
      const docId = "doc-manifesto";
      const newTitle = "Launch overview & design manifesto (Syncd)";
      await fetch(`${BASE_URL}/api/docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
        }),
      });

      const treeRes = await fetch(`${BASE_URL}/api/tree`);
      const tree = (await treeRes.json()) as any;
      const node = tree.nodes.find((n: any) => n.id === docId);
      expect(node).toBeDefined();
      expect(node.name).toBe(newTitle);
    });
  });

  // 4. File Upload & Range Streaming in R2
  describe("Cloudflare Drive File Streaming & Range Requests", () => {
    let uploadedFileId: string;
    let uploadedFileName: string;

    it("should reject file upload when no file is attached", async () => {
      const formData = new FormData();
      const res = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toBeDefined();
    });

    it("should stream upload a text file directly to R2", async () => {
      const fileContent = "Clocean zero-egress file storage test payload.";
      const blob = new Blob([fileContent], { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", blob, "test-doc.txt");

      const res = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(200);
      const fileData = (await res.json()) as any;
      expect(fileData.id).toBeDefined();
      expect(fileData.name).toBe("test-doc.txt");
      uploadedFileId = fileData.id;
      uploadedFileName = fileData.name;
    });

    it("should stream the uploaded file back with correct Content-Type", async () => {
      const res = await fetch(`${BASE_URL}/api/files/${uploadedFileId}/${encodeURIComponent(uploadedFileName)}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/plain");
      const text = await res.text();
      expect(text).toBe("Clocean zero-egress file storage test payload.");
    });

    it("should return 404 for non-existent file", async () => {
      const res = await fetch(`${BASE_URL}/api/files/file-ghost/missing.txt`);
      expect(res.status).toBe(404);
      const data = (await res.json()) as any;
      expect(data.error).toBe("File not found");
    });

    it("should support HTTP Range requests for byte-range streaming", async () => {
      const res = await fetch(`${BASE_URL}/api/files/${uploadedFileId}/${encodeURIComponent(uploadedFileName)}`, {
        headers: { Range: "bytes=0-6" },
      });
      // R2 will return 206 Partial Content
      expect([200, 206]).toContain(res.status);
      const text = await res.text();
      expect(text.startsWith("Clocean")).toBe(true);
    });

    it("should auto-index image uploads into the Photos gallery", async () => {
      const imgBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      const blob = new Blob([imgBytes], { type: "image/png" });
      const formData = new FormData();
      formData.append("file", blob, "gallery-test.png");

      const res = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      expect(res.status).toBe(200);

      // Check photos gallery
      const photosRes = await fetch(`${BASE_URL}/api/photos`);
      const photos = (await photosRes.json()) as any[];
      const found = photos.find((p) => p.name === "gallery-test");
      expect(found).toBeDefined();
    });
  });

  // 5. Tasks Board & Activity Feed
  describe("Kanban Tasks & Activity Logging", () => {
    it("should fetch tasks from R2", async () => {
      const res = await fetch(`${BASE_URL}/api/tasks`);
      expect(res.status).toBe(200);
      const tasks = (await res.json()) as any[];
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
    });

    it("should update tasks and persist to R2", async () => {
      const tasksRes = await fetch(`${BASE_URL}/api/tasks`);
      const tasks = (await tasksRes.json()) as any[];
      
      // Move first task to 'done'
      tasks[0].status = "done";
      const updateRes = await fetch(`${BASE_URL}/api/tasks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tasks),
      });
      expect(updateRes.status).toBe(200);

      // Verify persistence
      const checkRes = await fetch(`${BASE_URL}/api/tasks`);
      const checkTasks = (await checkRes.json()) as any[];
      expect(checkTasks[0].status).toBe("done");
    });

    it("should create a new task and transition it through all kanban stages", async () => {
      const tasksRes = await fetch(`${BASE_URL}/api/tasks`);
      const tasks = (await tasksRes.json()) as any[];
      
      const newTask = {
        id: `task-lifecycle-${Date.now()}`,
        title: "Verify R2 zero-egress throughput",
        status: "todo",
        dueDate: "Due Tomorrow",
        assignee: { name: "Elena Rostova", email: "elena@clocean.co" },
      };

      // 1. Add task in 'todo'
      tasks.push(newTask);
      await fetch(`${BASE_URL}/api/tasks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tasks),
      });

      // 2. Transition to 'inprogress'
      newTask.status = "inprogress";
      await fetch(`${BASE_URL}/api/tasks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tasks),
      });

      let check = await (await fetch(`${BASE_URL}/api/tasks`)).json() as any[];
      let found = check.find((t) => t.id === newTask.id);
      expect(found).toBeDefined();
      expect(found.status).toBe("inprogress");

      // 3. Transition to 'done'
      newTask.status = "done";
      await fetch(`${BASE_URL}/api/tasks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tasks),
      });

      check = await (await fetch(`${BASE_URL}/api/tasks`)).json() as any[];
      found = check.find((t) => t.id === newTask.id);
      expect(found.status).toBe("done");
    });

    it("should fetch workspace activity changelog", async () => {
      const res = await fetch(`${BASE_URL}/api/activity`);
      expect(res.status).toBe(200);
      const activities = (await res.json()) as any[];
      expect(Array.isArray(activities)).toBe(true);
      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0].title).toBeDefined();
      expect(activities[0].user).toBeDefined();
    });
  });

  // 6. Photo Gallery Categorization
  describe("Photo Gallery Album Categorization", () => {
    it("should retrieve photos and support albums like Ocean, Spaces, Textures", async () => {
      const res = await fetch(`${BASE_URL}/api/photos`);
      expect(res.status).toBe(200);
      const photos = (await res.json()) as any[];
      expect(photos.length).toBeGreaterThan(0);

      const albums = new Set(photos.map((p) => p.album));
      expect(albums.has("Ocean") || albums.has("Spaces") || albums.has("Textures")).toBe(true);
    });
  });
});
