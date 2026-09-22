import { describe, it, expect } from "vitest";
import { extractMentions, generateMentionEmailHtml } from "../worker/notifications/emailNotifier.ts";
import { WorkspaceMember, MentionNotification } from "../worker/types.ts";

const BASE_URL = "http://127.0.0.1:8787";

describe("Clocean @ Mentions & Email Notification System", () => {
  const mockMembers: WorkspaceMember[] = [
    {
      email: "alex@clocean.co",
      name: "Alex Sterling",
      role: "owner",
      avatar: "https://example.com/alex.png",
      joinedAt: new Date().toISOString(),
    },
    {
      email: "elena@clocean.co",
      name: "Elena Rostova",
      role: "member",
      avatar: "https://example.com/elena.png",
      joinedAt: new Date().toISOString(),
    },
    {
      email: "marcus@clocean.co",
      name: "Marcus Vance",
      role: "admin",
      avatar: "https://example.com/marcus.png",
      joinedAt: new Date().toISOString(),
    },
  ];

  // 1. Unit Tests for Mention Parsing & Email Generation
  describe("Mention Extraction & HTML Email Template", () => {
    it("should extract mentions by full name and direct email while ignoring sender", () => {
      const text = "Hey @Elena Rostova, can you check with @marcus@clocean.co? Also cc @Alex Sterling";
      const mentioned = extractMentions(text, mockMembers, "alex@clocean.co");

      expect(mentioned.length).toBe(2);
      expect(mentioned.some((m) => m.email === "elena@clocean.co")).toBe(true);
      expect(mentioned.some((m) => m.email === "marcus@clocean.co")).toBe(true);
      expect(mentioned.some((m) => m.email === "alex@clocean.co")).toBe(false); // sender excluded
    });

    it("should extract mentions by first name", () => {
      const text = "Please review this immediately @Elena!";
      const mentioned = extractMentions(text, mockMembers);

      expect(mentioned.length).toBe(1);
      expect(mentioned[0].email).toBe("elena@clocean.co");
    });

    it("should generate beautiful branded responsive HTML email with deep-link", () => {
      const notification: MentionNotification = {
        id: "notif-test-1",
        workspaceId: "default",
        workspaceName: "Clocean Main",
        documentId: "doc-manifesto",
        documentTitle: "Launch overview & design manifesto",
        sender: {
          name: "Marcus Vance",
          email: "marcus@clocean.co",
          avatar: "https://example.com/marcus.png",
        },
        recipientEmail: "elena@clocean.co",
        recipientName: "Elena Rostova",
        contextSnippet: "Elena, could you review the typography specs?",
        timestamp: "Just now",
        emailStatus: "simulated",
        read: false,
      };

      const html = generateMentionEmailHtml(notification, "https://clocean.example.com");

      expect(html).toContain("clocean");
      expect(html).toContain("Marcus Vance");
      expect(html).toContain("Launch overview &amp; design manifesto");
      expect(html).toContain("Elena, could you review the typography specs?");
      expect(html).toContain("https://clocean.example.com?doc=doc-manifesto&amp;ws=default");
      expect(html).toContain("elena@clocean.co");
      expect(html).toContain("#1E7D6B"); // Clocean brand accent color
    });
  });

  // 2. Integration API Tests for Mentions & Email Notification Engine
  describe("API Notification Dispatch & Recipient Inboxes", () => {
    it("should dispatch a mention notification and record email status in R2", async () => {
      const res = await fetch(`${BASE_URL}/api/notifications/mention?user=alex`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": "default",
        },
        body: JSON.stringify({
          documentId: "doc-manifesto",
          documentTitle: "Launch overview & design manifesto",
          text: "Can @Elena Rostova verify the responsive font sizes?",
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.dispatched).toBe(1);
      expect(data.notifications[0].recipientEmail).toBe("elena@clocean.co");
      expect(data.notifications[0].emailStatus).toBeDefined();

      // Verify recipient Elena can fetch her notification
      const notifRes = await fetch(`${BASE_URL}/api/notifications?user=elena`);
      expect(notifRes.status).toBe(200);
      const notifications = (await notifRes.json()) as MentionNotification[];
      expect(Array.isArray(notifications)).toBe(true);

      const found = notifications.find((n) => n.contextSnippet.includes("font sizes"));
      expect(found).toBeDefined();
      expect(found?.read).toBe(false);
      expect(found?.sender.name).toBe("Alex Sterling");
    });

    it("should auto-dispatch email notifications when someone is @ mentioned in document content", async () => {
      const docId = `doc-mention-${Date.now()}`;

      // Save document with @ mention to Marcus
      const updateRes = await fetch(`${BASE_URL}/api/docs/${docId}?user=elena`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": "default",
        },
        body: JSON.stringify({
          title: "Edge Deployment Plan",
          content: "# Deployment Checklist\n- [ ] @Marcus Vance please approve the Cloudflare R2 bucket binding.",
          tags: ["#ops"],
        }),
      });
      expect(updateRes.status).toBe(200);

      // Verify Marcus received the email notification
      const marcusNotifs = await fetch(`${BASE_URL}/api/notifications?user=marcus`);
      expect(marcusNotifs.status).toBe(200);
      const notifications = (await marcusNotifs.json()) as MentionNotification[];
      const found = notifications.find((n) => n.documentId === docId);
      expect(found).toBeDefined();
      expect(found?.recipientEmail).toBe("marcus@clocean.co");
      expect(found?.sender.email).toBe("elena@clocean.co");
    });

    it("should allow posting comments with @ mentions and dispatch email notifications", async () => {
      const docId = "doc-manifesto";

      const commentRes = await fetch(`${BASE_URL}/api/docs/${docId}/comments?user=elena`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": "default",
        },
        body: JSON.stringify({
          text: "Hey @Alex Sterling, the obsidian dark theme looks incredible!",
          documentTitle: "Launch overview & design manifesto",
        }),
      });

      expect(commentRes.status).toBe(201);
      const comment = (await commentRes.json()) as any;
      expect(comment.id).toBeDefined();
      expect(comment.user.email).toBe("elena@clocean.co");
      expect(comment.mentions).toContain("alex@clocean.co");

      // Verify comments endpoint returns the comment
      const getCommentsRes = await fetch(`${BASE_URL}/api/docs/${docId}/comments`, {
        headers: { "x-workspace-id": "default" },
      });
      expect(getCommentsRes.status).toBe(200);
      const allComments = (await getCommentsRes.json()) as any[];
      expect(allComments.some((c) => c.text.includes("looks incredible"))).toBe(true);

      // Verify Alex received the mention notification
      const alexNotifsRes = await fetch(`${BASE_URL}/api/notifications?user=alex`);
      const alexNotifs = (await alexNotifsRes.json()) as MentionNotification[];
      const found = alexNotifs.find((n) => n.contextSnippet.includes("looks incredible"));
      expect(found).toBeDefined();
      expect(found?.sender.name).toBe("Elena Rostova");
    });

    it("should allow user to mark notifications as read", async () => {
      const readRes = await fetch(`${BASE_URL}/api/notifications/read?user=alex`, {
        method: "PUT",
      });
      expect(readRes.status).toBe(200);

      const notifRes = await fetch(`${BASE_URL}/api/notifications?user=alex`);
      const notifs = (await notifRes.json()) as MentionNotification[];
      expect(notifs.every((n) => n.read === true)).toBe(true);
    });
  });
});
