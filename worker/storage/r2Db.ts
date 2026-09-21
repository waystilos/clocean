import { WorkspaceTree, DocContent, TasksData, PhotosData, ActivitiesData, UserProfile } from "../types.ts";

export class R2Database {
  constructor(private bucket: R2Bucket) {}

  async getJson<T>(key: string): Promise<{ data: T | null; etag: string | null }> {
    const object = await this.bucket.get(key);
    if (!object) return { data: null, etag: null };
    try {
      const text = await object.text();
      const data = JSON.parse(text) as T;
      return { data, etag: object.httpEtag };
    } catch {
      return { data: null, etag: null };
    }
  }

  async putJson<T>(key: string, data: T, ifMatchEtag?: string): Promise<{ ok: boolean; etag: string | null }> {
    const jsonStr = JSON.stringify(data, null, 2);
    const options: R2PutOptions = {
      httpMetadata: {
        contentType: "application/json",
      },
    };
    if (ifMatchEtag) {
      options.onlyIf = {
        etagMatches: ifMatchEtag,
      };
    }

    try {
      const res = await this.bucket.put(key, jsonStr, options);
      return { ok: true, etag: res ? res.httpEtag : null };
    } catch {
      return { ok: false, etag: null };
    }
  }

  async deleteKey(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async getUserProfile(email: string): Promise<UserProfile> {
    const key = `workspaces/default/users/${encodeURIComponent(email)}.json`;
    const res = await this.getJson<UserProfile>(key);
    if (res.data) return res.data;

    const defaultName =
      email === "alex@clocean.co"
        ? "Alex Sterling"
        : email.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const profile: UserProfile = {
      email,
      name: defaultName,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`,
      updatedAt: new Date().toISOString(),
    };
    await this.putJson(key, profile);
    return profile;
  }

  async putUserProfile(profile: UserProfile): Promise<void> {
    const key = `workspaces/default/users/${encodeURIComponent(profile.email)}.json`;
    await this.putJson(key, profile);
  }

  // Seed initial data matching the exact Figma designs if R2 is fresh
  async ensureSeeded(): Promise<void> {
    const tree = await this.getJson<WorkspaceTree>("workspaces/default/tree.json");
    if (!tree.data) {
      const now = new Date().toISOString();

      const initialTree: WorkspaceTree = {
        workspaceId: "default",
        updatedAt: now,
        nodes: [
          {
            id: "doc-manifesto",
            name: "Launch overview & design manifesto",
            type: "doc",
            parentId: null,
            updatedAt: "2 hours ago",
            createdAt: now,
            tags: ["#launch", "#ocean-concept", "#notes"],
          },
          {
            id: "doc-ocean-launch",
            name: "Project ocean launch overview",
            type: "doc",
            parentId: null,
            updatedAt: "2 hours ago",
            createdAt: now,
            tags: ["#launch", "#overview"],
          },
          {
            id: "doc-sprint-14",
            name: "Sprint 14 planning scratchpad",
            type: "doc",
            parentId: null,
            updatedAt: "Oct 23",
            createdAt: now,
            tags: ["#planning", "#sprint"],
          },
          {
            id: "file-archive-zip",
            name: "Archive.zip",
            type: "file",
            parentId: null,
            size: 130023424, // 124 MB
            mimeType: "application/zip",
            updatedAt: "Yesterday",
            createdAt: now,
            r2Key: "workspaces/default/files/file-archive-zip/Archive.zip",
          },
          {
            id: "file-brand-guidelines",
            name: "Brand system guidelines.pdf",
            type: "file",
            parentId: null,
            size: 13002342, // 12.4 MB
            mimeType: "application/pdf",
            updatedAt: "Oct 24",
            createdAt: now,
            r2Key: "workspaces/default/files/file-brand-guidelines/Brand system guidelines.pdf",
          },
          {
            id: "file-dev-roadmap",
            name: "Development roadmap.xlsx",
            type: "file",
            parentId: null,
            size: 460800, // 450 KB
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            updatedAt: "Oct 20",
            createdAt: now,
            r2Key: "workspaces/default/files/file-dev-roadmap/Development roadmap.xlsx",
          },
          {
            id: "file-manifesto-docx",
            name: "manifesto_v2.docx",
            type: "file",
            parentId: null,
            size: 24576, // 24 KB
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            updatedAt: "Oct 19",
            createdAt: now,
            r2Key: "workspaces/default/files/file-manifesto-docx/manifesto_v2.docx",
          },
          {
            id: "file-wireframes-pdf",
            name: "Wireframe layouts.pdf",
            type: "file",
            parentId: null,
            size: 8493465, // 8.1 MB
            mimeType: "application/pdf",
            updatedAt: "Oct 15",
            createdAt: now,
            r2Key: "workspaces/default/files/file-wireframes-pdf/Wireframe layouts.pdf",
          },
          {
            id: "file-moodboard",
            name: "moodboard.png",
            type: "file",
            parentId: null,
            size: 4404019, // 4.2 MB
            mimeType: "image/png",
            updatedAt: "Oct 24",
            createdAt: now,
            r2Key: "workspaces/default/files/file-moodboard/moodboard.png",
          },
        ],
      };
      await this.putJson("workspaces/default/tree.json", initialTree);

      // Seed Document Manifesto
      const manifestoDoc: DocContent = {
        id: "doc-manifesto",
        title: "Launch overview & design manifesto",
        tags: ["#launch", "#ocean-concept", "#notes"],
        content: `Our vision for Clocean is simple: to build a productivity system that feels like a physical desk on a rainy afternoon. No glowing buttons, no AI badges telling you what's "important", and no aggressive neon notifications. Only warm light, clear surfaces, and honest material.

## Core Priorities
- [x] Sign off on branding direction
- [ ] Export finalized SVG icons
- [ ] Review copy and document structure
- [ ] Connect Cloudflare R2 zero-egress buckets

## Technical Blueprint
Clocean replaces heavy SQL servers with structured JSON documents backed by Cloudflare R2. Durable Objects provide in-memory synchronization, ensuring multiple team members can type and collaborate simultaneously with zero latency.`,
        updatedAt: now,
        attachments: [
          {
            id: "file-moodboard",
            name: "moodboard.png",
            type: "image/png",
            size: 4404019,
            url: "/api/files/file-moodboard/moodboard.png",
          },
          {
            id: "file-brand-guidelines",
            name: "brand_v2.pdf",
            type: "application/pdf",
            size: 13002342,
            url: "/api/files/file-brand-guidelines/brand_v2.pdf",
          },
        ],
      };
      await this.putJson("workspaces/default/docs/doc-manifesto/content.json", manifestoDoc);

      // Seed Tasks matching Figma
      const initialTasks: TasksData = {
        updatedAt: now,
        tasks: [
          {
            id: "task-1",
            title: "Define ocean palette values",
            status: "todo",
            dueDate: "Due Oct 29",
            assignee: { name: "Alex Sterling", email: "alex@clocean.co" },
          },
          {
            id: "task-2",
            title: "Configure baseline grid",
            status: "todo",
            dueDate: "Due Nov 2",
            assignee: { name: "Marcus Vance", email: "marcus@clocean.co" },
          },
          {
            id: "task-3",
            title: "Draft typography manifesto",
            status: "inprogress",
            dueDate: "Due Oct 27",
            assignee: { name: "Elena Rostova", email: "elena@clocean.co" },
          },
          {
            id: "task-4",
            title: "Implement warm parchment assets",
            status: "inprogress",
            dueDate: "Due Oct 28",
            assignee: { name: "Alex Sterling", email: "alex@clocean.co" },
          },
          {
            id: "task-5",
            title: "Create Skog-inspired design blueprint",
            status: "done",
            dueDate: "Completed Oct 24",
            assignee: { name: "Alex Sterling", email: "alex@clocean.co" },
          },
          {
            id: "task-6",
            title: "Setup core file structures",
            status: "done",
            dueDate: "Completed Oct 23",
            assignee: { name: "Sofia Chen", email: "sofia@clocean.co" },
          },
        ],
      };
      await this.putJson("workspaces/default/tasks.json", initialTasks);

      // Seed Photos matching Figma
      const initialPhotos: PhotosData = {
        updatedAt: now,
        photos: [
          {
            id: "photo-1",
            name: "Ocean storm swell",
            url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&auto=format&fit=crop&q=80",
            size: 3240000,
            album: "Ocean",
            uploadedAt: "Oct 24",
          },
          {
            id: "photo-2",
            name: "Golden beach tide",
            url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
            size: 2890000,
            album: "Ocean",
            uploadedAt: "Oct 24",
          },
          {
            id: "photo-3",
            name: "Cabin in coastal redwood",
            url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=80",
            size: 4120000,
            album: "Spaces",
            uploadedAt: "Oct 22",
          },
          {
            id: "photo-4",
            name: "Clear fjord water",
            url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
            size: 3560000,
            album: "Ocean",
            uploadedAt: "Oct 20",
          },
          {
            id: "photo-5",
            name: "Dune ripple texture",
            url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&auto=format&fit=crop&q=80",
            size: 2190000,
            album: "Textures",
            uploadedAt: "Oct 19",
          },
          {
            id: "photo-6",
            name: "Minimal oak desk study",
            url: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80",
            size: 2780000,
            album: "Spaces",
            uploadedAt: "Oct 18",
          },
          {
            id: "photo-7",
            name: "Warm limestone staircase",
            url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80",
            size: 3100000,
            album: "Spaces",
            uploadedAt: "Oct 17",
          },
          {
            id: "photo-8",
            name: "Black sand basalt pebbles",
            url: "https://images.unsplash.com/photo-1505144808419-1957a94ca45b?w=800&auto=format&fit=crop&q=80",
            size: 3450000,
            album: "Textures",
            uploadedAt: "Oct 15",
          },
        ],
      };
      await this.putJson("workspaces/default/photos.json", initialPhotos);

      // Seed Activity Feed matching Figma
      const initialActivities: ActivitiesData = {
        activities: [
          {
            id: "act-1",
            title: "Project ocean launch overview",
            type: "doc",
            timestamp: "2 hours ago",
            user: "Alex Sterling",
          },
          {
            id: "act-2",
            title: "Brand system guidelines.pdf",
            type: "file",
            timestamp: "Yesterday",
            user: "Alex Sterling",
          },
          {
            id: "act-3",
            title: "Review interactive prototypes",
            type: "task",
            timestamp: "Yesterday",
            user: "Marcus Vance",
          },
          {
            id: "act-4",
            title: "Moodboard_v2.jpg",
            type: "photo",
            timestamp: "Oct 24",
            user: "Elena Rostova",
          },
          {
            id: "act-5",
            title: "Sprint 14 planning scratchpad",
            type: "doc",
            timestamp: "Oct 23",
            user: "Alex Sterling",
          },
        ],
      };
      await this.putJson("workspaces/default/activity.json", initialActivities);
    }
  }
}
