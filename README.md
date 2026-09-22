# Clocean — Notion + Google Drive Platform on Cloudflare

> [!IMPORTANT]
> **Work in Progress (WIP)**: Clocean is currently under active development and undergoing testing. One-click deploy will be enabled once full production readiness is finalized.

**Clocean** is a unified workspace combining rich block document editing (Notion-style) with asset storage and file management (Google Drive-style), built specifically for Cloudflare's serverless edge ecosystem.


By replacing traditional relational or NoSQL databases with **Cloudflare R2 as both the file store and the JSON database**, Clocean operates at virtually **$0/month in database costs** with **zero egress fees**.

Real-time multiplayer document editing is powered by **Cloudflare Durable Objects with WebSockets**, while user identity and access control are handled seamlessly by **Cloudflare Zero Trust / Access** (free for up to 50 active team members).

The user interface strictly replicates the **Figma Design System** (`Clocean - Active`), featuring **Spectral** and **Schibsted Grotesk** typography, dark obsidian `#1C1C1A`, and warm parchment light mode `#FAF8F5`.

---

## Documentation Index

- **[System Architecture](docs/ARCHITECTURE.md)**: Deep dive into the 4 architectural layers, Hono API, Durable Objects, and WebSocket hibernation.
- **[Deployment Guide](docs/ONE_CLICK_DEPLOY.md)**: Step-by-step instructions for deployment and Cloudflare Access setup for 50 free users.
- **[R2 JSON Database Guide](docs/R2_DATABASE.md)**: JSON schemas, optimistic concurrency control via HTTP ETags, and streaming file uploads.
- **[Developer & Contributor Guide](AGENTS.md)**: Engineering constraints, coding patterns, and operational rules for developers.
- **[Pulumi Zero Trust IaC](infra/README.md)**: Optional TypeScript IaC program to automate Cloudflare Zero Trust Access policies.

---

## Architecture Overview

```
                                  ┌──────────────────────────────────────────────┐
                                  │       Cloudflare Zero Trust / Access         │
                                  │     (Free up to 50 users, JWT Headers)       │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                                         ▼
                               ┌─────────────────────────────────────────────────────┐
                               │             Cloudflare Pages / Assets               │
                               │        (Vite + React 19 Frontend Application)       │
                               └──────────────┬───────────────────────────────┬──────┘
                                              │ REST API                      │ WebSockets (/api/collab/:id)
                                              ▼                               ▼
                            ┌───────────────────────────┐    ┌─────────────────────────────────┐
                            │    Cloudflare Worker      │    │    Cloudflare Durable Object    │
                            │ (R2 Storage & Tree CRUD)  │    │ (In-memory Room State & Sync)   │
                            └─────────────┬─────────────┘    └────────────────┬────────────────┘
                                          │                                   │ Periodic / Idle
                                          │                                   │ Debounced Flush
                                          ▼                                   ▼
                     ┌─────────────────────────────────────────────────────────────────────────────┐
                     │                           Cloudflare R2 Bucket                              │
                     │  • Tree / File Hierarchy:  workspaces/{wsId}/tree.json                      │
                     │  • Document Content:       workspaces/{wsId}/docs/{docId}/content.json      │
                     │  • Uploaded Binary Files:  workspaces/{wsId}/files/{fileId}/{filename}      │
                     │  • Kanban Tasks:           workspaces/{wsId}/tasks.json                     │
                     │  • User Preferences:       workspaces/{wsId}/users/{email}.json             │
                     └─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Notion-Style Document Editor
* **Live Multiplayer Multi-Editing**: Multiple teammates can type, edit, and select text simultaneously. Connected users display real-time colored cursor carets and name tags.
* **Interactive Checklists**: Checkboxes with instant state toggling.
* **Floating Formatting Toolbar**: Quick headings (`H1`), bold, italic, links, embedded photos, checklists, and bulleted lists.
* **Document Attachments Sidebar**: Direct association between written documentation and files stored in Cloudflare R2 (e.g. `moodboard.png`, `brand_v2.pdf`).

### 2. Google Drive-Style Cloudflare Storage
* **Zero Egress Fees**: Store large files (PDFs, ZIPs, photos, videos, spreadsheets) in Cloudflare R2 without bandwidth charges.
* **Drag-and-Drop Uploader**: Direct streaming multipart upload to R2.
* **Table & Grid Views**: Displays file names, file sizes, last modified times, and quick action menus.
* **File Previews**: In-app previews for PDFs, images, and documents with one-click downloads.

### 3. Task Board & Photos Gallery
* **Kanban Sprint Board**: Interactive columns (`To Do`, `In Progress`, `Done`) with assignee avatars and due dates.
* **Photos Moodboard**: 4-column curated image gallery with responsive tabs (`All`, `Albums`, `Recent`) and full-screen lightbox viewing.

### 4. Zero-Cost JSON Database on R2
* Instead of running an expensive PostgreSQL or MongoDB cluster, all structured data models are saved as atomic JSON files in R2:
  * `tree.json`: Hierarchical workspace tree (pages, folders, files).
  * `docs/{docId}/content.json`: Rich text block content and attachments.
  * `tasks.json`: Sprint tasks and assignees.
  * `activity.json`: Audit log of recent edits and uploads.
* Uses **HTTP ETags (`If-Match`)** for optimistic concurrency control to prevent conflicting writes during concurrent tree renames or file moves.

### 5. Authentication: Cloudflare Zero Trust (Free for up to 50 Users)
* Authenticated using Cloudflare Access headers:
  * `Cf-Access-Authenticated-User-Email`
  * `Cf-Access-Jwt-Assertion`
* No database tables, password hashing, or salt management needed.

---

## Deployment (Command Line / Wrangler)

> [!NOTE]
> The automated 1-Click "Deploy with Workers" button is temporarily disabled while the platform is under active development. You can deploy directly via the command line below.

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/waystilos/clocean.git
   cd clocean
   pnpm install
   ```

