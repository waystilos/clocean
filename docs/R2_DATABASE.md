# Cloudflare R2 as a JSON Database

This document details how **Clocean** uses **Cloudflare R2** as both an object storage system and a lightweight, distributed document database.

---

## The Core Concept

Traditional serverless applications often rely on external databases (PostgreSQL, Supabase, DynamoDB) which introduce:
* Monthly baseline hosting fees ($25–$150/mo).
* VPC configuration and connection pooling bottlenecks.
* Bandwidth egress fees when reading or transferring media.

By treating Cloudflare R2 as our primary datastore:
1. **Zero Database Maintenance**: No clusters, vacuuming, connection limits, or provisioned IOPS.
2. **Zero Egress Fees**: Downloading documents, photos, and files costs **$0.00** in network bandwidth.
3. **Read-After-Write Consistency**: R2 provides strong read-after-write consistency globally for all PUT and GET operations.

---

## Key Hierarchy & Data Models

All application state is organized hierarchically inside the `clocean-storage` R2 bucket:

```text
workspaces/registry/
├── users/
│   └── {email}.json                   # User's registered workspaces & assigned roles
└── otp/
    └── {email}.json                   # 6-digit OTP hash, salt, expiration, attempts

workspaces/{workspaceId}/              # Multi-tenant partitioned team root (e.g. 'default', 'ws-design')
├── meta.json                          # Workspace metadata (name, icon, owner, createdAt)
├── members.json                       # Team roster (emails, names, avatars, roles: owner/admin/member)
├── tree.json                          # Workspace File & Document Hierarchy
├── databases/
│   ├── index.json                     # Authoritative database schemas and registry
│   └── {dbId}/
│       ├── schema.json                # Creation-time compatibility snapshot; index is authoritative
│       └── records.json               # Records, cell property values, and timestamps
├── tasks.json                         # Default Sprint Kanban Board and work items
├── task-boards.json                   # Task board registry
├── task-boards/{boardId}.json         # Tasks for additional boards
├── photos.json                        # Photos Gallery Index
├── activity.json                      # Workspace Changelog
├── favorites.json                     # Pinned and starred documents per user
├── public/
│   └── {token}.json                   # Anonymous read-only document share mappings
├── users/
│   └── {email}.json                   # User Profile & Preferences
├── avatars/
│   └── {email}.png                    # User Profile Picture (Binary)
├── docs/
│   └── {docId}/
│       ├── content.json               # Document Blocks & Attachments
│       ├── revisions.json             # Document version snapshots
│       └── comments.json              # Comments and @mentions
└── files/
    └── {fileId}/
        └── {filename}                 # Uploaded Binary File (PDF, ZIP, image)
```

---

## JSON Schemas

### 1. Workspace Tree (`workspaces/default/tree.json`)
The complete index of all folders, documents, and files in the workspace.
```json
{
  "workspaceId": "default",
  "updatedAt": "2026-09-21T20:00:00.000Z",
  "nodes": [
    {
      "id": "doc-manifesto",
      "name": "Launch overview & design manifesto",
      "type": "doc",
      "parentId": null,
      "size": 0,
      "updatedAt": "2 hours ago",
      "createdAt": "2026-09-21T18:00:00.000Z",
      "tags": ["#launch", "#ocean-concept", "#notes"]
    },
    {
      "id": "file-brand-guidelines",
      "name": "Brand system guidelines.pdf",
      "type": "file",
      "parentId": null,
      "size": 13002342,
      "mimeType": "application/pdf",
      "updatedAt": "Oct 24",
      "createdAt": "2026-09-20T10:00:00.000Z",
      "r2Key": "workspaces/default/files/file-brand-guidelines/Brand system guidelines.pdf"
    }
  ]
}
```

### 2. Document Content (`workspaces/default/docs/{docId}/content.json`)
Holds the body text, checklists, and linked attachments for a document.
```json
{
  "id": "doc-manifesto",
  "title": "Launch overview & design manifesto",
  "tags": ["#launch", "#ocean-concept", "#notes"],
  "content": "Our vision for Clocean is simple: to build a productivity system that feels like a physical desk on a rainy afternoon.\n\n## Core Priorities\n- [x] Sign off on branding direction\n- [ ] Export finalized SVG icons\n- [ ] Review copy and document structure",
  "updatedAt": "2026-09-21T21:30:00.000Z",
  "attachments": [
    {
      "id": "file-moodboard",
      "name": "moodboard.png",
      "type": "image/png",
      "size": 4404019,
      "url": "/api/files/file-moodboard/moodboard.png"
    }
  ]
}
```

