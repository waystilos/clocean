# AGENTS.md — Clocean Developer & AI Agent Guide

Welcome to **Clocean**! This file serves as the definitive reference and operational playbook for any developer or AI coding agent working on this codebase.

---

## What is Clocean?

**Clocean** is a unified, high-performance workspace combining **collaborative block document authoring**, **integrated file management**, and **real-time edge collaboration**, engineered specifically for the **Cloudflare serverless edge ecosystem** (Workers, Pages, R2, and Durable Objects).

---

## Core Architectural Principles (DO NOT VIOLATE)

1. **NO EXTERNAL DATABASES (Zero Database Costs)**:
   - **Never introduce PostgreSQL, MySQL, MongoDB, Supabase, or D1** unless explicitly instructed.
   - **Cloudflare R2 is our database**: All metadata, workspace trees, document content, sprint tasks, and photo registries are stored as structured **JSON files** in the R2 bucket.
   - Concurrency is managed using **R2 HTTP ETags (`If-Match`)** for optimistic locking.

2. **REAL-TIME MULTIPLAYER COLLABORATION VIA DURABLE OBJECTS**:
   - Multi-user editing is handled by the `DocSessionDO` Cloudflare Durable Object over WebSockets.
   - The Durable Object manages in-memory room state, live cursor presence, user color-coding, and broadcasts edits with sub-millisecond edge latency.
   - Edits are debounced and periodically flushed directly into Cloudflare R2 (`workspaces/default/docs/{docId}/content.json`).

3. **AUTHENTICATION VIA CLOUDFLARE ZERO TRUST / ACCESS**:
   - Production relies on Cloudflare Access headers (`Cf-Access-Authenticated-User-Email` and `Cf-Access-Jwt-Assertion`).
   - Cloudflare Zero Trust provides free authentication for up to 50 active users.
   - Do NOT build a password-based auth system or store user passwords.
   - Local development uses mock header / query fallbacks (`?user=marcus`) to test multiplayer features without configuring Zero Trust locally.

4. **FIGMA DESIGN SYSTEM FIDELITY**:
   - Headings & Brand: **`Spectral`** (Serif 500, 600).
   - UI & Body: **`Schibsted Grotesk`** (Sans-serif 400, 500, 600).
   - Dark Theme (Obsidian): `#1C1C1A` background, `#141412` sidebar, `#232321` surface, `#E8E5E0` text.
   - Light Theme (Warm Parchment): `#FAF8F5` background, `#F2EDE6` sidebar, `#FFFFFF` surface, `#1C1C1A` text.
   - Brand Accent: `#1E7D6B` (Emerald/Teal).

---

## Repository Structure

