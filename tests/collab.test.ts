import { describe, it, expect } from "vitest";

const WS_BASE_URL = "ws://127.0.0.1:8787";
const HTTP_BASE_URL = "http://127.0.0.1:8787";

describe("Real-Time Multiplayer Collaboration via Durable Objects & WebSockets", () => {
  it("should support concurrent users, live edits, cursor tracking, and R2 persistence", async () => {
    const docId = `test-collab-${Date.now()}`;

    // Initialize document first in R2
    await fetch(`${HTTP_BASE_URL}/api/docs/${docId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Multiplayer Collab Room",
        content: "Initial document content.",
        tags: ["#collab"],
        attachments: [],
      }),
    });

    // Connect User 1 (Alex)
    const ws1 = new WebSocket(
      `${WS_BASE_URL}/api/collab/${docId}?email=alex@clocean.co&name=Alex%20Sterling`
    );

    const ws1Messages: any[] = [];
    ws1.onmessage = (e) => {
      try {
        ws1Messages.push(JSON.parse(e.data as string));
      } catch {}
    };

    await new Promise<void>((resolve, reject) => {
      ws1.onopen = () => resolve();
      ws1.onerror = (err) => reject(err);
    });

    // Wait for ws1 to receive init
    await new Promise((r) => setTimeout(r, 200));
    const initMsg = ws1Messages.find((m) => m.type === "init");
    expect(initMsg).toBeDefined();
    expect(initMsg.title).toBe("Multiplayer Collab Room");

    // Connect User 2 (Marcus)
    const ws2 = new WebSocket(
      `${WS_BASE_URL}/api/collab/${docId}?email=marcus@clocean.co&name=Marcus%20Vance`
    );

    const ws2Messages: any[] = [];
    ws2.onmessage = (e) => {
      try {
        ws2Messages.push(JSON.parse(e.data as string));
      } catch {}
    };

    await new Promise<void>((resolve, reject) => {
      ws2.onopen = () => resolve();
      ws2.onerror = (err) => reject(err);
    });

    // Wait for ws1 to receive presence_join for Marcus
    await new Promise((r) => setTimeout(r, 200));
    const joinMsg = ws1Messages.find((m) => m.type === "presence_join");
    expect(joinMsg).toBeDefined();
    expect(joinMsg.user.name).toBe("Marcus Vance");

    // User 1 sends a live edit
    const editPayload = {
      type: "edit",
      content: "Alex and Marcus are typing together simultaneously in real-time!",
      title: "Multiplayer Collab Room (Active)",
    };
    ws1.send(JSON.stringify(editPayload));

    // Wait for User 2 to receive the live edit broadcast
    await new Promise((r) => setTimeout(r, 200));
    const editMsg = ws2Messages.find((m) => m.type === "edit");
    expect(editMsg).toBeDefined();
    expect(editMsg.content).toBe(editPayload.content);

    // User 2 sends cursor movement
    const cursorPayload = {
      type: "cursor",
      cursor: { line: 1, ch: 15 },
    };
    ws2.send(JSON.stringify(cursorPayload));

    // Wait for User 1 to receive the live cursor broadcast
    await new Promise((r) => setTimeout(r, 200));
    const cursorMsg = ws1Messages.find((m) => m.type === "cursor");
    expect(cursorMsg).toBeDefined();
    expect(cursorMsg.cursor.ch).toBe(15);
    expect(cursorMsg.user.name).toBe("Marcus Vance");

    // User 2 sends ping
    ws2.send(JSON.stringify({ type: "ping" }));
    await new Promise((r) => setTimeout(r, 200));
    const pongMsg = ws2Messages.find((m) => m.type === "pong");
    expect(pongMsg).toBeDefined();

    // User 2 disconnects -> User 1 should receive presence_leave
    ws2.close();
    await new Promise((r) => setTimeout(r, 300));
    const leaveMsg = ws1Messages.find((m) => m.type === "presence_leave");
    expect(leaveMsg).toBeDefined();

    // User 1 closes (triggers auto-flush to Cloudflare R2 on room empty)
    ws1.close();

    // Wait 500ms for Durable Object to flush to R2
    await new Promise((r) => setTimeout(r, 500));

    // Verify document was persisted to R2
    const verifyRes = await fetch(`${HTTP_BASE_URL}/api/docs/${docId}`);
    expect(verifyRes.status).toBe(200);
    const savedDoc = (await verifyRes.json()) as any;
    expect(savedDoc.content).toBe(editPayload.content);
  });

  it("should enforce strict room isolation across different documents", async () => {
    const docA = `collab-isolation-a-${Date.now()}`;
    const docB = `collab-isolation-b-${Date.now()}`;

    const wsA = new WebSocket(`${WS_BASE_URL}/api/collab/${docA}?email=userA@clocean.co&name=User%20A`);
    const wsB = new WebSocket(`${WS_BASE_URL}/api/collab/${docB}?email=userB@clocean.co&name=User%20B`);

    const wsAMessages: any[] = [];
    const wsBMessages: any[] = [];

    wsA.onmessage = (e) => {
      try { wsAMessages.push(JSON.parse(e.data as string)); } catch {}
    };
    wsB.onmessage = (e) => {
      try { wsBMessages.push(JSON.parse(e.data as string)); } catch {}
    };

    await Promise.all([
      new Promise<void>((res) => { wsA.onopen = () => res(); }),
      new Promise<void>((res) => { wsB.onopen = () => res(); }),
    ]);

    await new Promise((r) => setTimeout(r, 200));

    // Send edit only to room A
    const secretContent = "Room A Confidential Blueprint";
    wsA.send(JSON.stringify({ type: "edit", content: secretContent }));

    await new Promise((r) => setTimeout(r, 300));

    // Room B should NOT receive any edit messages from Room A
    const leakedEdit = wsBMessages.find((m) => m.type === "edit" && m.content === secretContent);
    expect(leakedEdit).toBeUndefined();

    wsA.close();
    wsB.close();
  });
});
