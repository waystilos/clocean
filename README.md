# Clocean

Clocean is an open-source collaborative workspace built to run entirely on Cloudflare (Workers, Pages, R2, and Durable Objects).

Clocean is engineered without needing a traditional database like Postgres, MySQL, or MongoDB. All workspace trees, document content, sprint tasks, and uploaded files live directly in Cloudflare R2 as structured JSON and binary objects.

Deployment costs depend on usage and your Cloudflare plan. The app uses R2 object storage rather than a separately provisioned database; review your account's billing before deployment.

---

## What's Inside

- **Workspaces & Organizations**: The top-level team container (e.g., `Clocean Main`, `Engineering`). Each workspace provides an isolated environment for team members, role permissions (Owner, Admin, Member), documents, sprint boards, and R2 storage (`workspaces/{wsId}/`). Switch between organizations instantly via the sidebar switcher.
- **Docs & Collaborative Canvas**: Real-time multiplayer document authoring canvas powered by Cloudflare Durable Objects. Features live cursors, revision history, tag pills (`#launch`), circular checklists, markdown export, and auto-flushing directly to R2.
- **Workspace Navigation & Pages**: Sidebar workspace switcher, pages, Databases, Templates, Import, Trash, and a Report a bug link. File uploads live in Files; the sidebar has no upload action. On small screens, the Workspace button opens the sidebar.
- **Snaps Visual Panel**: Design mockups, photos, and clippings live alongside documents in a collapsible right "Snaps" panel with visual preview cards, instant snap uploads, and discussion threads.
- **Files & Cloudflare Drive**: Upload PDFs, design specs, text files, and images directly to R2. Dedicated file manager with folder organization, authenticated previews, and $0 bandwidth egress charges.
- **Workspace & Document Invites**: Share a workspace or document with a link (`?join=workspaceId` or `?join=ws&doc=docId`). Teammates authenticate through Cloudflare Access before joining.
- **Sprint Tasks & Boards**: Create separate Kanban boards and typed work items for tasks, bugs, features, improvements, or questions, with notes, comments, assignees, tags, and calendar due dates.
- **Custom Profile Avatars**: Upload profile photos directly to R2 with instant client preview and edge-cached streaming.
- **Zero-Database Architecture**: Every piece of data is stored in R2. Writes to tree structures use R2 HTTP ETags (`If-Match`) for optimistic concurrency control so edits never overwrite each other silently.
- **Authentication**: Production uses cryptographically verified Cloudflare Access JWTs and workspace membership checks. The one-click setup provisions an Access App Launcher and email-code sign-in for approved addresses; [Google and GitHub sign-in each require their own OAuth client](docs/ONE_CLICK_DEPLOY.md#google-and-github-oauth-sign-in). There is no direct Apple sign-in option. Local development keeps mock identity and OTP helpers for testing.
- **Production sign-in URL**: Share the deployed Clocean app hostname (`https://<app>.workers.dev` or your custom app domain), not the `*.cloudflareaccess.com` team-domain root. The app hostname opens Clocean's login page; the team-domain root is a separate Cloudflare App Launcher.
- **Design System**: Obsidian Dark (`#1C1C1A`) and Warm Parchment (`#FAF8F5`) themes, using Spectral for serif brand typography and Schibsted Grotesk for the interface.

---

## How It Works Under the Hood

### Feature status and everyday use

- **Databases:** Open Databases from the sidebar or embed a database in a page. Create databases and records, edit cells and schemas, search and filter records, and delete with confirmation. Table is the editing view; Cards summarizes records. Text/number/person/URL cells save on Enter or blur; Escape discards the draft. Empty select cells show Empty, and clearing a cell saves `null`. Database deletion is permanent.
- **Notes, files, tasks, and snaps:** Files owns upload and folder organization. Page and file deletion moves items into recoverable Trash. See the [UX review](docs/UX_REVIEW.md) for workflow coverage and limitations.
- **Templates, Import, and Trash:** Choose from three page templates; import `.md`, `.markdown`, or `.txt` files up to 1 MB each as new pages; restore deleted pages, files, and folders from Trash. Imported files never overwrite an existing page. Trash has no permanent-delete or automatic expiration control yet.
- **Design:** both themes use the shared typography and color tokens, visible keyboard focus, and a horizontally scrollable database table. The database panel fits the available width.

Any code change that changes user behavior, API contracts, storage, or setup must update the corresponding documentation in the same change. Record remaining limitations rather than describing planned features as shipped.

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
Open `http://localhost:3000`. Local development uses mock identity and OTP helpers, so no email provider is required.

Existing-user sign-in sends only the email and sign-in purpose when requesting a code; setup-only name/workspace fields are omitted. This avoids rejecting sign-in with an empty name. Verification likewise omits setup fields for sign-in. Production continues to require Cloudflare Access.

To test multi-user collaboration locally, open a second browser window in incognito mode or visit with a different email.

---

## Running Tests

### 1. Vitest Unit & Integration Suite

The integration suites require a **local development Worker on port 8787**. They mutate test data, so use an isolated local state directory; never point them at production. Build first so the Worker can serve the static assets tested by the suite:

```bash
npm run build
npm run worker:dev -- --persist-to /private/tmp/clocean-tests
# In a second terminal:
npm test
```

`worker:dev` explicitly selects local emulation and development authentication. The production Wrangler configuration stays in production mode. `test:unit` currently aliases the entire Vitest suite and also requires the Worker; it is not a component-only test command.

```bash
npm test
```
Runs the Vitest integration and security suites covering:
- Embedded databases & schema querying
- Minimalist workspace navigation and sidebar rendering
- Circular checklists and Markdown WYSIWYG renderer
- Document CRUD and revision history
- R2 byte-range file streaming
- Local-only invite links and OTP verification
- Avatar uploads and edge image streaming
- Durable Object WebSockets and room isolation
- Security boundaries (Access JWT validation, workspace authorization, path traversal sanitization, CSWSH protection, XSS defense headers, and authenticated file previews)

### 2. Cypress End-to-End Suite
```bash
# Run headless Cypress E2E test suite against built preview bundle
npm run test:e2e

# Or launch the interactive Cypress test dashboard:
npm run cypress:open
```
Runs browser UI journeys against a built preview with intercepted API responses. These tests verify client interactions, not persistence, production authentication, or real multiplayer behavior. The preview uses port 4173 and fails if that port is occupied; an interrupted Cypress process reports failure. The interactive runner requires a separately running preview on port 4173.

The Cypress scenarios cover:
- Loading the application and navigating the minimalist sidebar (emoji doc icons, quick actions, `+ Add snap`)
- Editing documents with amber tag pills, circular task checklists, and floating action bar
- Opening and editing embedded databases in a page
- Opening and interacting with the collapsible right Snaps panel, UI snapshot preview cards, and discussion threads

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
This builds the React frontend (`npm run build`) and deploys both the Worker and static assets with `wrangler deploy`. The deploy scripts invoke npm internally, so they do not require pnpm at deployment time once dependencies are installed.

### Step 3: Set up Cloudflare Zero Trust
Production requires Cloudflare Access. If you want corporate SSO (Google Workspace, GitHub, Okta) or domain-wide access control:
1. Go to your Cloudflare Dashboard > **Zero Trust** > **Access** > **Applications**.
2. Add an application for your domain (e.g. `clocean.yourcompany.com`).
3. Set your access policies (e.g., allow emails ending in `@yourcompany.com`).
4. Clocean verifies the Access JWT and uses the authenticated Access identity in production. Protect a custom domain or the exact Worker hostname with the Access application before inviting users.

For automated Zero Trust provisioning via code, check out [`infra/`](infra/README.md) for a ready-to-use TypeScript Pulumi configuration.

---

## Project Structure

```
clocean/
├── src/                       # React 19 Single Page App
│   ├── components/            # Header, Sidebar, Modals, Markdown renderer
│   ├── views/                 # Dashboard, Notes, Editor, Documents, Tasks
│   └── styles/                # Design tokens (warm parchment palette)
├── worker/                    # Cloudflare Worker backend
│   ├── index.ts               # Hono API router & WebSocket handler
│   ├── schemas.ts             # Zod validation schemas
│   ├── storage/r2Db.ts        # R2 JSON database abstraction with ETags
│   ├── durable_objects/       # DocSessionDO for multiplayer editing
│   ├── auth/                  # Local OTP, session HMAC, and Cloudflare Access
│   └── notifications/         # Mention, comment, and invitation notifications
├── tests/                     # Vitest integration and security suites
├── cypress/                   # Cypress E2E test specs (Workspace UI, Embedded databases)
├── cypress.config.ts          # Cypress configuration
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
- [UX Review and Feature Limitations](docs/UX_REVIEW.md)
- [R2 Database & Schema Reference](docs/R2_DATABASE.md)
- [Zero Trust Deployment Guide](docs/ONE_CLICK_DEPLOY.md)
- [Infrastructure as Code (Pulumi)](infra/README.md)
- [Developer & Contributor Guide](AGENTS.md)

## Feedback and Bug Reports

Use **Report a bug** in the sidebar to open the [GitHub issue form](https://github.com/waystilos/clocean/issues/new/choose). Read [Bugs and Feature Feedback](BUGS.md) before posting. Bug reports and feature ideas are welcome; code contributions and pull requests are paused while the project is being consolidated.

---

## License

MIT