### 3. User Profile (`workspaces/default/users/{email}.json`)
Stores display names and avatar links.
```json
{
  "email": "alex@clocean.co",
  "name": "Alex Sterling",
  "avatar": "/api/user/avatar/alex%40clocean.co?t=1790033159235",
  "bio": "Product Architect",
  "updatedAt": "2026-09-21T21:00:00.000Z"
}
```

### 4. Verification OTP Record (`workspaces/registry/otp/{email}.json`)
Stores salted SHA-256 OTP hashes with rate-limiting and replay protection.
```json
{
  "email": "sarah.connor@sky.net",
  "codeHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "salt": "a4d3f18e-28bb-4b92-8083-d5cecf605d3b",
  "expiresAt": 1790033600000,
  "attempts": 0,
  "lastSentAt": 1790033000000,
  "metadata": {
    "purpose": "join",
    "workspaceId": "ws-engineering"
  }
}
```

### 5. Team Members Roster (`workspaces/{wsId}/members.json`)
Stores team members and their permission levels.
```json
{
  "workspaceId": "ws-engineering",
  "members": [
    {
      "email": "alex@clocean.co",
      "name": "Alex Sterling",
      "role": "owner",
      "avatar": "/api/user/avatar/alex%40clocean.co",
      "joinedAt": "2026-09-21T18:00:00.000Z"
    },
    {
      "email": "elena@clocean.co",
      "name": "Elena Rostova",
      "role": "admin",
      "avatar": "/api/user/avatar/elena%40clocean.co",
      "joinedAt": "2026-09-21T19:30:00.000Z"
    }
  ]
}
```

### 6. Tasks with Calendar Due Dates (`workspaces/{wsId}/tasks.json`)
Stores typed work items with assignees, notes, discussion, and optional due dates. `type` is one of `task`, `bug`, `feature`, `improvement`, or `question`; older records may omit it and are treated as tasks.
```json
[
  {
    "id": "task-security-audit",
    "title": "Submit Cloudflare Zero Trust Audit",
    "type": "task",
    "status": "in_progress",
    "priority": "high",
    "description": "Capture the current Access policy and attach the review notes.",
    "dueDate": "2026-10-15",
    "assignee": {
      "name": "Alex Sterling",
      "email": "alex@clocean.co",
      "avatar": "/api/user/avatar/alex%40clocean.co"
    },
    "tags": ["#security", "#audit"],
    "comments": [
      {
        "id": "comment-1",
        "text": "The evidence folder is ready for review.",
        "user": { "name": "Workspace owner", "email": "owner@example.com" },
        "createdAt": "2026-10-14T09:00:00.000Z"
      }
    ],
  }
]
```

The authenticated API supports `POST /api/tasks/:taskId/comments` for discussion and `DELETE /api/tasks/:taskId` for direct work-item removal. Both routes enforce workspace membership and use the board's R2 ETag for optimistic concurrency.

### 7. Task Boards Registry (`workspaces/{wsId}/task-boards.json`)
Stores the workspace's task boards metadata, custom columns, WIP limits, and presentation settings:
```json
[
  {
    "id": "default",
    "name": "General Tasks",
    "description": "Primary sprint board for day-to-day deliverables",
    "icon": "⚡",
    "color": "#1E7D6B",
    "columns": [
      { "id": "todo", "title": "To Do", "color": "#787672" },
      { "id": "inprogress", "title": "In Progress", "color": "#1E7D6B", "wipLimit": 5 },
      { "id": "done", "title": "Done", "color": "#2E7D32" }
    ],
    "defaultView": "board",
    "defaultPriority": "medium",
    "updatedAt": "2026-09-22T17:00:00.000Z"
  }
]
```