```
clocean/
├── AGENTS.md                  # This file (Agent instructions & project rules)
├── README.md                  # Public overview and 1-Click Deploy button
├── index.html                 # Main HTML with Google Fonts (Spectral & Schibsted Grotesk)
├── package.json               # Scripts & dependencies (React 19, Hono, Lucide, Wrangler)
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite frontend builder with /api proxy to worker
├── wrangler.jsonc             # Cloudflare Workers, Pages, R2 & Durable Objects bindings
│
├── docs/                      # Architectural & Deployment Documentation
│   ├── ARCHITECTURE.md        # Detailed edge architecture & data flow diagrams
│   ├── ONE_CLICK_DEPLOY.md    # One-click deployment & Cloudflare Access setup
│   └── R2_DATABASE.md         # R2 JSON database schema, concurrency, and modeling
│
├── infra/                     # Infrastructure-as-Code (Optional Pulumi)
│   ├── Pulumi.yaml            # Pulumi project file
│   ├── index.ts               # Cloudflare R2 bucket & Zero Trust Access provisioning
│   └── README.md              # Pulumi usage instructions
│
├── scripts/
│   ├── setup-r2.sh            # Automated Cloudflare R2 bucket provisioner
│   └── pulumi-r2-login.sh     # Cloudflare R2 Pulumi state backend login helper
│
├── src/                       # React 19 Single Page Application
│   ├── main.tsx               # App entry point
│   ├── App.tsx                # App shell, routing, modals, and theme provider
│   ├── types.ts               # Frontend TypeScript interfaces
│   ├── styles/
│   │   └── design-tokens.css  # Extracted Figma CSS tokens (Dark/Light themes)
│   ├── components/
│   │   ├── Sidebar.tsx        # Left navigation matching Figma v2-dashboard
│   │   ├── Header.tsx         # Contextual header with breadcrumbs & collaborator avatars
│   │   ├── SearchModal.tsx    # Global Ctrl+K workspace search modal
│   │   ├── SettingsModal.tsx  # Settings dialog with real R2 avatar upload
│   │   ├── CreateWorkspaceModal.tsx # Team organization creation modal
│   │   ├── TeamMembersModal.tsx # Team roster management & invitation modal
│   │   └── FilePreviewModal.tsx # PDF & Image viewer for R2 files
│   └── views/
│       ├── DashboardView.tsx  # Figma v2-dashboard greeting & recent activity
│       ├── EditorView.tsx     # Real-time multi-editing collaborative block editor
│       ├── DocumentsView.tsx  # High-performance file manager with R2 streaming
│       ├── TasksView.tsx      # Kanban sprint board (To Do, In Progress, Done)
│       └── PhotosView.tsx     # 4-column moodboard photo gallery with lightbox
│
└── worker/                    # Cloudflare Worker Backend (Edge API)
    ├── index.ts               # Hono REST API & WebSocket upgrade router
    ├── types.ts               # R2 storage data models & Worker Env
    ├── auth/
    │   └── cfAccess.ts        # Cloudflare Access JWT validation & local dev mock
    ├── durable_objects/
    │   └── DocSessionDO.ts    # Durable Object real-time collaboration engine
    └── storage/
        └── r2Db.ts            # JSON Database abstraction with ETag concurrency on R2
```

---

## R2 Key Conventions

| Key Pattern | Purpose | Concurrency |
| :--- | :--- | :--- |
| `workspaces/registry/users/{email}.json` | User workspace list & assigned roles | Direct JSON write |
| `workspaces/{wsId}/meta.json` | Organization metadata & ownership | Direct JSON write |
| `workspaces/{wsId}/members.json` | Team members roster & roles | Direct JSON write |
| `workspaces/{wsId}/tree.json` | File & document hierarchy index | Optimistic locking via `If-Match` ETags |
| `workspaces/{wsId}/docs/{id}/content.json` | Document body, blocks, attachments | Debounced write from Durable Object |
| `workspaces/{wsId}/tasks.json` | Sprint Kanban tasks & assignees | Direct JSON write |
| `workspaces/{wsId}/photos.json` | Photo gallery registry | Direct JSON write |
| `workspaces/{wsId}/activity.json` | Activity changelog | Appended on upload / edits |
| `workspaces/registry/users/{email}/notifications.json` | User mention notifications & email log | Direct JSON write |
| `workspaces/{wsId}/notifications/outbox.json` | Workspace email dispatch audit outbox | Direct JSON write |
| `workspaces/{wsId}/docs/{id}/comments.json` | Document discussion comments & @mentions | Direct JSON write |
| `workspaces/default/users/{email}.json` | User profiles & display names | Direct JSON write |
| `workspaces/default/avatars/{email}.png` | User profile avatar pictures | Direct binary image stream |
| `workspaces/{wsId}/files/{id}/{name}` | Uploaded files (PDFs, ZIPs, photos) | Byte-range streaming with Content-Type |

---

## Common Workflows & Commands

### 1. Build and Typecheck
Always verify that both frontend and worker typecheck cleanly:
```bash
pnpm build
```

### 2. Run Local Development Stack
```bash
# Starts Cloudflare Worker with local R2 & Durable Objects emulation
pnpm worker:dev

# Starts Vite React dev server on port 3000
pnpm dev
```

### 3. Deploy to Cloudflare
```bash
pnpm deploy
```
*(Runs `pnpm build` and then `wrangler deploy` to push static assets to Pages and edge code to Workers).*

