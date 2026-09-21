import { describe, it, expect } from "vitest";

const BASE_URL = "http://127.0.0.1:8787";

describe("Clocean Organizations & Team Workspaces Test Suite", () => {
  let createdWsId = "";
  const testOwner = "elena@clocean.co";
  const testInvitee = "marcus@clocean.co";
  const testStranger = "sofia@clocean.co";

  // 1. Default Workspace Access
  describe("Default Workspace Resolution", () => {
    it("should return at least the default workspace for any authenticated user", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces?user=alex`);
      expect(res.status).toBe(200);
      const workspaces = await res.json() as any[];
      expect(Array.isArray(workspaces)).toBe(true);
      expect(workspaces.length).toBeGreaterThanOrEqual(1);

      const defaultWs = workspaces.find((w) => w.id === "default");
      expect(defaultWs).toBeDefined();
      expect(defaultWs.name).toBe("Clocean Main");
      expect(defaultWs.icon).toBe("🌊");
    });
  });

  // 2. Organization / Workspace Creation
  describe("Workspace Creation", () => {
    it("should reject creation without a valid name", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces?user=elena`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", icon: "🎨" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error).toContain("Workspace name is required");
    });

    it("should successfully create a new team workspace", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces?user=elena`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Design Studio Alpha",
          icon: "🎨",
        }),
      });

      expect(res.status).toBe(201);
      const created = await res.json() as any;
      expect(created.id).toMatch(/^ws-[a-z0-9]+$/);
      expect(created.name).toBe("Design Studio Alpha");
      expect(created.icon).toBe("🎨");
      expect(created.role).toBe("owner");

      createdWsId = created.id;
    });

    it("should list the newly created workspace in the owner's workspace index", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces?user=elena`);
      expect(res.status).toBe(200);
      const workspaces = await res.json() as any[];
      const found = workspaces.find((w) => w.id === createdWsId);
      expect(found).toBeDefined();
      expect(found.name).toBe("Design Studio Alpha");
      expect(found.role).toBe("owner");
    });
  });

  // 3. Team Member Management & Access Control
  describe("Team Member Roster & Invitations", () => {
    it("should list the creator as owner in workspace members", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces/${createdWsId}/members?user=elena`);
      expect(res.status).toBe(200);
      const members = await res.json() as any[];
      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBe(1);
      expect(members[0].email).toBe(testOwner);
      expect(members[0].role).toBe("owner");
    });

    it("should allow workspace owner to invite a new team member", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces/${createdWsId}/members?user=elena`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testInvitee,
          role: "admin",
        }),
      });

      expect(res.status).toBe(200);
      const members = await res.json() as any[];
      expect(members.length).toBe(2);

      const invited = members.find((m) => m.email === testInvitee);
      expect(invited).toBeDefined();
      expect(invited.role).toBe("admin");
    });

    it("should show the invited workspace in the invitee's workspace list", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces?user=marcus`);
      expect(res.status).toBe(200);
      const workspaces = await res.json() as any[];
      const found = workspaces.find((w) => w.id === createdWsId);
      expect(found).toBeDefined();
      expect(found.name).toBe("Design Studio Alpha");
      expect(found.role).toBe("admin");
    });

    it("should reject invitation from unauthorized third party with 403 Forbidden", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces/${createdWsId}/members?user=sofia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "hacker@evil.com",
          role: "admin",
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json() as any;
      expect(data.error).toContain("Only workspace owners and admins can invite members");
    });
  });

  // 4. Strict Multi-Tenant Data Isolation
  describe("Multi-Tenant Data Isolation", () => {
    it("should strictly isolate tasks between default workspace and custom workspace", async () => {
      const defaultTasks = [
        {
          id: `task-default-${Date.now()}`,
          title: "Default Workspace Task",
          status: "todo",
          dueDate: "2026-10-01",
          assignee: { name: "Alex", email: "alex@clocean.co" },
        },
      ];

      const customTasks = [
        {
          id: `task-custom-${Date.now()}`,
          title: "Secret Team Sprint Task",
          status: "inprogress",
          dueDate: "2026-11-01",
          assignee: { name: "Elena", email: "elena@clocean.co" },
        },
      ];

      // Save to default workspace
      const putDefault = await fetch(`${BASE_URL}/api/tasks`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": "default",
        },
        body: JSON.stringify(defaultTasks),
      });
      expect(putDefault.status).toBe(200);

      // Save to custom workspace
      const putCustom = await fetch(`${BASE_URL}/api/tasks`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": createdWsId,
        },
        body: JSON.stringify(customTasks),
      });
      expect(putCustom.status).toBe(200);

      // Verify default workspace does NOT leak custom tasks
      const getDefault = await fetch(`${BASE_URL}/api/tasks`, {
        headers: { "x-workspace-id": "default" },
      });
      const fetchedDefault = await getDefault.json() as any[];
      expect(fetchedDefault.some((t) => t.title === "Secret Team Sprint Task")).toBe(false);
      expect(fetchedDefault.some((t) => t.title === "Default Workspace Task")).toBe(true);

      // Verify custom workspace does NOT leak default tasks
      const getCustom = await fetch(`${BASE_URL}/api/tasks`, {
        headers: { "x-workspace-id": createdWsId },
      });
      const fetchedCustom = await getCustom.json() as any[];
      expect(fetchedCustom.some((t) => t.title === "Default Workspace Task")).toBe(false);
      expect(fetchedCustom.some((t) => t.title === "Secret Team Sprint Task")).toBe(true);
    });

    it("should strictly isolate document content between workspaces", async () => {
      const docId = `doc-isolated-${Date.now()}`;

      // Save doc in custom workspace
      const saveRes = await fetch(`${BASE_URL}/api/docs/${docId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": createdWsId,
        },
        body: JSON.stringify({
          title: "Confidential Strategy",
          content: "Top secret multi-tenant roadmap.",
          tags: ["#confidential"],
          attachments: [],
        }),
      });
      expect(saveRes.status).toBe(200);

      // Attempt to read that doc from default workspace (must return default blank template, never leaking custom workspace content)
      const readDefault = await fetch(`${BASE_URL}/api/docs/${docId}`, {
        headers: { "x-workspace-id": "default" },
      });
      expect(readDefault.status).toBe(200);
      const defaultDocData = await readDefault.json() as any;
      expect(defaultDocData.title).toBe("Untitled Document");
      expect(defaultDocData.content).toBe("");

      // Reading from custom workspace succeeds and returns the confidential document
      const readCustom = await fetch(`${BASE_URL}/api/docs/${docId}`, {
        headers: { "x-workspace-id": createdWsId },
      });
      expect(readCustom.status).toBe(200);
      const docData = await readCustom.json() as any;
      expect(docData.title).toBe("Confidential Strategy");
      expect(docData.content).toBe("Top secret multi-tenant roadmap.");
    });
  });
});
