import { describe, it, expect } from "vitest";
import { signSessionToken } from "../worker/auth/session.ts";
import {
  SendOtpSchema,
  VerifyOtpSchema,
  TaskItemSchema,
} from "../worker/schemas.ts";

const BASE_URL = "http://127.0.0.1:8787";

describe("Notion-Style Invites, Avatar Storage, and Edge Schemas", () => {
  const ownerEmail = `invite-owner-${Date.now()}@clocean.co`;
  const ownerToken = signSessionToken(ownerEmail);
  let createdWsId: string;

  // 1. Setup Workspace for Invite Testing
  it("should create a team workspace as owner", async () => {
    const res = await fetch(`${BASE_URL}/api/workspaces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: "Design Guild",
        icon: "🎨",
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.id).toBeDefined();
    expect(data.name).toBe("Design Guild");
    createdWsId = data.id;
  });

  // 2. Notion-Style Public Workspace Invite Info
  describe("Public Invite Info Endpoint", () => {
    it("should allow unauthenticated visitors to fetch workspace invite info", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces/${createdWsId}/invite-info`, {
        headers: { "x-test-unauth": "true" },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.id).toBe(createdWsId);
      expect(data.name).toBe("Design Guild");
      expect(data.icon).toBe("🎨");
      expect(data.memberCount).toBeGreaterThanOrEqual(1);
    });

    it("should return 404 for a non-existent workspace invite", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces/non-existent-ws-12345/invite-info`, {
        headers: { "x-test-unauth": "true" },
      });
      expect(res.status).toBe(404);
    });
  });

  // 3. Notion-Style 1-Click Join for Logged-In Teammates
  describe("1-Click Join for Existing Users", () => {
    const existingMemberEmail = `existing-user-${Date.now()}@clocean.co`;
    const existingMemberToken = signSessionToken(existingMemberEmail);

    it("should allow an authenticated user to join a workspace via invite link", async () => {
      const inviteRes = await fetch(`${BASE_URL}/api/workspaces/${createdWsId}/members`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: existingMemberEmail, role: "member" }),
      });
      expect(inviteRes.status).toBe(200);

      const res = await fetch(`${BASE_URL}/api/workspaces/${createdWsId}/join`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${existingMemberToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.workspace.id).toBe(createdWsId);
      expect(data.workspace.name).toBe("Design Guild");

      // Verify the user now lists this workspace
      const meRes = await fetch(`${BASE_URL}/api/me`, {
        headers: { Authorization: `Bearer ${existingMemberToken}` },
      });
      const meData = (await meRes.json()) as any;
      const joined = meData.workspaces.find((w: any) => w.id === createdWsId);
      expect(joined).toBeDefined();
    });

    it("should reject unauthenticated requests to join", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces/${createdWsId}/join`, {
        method: "POST",
        headers: { "x-test-unauth": "true" },
      });
      expect(res.status).toBe(401);
    });
  });

  // 4. Notion-Style New User Sign-Up via Invite Link (OTP Flow)
  describe("New User Sign-Up and Auto-Join via Invite OTP", () => {
    const newInviteeEmail = `invite-signup-${Date.now()}@clocean.co`;

    it("should send an OTP code for joining a workspace", async () => {
      const res = await fetch(`${BASE_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-unauth": "true",
        },
        body: JSON.stringify({
          email: newInviteeEmail,
          purpose: "join",
          workspaceId: createdWsId,
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.message).toContain("code sent");
    });

    it("should reject invalid OTP code during join verification", async () => {
      const res = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-unauth": "true",
        },
        body: JSON.stringify({
          email: newInviteeEmail,
          code: "000000",
          purpose: "join",
          name: "Guild Designer",
          workspaceId: createdWsId,
        }),
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Invalid code");
    });
  });

  // 5. Avatar Upload, Dual-Key Storage & Streaming
  describe("Avatar R2 Storage and Streaming Engine", () => {
    const avatarUserEmail = `avatar-artist-${Date.now()}@clocean.co`;
    const avatarUserToken = signSessionToken(avatarUserEmail);

    it("should upload a custom PNG avatar and persist to R2", async () => {
      // 1x1 valid PNG image
      const pngBytes = new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8,
        6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5,
        0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
      ]);
      const blob = new Blob([pngBytes], { type: "image/png" });
      const formData = new FormData();
      formData.append("avatar", blob, "avatar.png");

      const uploadRes = await fetch(`${BASE_URL}/api/user/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${avatarUserToken}`,
        },
        body: formData,
      });

      expect(uploadRes.status).toBe(200);
      const profile = (await uploadRes.json()) as any;
      expect(profile.avatar).toContain("/api/user/avatar/");

      // Stream it back from R2 publicly
      const streamRes = await fetch(`${BASE_URL}/api/user/avatar/${encodeURIComponent(avatarUserEmail)}`);
      expect(streamRes.status).toBe(200);
      expect(streamRes.headers.get("content-type")).toBe("image/png");
      expect(streamRes.headers.get("cache-control")).toBe("public, max-age=86400");
    });

    it("should reject avatar upload without authorization", async () => {
      const formData = new FormData();
      formData.append("avatar", new Blob(["test"], { type: "image/png" }), "avatar.png");

      const uploadRes = await fetch(`${BASE_URL}/api/user/avatar`, {
        method: "POST",
        headers: { "x-test-unauth": "true" },
        body: formData,
      });

      expect(uploadRes.status).toBe(401);
    });

    it("should reject avatar upload without file attachment", async () => {
      const formData = new FormData();

      const uploadRes = await fetch(`${BASE_URL}/api/user/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${avatarUserToken}`,
        },
        body: formData,
      });

      expect(uploadRes.status).toBe(400);
    });
  });

  // 6. Edge Validation Schemas
  describe("Zod Edge Validation Schemas", () => {
    it("should validate SendOtpSchema with join purpose and workspaceId", () => {
      const valid = SendOtpSchema.safeParse({
        email: "member@example.com",
        purpose: "join",
        workspaceId: "ws-12345",
      });
      expect(valid.success).toBe(true);
    });

    it("should reject SendOtpSchema with invalid purpose", () => {
      const invalid = SendOtpSchema.safeParse({
        email: "member@example.com",
        purpose: "unknown-purpose",
      });
      expect(invalid.success).toBe(false);
    });

    it("should validate VerifyOtpSchema 6-digit numeric format", () => {
      const valid = VerifyOtpSchema.safeParse({
        email: "member@example.com",
        code: "123456",
        purpose: "setup",
      });
      expect(valid.success).toBe(true);

      const tooShort = VerifyOtpSchema.safeParse({
        email: "member@example.com",
        code: "1234",
        purpose: "setup",
      });
      expect(tooShort.success).toBe(false);

      const nonNumeric = VerifyOtpSchema.safeParse({
        email: "member@example.com",
        code: "ABC123",
        purpose: "setup",
      });
      expect(nonNumeric.success).toBe(false);
    });

    it("should validate task with calendar due date in TaskItemSchema", () => {
      const validTask = TaskItemSchema.safeParse({
        id: "task-1",
        title: "Deploy Edge Worker",
        status: "in_progress",
        priority: "high",
        dueDate: "2026-10-15",
      });
      expect(validTask.success).toBe(true);

      const validTextDate = TaskItemSchema.safeParse({
        id: "task-2",
        title: "Review Figma mockups",
        status: "todo",
        dueDate: "Due Friday",
      });
      expect(validTextDate.success).toBe(true);
    });
  });
});