- **Board APIs**:
  - `GET /api/task-boards`: Retrieves all boards with fallback default columns.
  - `POST /api/task-boards`: Creates a new board with custom columns, icon, color, and WIP limits.
  - `PATCH /api/task-boards/:boardId`: Updates board metadata and workflow columns (supported for both default and custom boards).
  - `DELETE /api/task-boards/:boardId`: Deletes a custom board and purges its tasks (protected: default board cannot be deleted).
  - `POST /api/task-boards/:boardId/clear-completed`: Prunes all tasks in the "done" column in a single optimistic ETag transaction.
  - `POST /api/task-boards/:boardId/clear-all`: Clears all tasks on the board.

Additional boards store their tasks under `workspaces/{wsId}/task-boards/{boardId}.json`. The default board remains backwards-compatible with `tasks.json`.

In production, the first authenticated Cloudflare Access request removes the historical demo roster from the default workspace and registers the real Access identity. Subsequent roster changes are stored in `members.json`; owners and admins can remove non-owner members through the authenticated API.

### 8. Photos Gallery Registry (`workspaces/{wsId}/photos.json`)
Stores visual inspirations, project moodboards, and photo metadata with direct R2 streaming URLs:
```json
[
  {
    "id": "photo-moodboard-1",
    "name": "Brand Design System.png",
    "url": "/api/files/photo-moodboard-1/Brand%20Design%20System.png",
    "album": "Inspirations",
    "size": 2450120,
    "createdAt": "2026-09-22T12:00:00.000Z"
  }
]
```

### 9. Notes, folders, and authenticated file previews

Notes and folders share `tree.json`. Each node stores a `parentId`, allowing arbitrary nesting while document content remains in `docs/{docId}/content.json`. Uploaded files use `files/{fileId}/{filename}` and are served through authenticated API requests. The browser fetches files with its session token, creates temporary blob URLs for image, PDF, or text previews, and revokes those URLs after use.

---

## Concurrency Control with HTTP ETags

Database record patches merge only the supplied property keys. A property value of `null` explicitly clears a cell; omitted properties stay unchanged. Unknown or unsafe property IDs remain invalid even when their value is null. Empty select values must not be displayed as the schema's first option.

`databases/index.json` is authoritative for both database lists and record validation. Schema updates use one conditional write to the index, so a successful response cannot leave a stale list/schema pair. `schema.json` is retained as a creation-time compatibility snapshot, not read as the current schema. Database creation and deletion still touch several objects, and R2 does not provide a transaction across them. Clients surface 409 conflicts.

`tree.json` contains active `nodes` plus optional `trash` entries with a deleted root ID, name, timestamp, and retained subtree. `GET /api/tree` exposes only active nodes; `GET /api/trash` exposes summaries; `POST /api/trash/:id/restore` restores the subtree with an ETag write. If an ancestor folder is missing, its child returns to the root. Document content and uploaded bytes remain in R2 while in Trash, and public document shares return 404 until restored. Restoring a previously public page makes its old share link work again unless sharing is revoked. There is currently no permanent purge or automatic retention period.

To prevent race conditions when two users modify the file tree simultaneously, `worker/storage/r2Db.ts` implements optimistic concurrency using **HTTP ETags**. If the ETag no longer matches, the write fails and the API returns a conflict so the client can reload before retrying. It is never silently downgraded to an unconditional write:

```typescript
// 1. Fetch data along with its current ETag
const { data, etag } = await db.getJson<WorkspaceTree>("workspaces/default/tree.json");

// 2. Perform modification
data.nodes.push(newNode);

// 3. Write back with conditional 'onlyIf' match
const res = await bucket.put("workspaces/default/tree.json", JSON.stringify(data), {
  onlyIf: { etagMatches: etag }
});

if (!res) {
  throw new Error("Concurrency collision: tree was modified by another user");
}
```

If another user modified the tree during the operation, the write is aborted, ensuring tree consistency without database row-level locking.

---

## Binary Streaming & Byte Ranges

Files stored in R2 (such as large PDFs or MP4 videos) are streamed directly through Cloudflare Workers without loading the entire file into RAM:

```typescript
// worker/index.ts
const object = await env.CLOCEAN_STORAGE.get(r2Key, {
  range: request.headers, // Supports HTTP 206 Partial Content (Range: bytes=0-1024)
});

const headers = new Headers();
object.writeHttpMetadata(headers);
headers.set("etag", object.httpEtag);

return new Response(object.body, { headers, status: 200 });
```
This enables smooth video seeking, PDF streaming, and fast file downloads directly from Cloudflare's edge.
