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
workspaces/{workspaceId}/
├── tree.json                          # Workspace File & Document Hierarchy
├── tasks.json                         # Sprint Kanban Board
├── photos.json                        # Photos Gallery Index
├── activity.json                      # Workspace Changelog
├── users/
│   └── {email}.json                   # User Profile & Preferences
├── avatars/
│   └── {email}.png                    # User Profile Picture (Binary)
├── docs/
│   └── {docId}/
│       └── content.json               # Document Blocks & Attachments
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

---

## Concurrency Control with HTTP ETags

To prevent race conditions when two users modify the file tree simultaneously, `worker/storage/r2Db.ts` implements optimistic concurrency using **HTTP ETags**:

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
