# Clocean

Clocean is an open-source collaborative workspace built to run entirely on Cloudflare (Workers, Pages, R2, and Durable Objects).

Think of it like Notion or Craft, but without needing a traditional database like Postgres, MySQL, or MongoDB. All workspace trees, document content, sprint tasks, and uploaded files live directly in Cloudflare R2 as structured JSON and binary objects.

Because it runs on Cloudflare's serverless edge and R2 has zero egress fees, you can self-host a full team workspace for basically $0/month.

---

## What's Inside

- **Collaborative Document Editor**: Write documents with rich markdown, interactive checklists, code blocks, and linked attachments. Multi-user editing is powered by Cloudflare Durable Objects over WebSockets with live cursor tracking.
- **Notion-Style Workspace & Doc Invites**: Share a workspace or document with a link (`?join=workspaceId` or `?join=ws&doc=docId`). Teammates already logged in can join with one click, while new teammates verify their email with a 6-digit OTP code and get added to the team roster automatically.
- **Sprint Tasks & Deadlines**: Kanban board (`To Do`, `In Progress`, `Done`) and table view with assignees, tags, and calendar due dates. Includes an edge worker routine that flags upcoming deadlines within 48 hours and sends email alerts.
- **Cloudflare Drive & Photo Moodboards**: Upload PDFs, design specs, and images directly to R2. Images are indexed into moodboard albums with in-app previews and no bandwidth egress charges.
- **Custom Profile Avatars**: Upload profile photos directly to R2 with instant client preview and edge-cached streaming.
- **Zero-Database Architecture**: Every piece of data is stored in R2. Writes to tree structures use R2 HTTP ETags (`If-Match`) for optimistic concurrency control so edits never overwrite each other silently.
- **Dual Authentication**: Works out of the box with 6-digit email OTPs and cryptographically signed HMAC session tokens. In production behind Cloudflare Zero Trust, it automatically reads `Cf-Access-Authenticated-User-Email` headers (free for up to 50 users).
- **Design**: Built with a warm parchment aesthetic, using Spectral for serif typography and Schibsted Grotesk for the interface.

---

## How It Works Under the Hood

```
                         Browser (React 19 SPA)
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       REST API (/api/*)             WebSockets (/api/collab/*)
                │                             │
                ▼                             ▼
        Cloudflare Worker             Durable Object (DocSessionDO)
       (Hono Edge Router)            (Live room memory & cursor sync)
                │                             │
                │                             │ Debounced flush
                └──────────────┬──────────────┘
                               ▼
                      Cloudflare R2 Bucket
             ├── workspaces/{wsId}/tree.json
             ├── workspaces/{wsId}/docs/{id}/content.json
             ├── workspaces/{wsId}/tasks.json
             ├── workspaces/{wsId}/members.json
             └── workspaces/{wsId}/files/{id}/{filename}
```

1. **Routing & Static Assets**: The frontend is a React 19 app bundled with Vite and served via Cloudflare Workers Static Assets (`env.ASSETS`). The API is handled by [Hono](https://hono.dev/) inside `worker/index.ts`.
2. **Real-Time Sync**: When users open the same document, their browsers connect to a Durable Object (`DocSessionDO`) over WebSockets. The Durable Object broadcasts character edits and cursor movements in real time, then debounces and flushes the content back to R2.
3. **Optimistic Locking**: File trees and documents use R2 HTTP ETags. If two people rename or move items simultaneously, the second write checks `If-Match: etag` to prevent accidental overwrites.

---

## Quickstart (Local Development)

You'll need Node 20+, `pnpm` (or `npm`), and a Cloudflare account if you plan to deploy.

### 1. Clone & install dependencies
```bash
git clone https://github.com/waystilos/clocean.git
cd clocean
pnpm install
```

### 2. Start the local worker
In one terminal, start Wrangler with local R2 and Durable Object emulation:
```bash
pnpm worker:dev
```
The edge API will be running on `http://127.0.0.1:8787`.

### 3. Start the frontend
In a second terminal, start Vite:
```bash
pnpm dev
```
Open `http://localhost:3000`. You'll be prompted to complete a quick workspace setup and verify your email.

To test multi-user collaboration locally, open a second browser window in incognito mode or visit with a different email.

---

## Running Tests

The test suite runs with Vitest and tests the full edge API, authentication, R2 schemas, and multiplayer sync:

```bash
pnpm test
```

This runs 12 test suites (126 tests) covering:
- Document CRUD and revision history
- R2 byte-range file streaming
- Notion-style invite links and OTP verification
- Avatar uploads and edge image streaming
- Durable Object WebSockets and room isolation
- Enterprise security (path traversal sanitization, CSWSH protection, XSS defense headers)

---

## Deploying to Cloudflare

### Step 1: Create your R2 storage bucket
```bash
pnpm setup:r2
```
This runs Wrangler to create the `clocean-storage` bucket in your Cloudflare account.

### Step 2: Build and deploy
```bash
pnpm deploy
```
This builds the React frontend (`pnpm build`) and deploys both the worker and static assets with `wrangler deploy`.

### Step 3: (Optional) Set up Cloudflare Zero Trust
If you want corporate SSO (Google Workspace, GitHub, Okta) or domain-wide access control:
1. Go to your Cloudflare Dashboard > **Zero Trust** > **Access** > **Applications**.
2. Add an application for your domain (e.g. `clocean.yourcompany.com`).
3. Set your access policies (e.g., allow emails ending in `@yourcompany.com`).
4. Clocean automatically detects Cloudflare Access headers in production.

For automated Zero Trust provisioning via code, check out [`infra/`](infra/README.md) for a ready-to-use TypeScript Pulumi configuration.

---

## Project Structure

```
clocean/
├── src/                       # React 19 Single Page App
│   ├── components/            # Header, Sidebar, Modals, Markdown renderer
│   ├── views/                 # Dashboard, Editor, Documents, Tasks, Photos
│   └── styles/                # Design tokens (warm parchment palette)
├── worker/                    # Cloudflare Worker backend
│   ├── index.ts               # Hono API router & WebSocket handler
│   ├── schemas.ts             # Zod validation schemas
│   ├── storage/r2Db.ts        # R2 JSON database abstraction with ETags
│   ├── durable_objects/       # DocSessionDO for multiplayer editing
│   ├── auth/                  # Email OTP, session HMAC, and Cloudflare Access
│   └── notifications/         # Email notifications & deadline scanner
├── tests/                     # 12 Vitest suites (126 integration tests)
├── docs/                      # Architectural deep dives
│   ├── ARCHITECTURE.md        # Edge layers, WebSockets, and data flow
│   ├── R2_DATABASE.md         # R2 JSON database schema and concurrency
│   └── ONE_CLICK_DEPLOY.md    # Deployment and Zero Trust guide
├── infra/                     # Optional TypeScript Pulumi IaC
└── wrangler.jsonc             # Cloudflare Workers, Pages & R2 bindings
```

---

## Documentation

- [System Architecture](docs/ARCHITECTURE.md)
- [R2 Database & Schema Reference](docs/R2_DATABASE.md)
- [Zero Trust Deployment Guide](docs/ONE_CLICK_DEPLOY.md)
- [Infrastructure as Code (Pulumi)](infra/README.md)
- [Developer & Contributor Guide](AGENTS.md)

---

## License

MIT
