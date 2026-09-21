import { Env } from "../types.ts";

interface ConnectedClient {
  id: string;
  name: string;
  email: string;
  avatar: string;
  color: string;
}

const COLLAB_COLORS = [
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#14B8A6", // Teal
];

export class DocSessionDO {
  private docId: string = "";
  private content: string = "";
  private title: string = "";
  private tags: string[] = [];
  private attachments: any[] = [];
  private dirty: boolean = false;
  private saveTimeout: any = null;

  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    this.docId = url.searchParams.get("docId") || "default";

    // Handle WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const email = url.searchParams.get("email") || "alex@clocean.co";
      const name = url.searchParams.get("name") || "Alex Sterling";
      const avatar = url.searchParams.get("avatar") || "";

      await this.handleWebSocket(server, { email, name, avatar });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // HTTP Endpoint to trigger flush or get status
    if (request.method === "POST" && url.pathname.endsWith("/flush")) {
      await this.flushToR2();
      return new Response(JSON.stringify({ flushed: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Clocean Durable Object Active", { status: 200 });
  }

  private async loadFromR2(): Promise<void> {
    try {
      const r2Object = await this.env.CLOCEAN_STORAGE.get(
        `workspaces/default/docs/${this.docId}/content.json`
      );
      if (r2Object) {
        const text = await r2Object.text();
        const json = JSON.parse(text);
        this.content = json.content || "";
        this.title = json.title || "";
        this.tags = json.tags || [];
        this.attachments = json.attachments || [];
      }
    } catch (err) {
      console.error("Failed to load doc from R2:", err);
    }
  }

  private async flushToR2(): Promise<void> {
    if (!this.dirty) return;
    try {
      const payload = {
        id: this.docId,
        title: this.title,
        tags: this.tags,
        content: this.content,
        updatedAt: new Date().toISOString(),
        attachments: this.attachments,
      };
      await this.env.CLOCEAN_STORAGE.put(
        `workspaces/default/docs/${this.docId}/content.json`,
        JSON.stringify(payload, null, 2),
        {
          httpMetadata: { contentType: "application/json" },
        }
      );
      this.dirty = false;
    } catch (err) {
      console.error("Error saving doc to R2:", err);
    }
  }

  private async handleWebSocket(
    ws: WebSocket,
    userMeta: { email: string; name: string; avatar: string }
  ) {
    this.state.acceptWebSocket(ws);

    // Initial load from R2 if state is empty
    if (!this.content) {
      await this.loadFromR2();
    }

    const sockets = this.state.getWebSockets();
    const colorIndex = (sockets.length - 1) % COLLAB_COLORS.length;
    const clientMeta: ConnectedClient = {
      id: crypto.randomUUID(),
      email: userMeta.email,
      name: userMeta.name,
      avatar: userMeta.avatar,
      color: COLLAB_COLORS[colorIndex],
    };

    // Serialize client metadata into socket attachment
    ws.serializeAttachment(clientMeta);

    // Send initial snapshot to newly connected client
    ws.send(
      JSON.stringify({
        type: "init",
        content: this.content,
        title: this.title,
        tags: this.tags,
        attachments: this.attachments,
        user: clientMeta,
        activeCollaborators: this.getActiveCollaborators(),
      })
    );

    // Broadcast user joined to other collaborators
    this.broadcast(
      JSON.stringify({
        type: "presence_join",
        user: clientMeta,
        activeCollaborators: this.getActiveCollaborators(),
      }),
      ws
    );
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;

    try {
      const data = JSON.parse(message);
      const senderMeta = ws.deserializeAttachment() as ConnectedClient | null;

      switch (data.type) {
        case "edit": {
          // Update in-memory state
          if (typeof data.content === "string") this.content = data.content;
          if (typeof data.title === "string") this.title = data.title;
          if (Array.isArray(data.tags)) this.tags = data.tags;
          if (Array.isArray(data.attachments)) this.attachments = data.attachments;
          this.dirty = true;

          // Broadcast edit delta to all other connected peers
          this.broadcast(
            JSON.stringify({
              type: "edit",
              content: this.content,
              title: this.title,
              tags: this.tags,
              attachments: this.attachments,
              updatedBy: senderMeta?.email,
            }),
            ws
          );

          // Debounced flush to Cloudflare R2
          this.scheduleFlush();
          break;
        }

        case "cursor": {
          // Live cursor movement / text selection
          this.broadcast(
            JSON.stringify({
              type: "cursor",
              user: senderMeta,
              cursor: data.cursor, // { line, ch, selectionStart, selectionEnd }
            }),
            ws
          );
          break;
        }

        case "ping": {
          ws.send(JSON.stringify({ type: "pong" }));
          break;
        }
      }
    } catch (err) {
      console.error("Error processing WebSocket message:", err);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const senderMeta = ws.deserializeAttachment() as ConnectedClient | null;
    const remaining = this.getActiveCollaborators().filter((u) => u.id !== senderMeta?.id);

    this.broadcast(
      JSON.stringify({
        type: "presence_leave",
        userId: senderMeta?.id,
        activeCollaborators: remaining,
      }),
      ws
    );

    // If no more users in the room, immediately flush changes to R2
    if (this.state.getWebSockets().length <= 1) {
      await this.flushToR2();
    }
  }

  async webSocketError(ws: WebSocket, error: any) {
    console.error("WebSocket error:", error);
  }

  private scheduleFlush() {
    // In Durable Objects, we can flush periodically
    if (this.dirty) {
      this.state.waitUntil(
        new Promise((resolve) => setTimeout(resolve, 2500)).then(() => this.flushToR2())
      );
    }
  }

  private broadcast(msg: string, senderToExclude?: WebSocket) {
    for (const ws of this.state.getWebSockets()) {
      if (senderToExclude && ws === senderToExclude) continue;
      try {
        ws.send(msg);
      } catch (err) {
        console.error("Error broadcasting to socket:", err);
      }
    }
  }

  private getActiveCollaborators(): ConnectedClient[] {
    const list: ConnectedClient[] = [];
    for (const ws of this.state.getWebSockets()) {
      try {
        const meta = ws.deserializeAttachment() as ConnectedClient;
        if (meta && meta.email) {
          list.push(meta);
        }
      } catch {}
    }
    return list;
  }
}