2. Provision the Cloudflare R2 bucket:
   ```bash
   ./scripts/setup-r2.sh
   # Or directly: npx wrangler r2 bucket create clocean-storage
   ```

3. Deploy the application:
   ```bash
   pnpm deploy
   ```

Your application will be live globally on Cloudflare Workers and Pages!

---

## Local Development

Run the full local stack (Vite + Cloudflare Worker + Miniflare R2 + Durable Objects):

1. Start the Cloudflare Worker with local R2 and Durable Objects emulation:
   ```bash
   pnpm worker:dev
   ```
   *(Listens on `http://127.0.0.1:8787`)*

2. Start the Vite React development server:
   ```bash
   pnpm dev
   ```
   *(Listens on `http://localhost:3000` with hot module replacement and `/api` proxy)*

3. Open two browser windows:
   * Window 1: `http://localhost:3000`
   * Window 2: Open an incognito or separate browser window to collaborate simultaneously and observe real-time live cursor synchronization.

---

## Design System Tokens

Extracted directly from Figma (`Clocean - Active`):

| Token | Dark Mode (Obsidian) | Light Mode (Parchment) |
| :--- | :--- | :--- |
| **Background** | `#1C1C1A` | `#FAF8F5` |
| **Sidebar** | `#141412` | `#F2EDE6` |
| **Cards & Surfaces** | `#232321` | `#FFFFFF` |
| **Borders** | `#2C2C2A` | `#E5E0D8` |
| **Nav Active** | `#2E2E2C` | `#E5DFD5` |
| **Brand Accent** | `#1E7D6B` (Emerald) | `#1E7D6B` (Emerald) |
| **Primary Text** | `#E8E5E0` | `#1C1C1A` |
| **Secondary Text** | `#8E8B84` | `#75736E` |
| **Serif Headings** | `Spectral`, serif | `Spectral`, serif |
| **UI Body Font** | `Schibsted Grotesk` | `Schibsted Grotesk` |

---

## License
MIT License. Created for the Cloudflare serverless community.

