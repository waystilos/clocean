import {
  WorkspaceTree,
  DocContent,
  TasksData,
  PhotosData,
  ActivitiesData,
  UserProfile,
  WorkspaceMetadata,
  WorkspaceMember,
  WorkspaceMembersData,
  UserWorkspaceReference,
  UserWorkspacesData,
  OtpRecord,
  TaskItem,
} from "../types.ts";

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
      const cleanEtag = ifMatchEtag.replace(/^"|"$/g, "");
      options.onlyIf = {
        etagMatches: cleanEtag,
      };
    }

    try {
      const res = await this.bucket.put(key, jsonStr, options);
      return { ok: !!res, etag: res ? (res.httpEtag || res.etag) : null };
    } catch {
      return { ok: false, etag: null };
    }
  }

  async deleteKey(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async getUserProfileIfExists(email: string): Promise<UserProfile | null> {
    const cleanEmail = email.toLowerCase().trim();
    let res = await this.getJson<UserProfile>(`workspaces/default/users/${cleanEmail}.json`);
    if (!res.data) {
      res = await this.getJson<UserProfile>(`workspaces/default/users/${encodeURIComponent(cleanEmail)}.json`);
    }
    return res.data || null;
  }

  async getUserProfile(email: string): Promise<UserProfile> {
    const cleanEmail = email.toLowerCase().trim();
    let res = await this.getJson<UserProfile>(`workspaces/default/users/${cleanEmail}.json`);
    if (!res.data) {
      res = await this.getJson<UserProfile>(`workspaces/default/users/${encodeURIComponent(cleanEmail)}.json`);
    }
    if (res.data) return res.data;

    const defaultName = cleanEmail
      .split("@")[0]
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const profile: UserProfile = {
      email: cleanEmail,
      name: defaultName,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanEmail)}`,
      updatedAt: new Date().toISOString(),
    };
    await this.putUserProfile(profile);
    return profile;
  }

  async putUserProfile(profile: UserProfile): Promise<void> {
    const cleanEmail = profile.email.toLowerCase().trim();
    const payload = { ...profile, email: cleanEmail };
    await this.putJson(`workspaces/default/users/${cleanEmail}.json`, payload);
    await this.putJson(`workspaces/default/users/${encodeURIComponent(cleanEmail)}.json`, payload);
  }

  async setupWorkspace(
    name: string,
    email: string,
    workspaceName?: string,
    _theme?: string
  ): Promise<{ user: UserProfile; workspace: UserWorkspaceReference }> {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();
    const wsTitle = workspaceName?.trim() || `${cleanName.split(" ")[0]}'s Workspace`;
    const wsId = `ws-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const profile: UserProfile = {
      email: cleanEmail,
      name: cleanName,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`,
      updatedAt: now,
    };
    await this.putUserProfile(profile);

    const meta: WorkspaceMetadata = {
      id: wsId,
      name: wsTitle,
      icon: "layers",
      ownerEmail: cleanEmail,
      createdAt: now,
      updatedAt: now,
    };
    await this.putJson(`workspaces/${wsId}/workspace.json`, meta);

    const member: WorkspaceMember = {
      email: cleanEmail,
      name: cleanName,
      role: "owner",
      avatar: profile.avatar,
      joinedAt: now,
    };
    await this.putJson(`workspaces/${wsId}/members.json`, {
      workspaceId: wsId,
      members: [member],
    });

    const welcomeDocId = `doc-${crypto.randomUUID().slice(0, 8)}`;
    const initialTree: WorkspaceTree = {
      workspaceId: wsId,
      updatedAt: now,
      nodes: [
        {
          id: welcomeDocId,
          name: `Welcome to ${wsTitle}`,
          type: "doc",
          parentId: null,
          createdAt: now,
          updatedAt: now,
          tags: ["Welcome", "Getting Started"],
        },
      ],
    };
    await this.putJson(`workspaces/${wsId}/tree.json`, initialTree);

    const welcomeContent: DocContent = {
      id: welcomeDocId,
      title: `Welcome to ${wsTitle}`,
      tags: ["Welcome", "Getting Started"],
      content: `# Welcome to ${wsTitle}\n\n> [!NOTE]\n> Workspace initialized for **${cleanName}** on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.\n\n### Your Unified Workspace\n- **Notes**: Collaborative block document authoring.\n- **Files & Assets**: Direct file management and streaming uploads.\n- **Sprint Tasks**: Interactive Kanban task tracking.\n- **Moodboard Photos**: Visual moodboard and image gallery.\n\n### Next Steps\n- Type \`/\` anywhere in the editor to format blocks, headings, and code.\n- Organize team specs and uploads in Documents.\n- Manage upcoming sprint deliverables in Tasks.\n`,
      updatedAt: now,
      attachments: [],
    };
    await this.putJson(`workspaces/${wsId}/docs/${welcomeDocId}/content.json`, welcomeContent);

    await this.putJson(`workspaces/${wsId}/tasks.json`, { updatedAt: now, tasks: [] });
    await this.putJson(`workspaces/${wsId}/photos.json`, { updatedAt: now, photos: [] });
    await this.putJson(`workspaces/${wsId}/activity.json`, {
      activities: [
        {
          id: `act-${crypto.randomUUID()}`,
          title: `Initialized workspace "${wsTitle}"`,
          type: "doc",
          timestamp: "Just now",
          user: cleanName,
        },
      ],
    });

    const wsRef: UserWorkspaceReference = {
      id: wsId,
      name: wsTitle,
      icon: "layers",
      role: "owner",
    };
    await this.saveUserRegistry(cleanEmail, [wsRef]);

    return { user: profile, workspace: wsRef };
  }

  async saveUserRegistry(email: string, workspaces: UserWorkspaceReference[]): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();
    const payload = {
      email: cleanEmail,
      workspaces,
    };
    await this.putJson(`workspaces/registry/users/${cleanEmail}.json`, payload);
    await this.putJson(`workspaces/registry/users/${encodeURIComponent(cleanEmail)}.json`, payload);
  }

  // --- OTP Verification Storage & Rate-Limiting ---
  async storeOtp(email: string, record: OtpRecord): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();
    const key = `workspaces/registry/otp/${cleanEmail}.json`;
    await this.putJson(key, record);
    await this.putJson(`workspaces/registry/otp/${encodeURIComponent(cleanEmail)}.json`, record);
  }

  async getOtp(email: string): Promise<OtpRecord | null> {
    const cleanEmail = email.toLowerCase().trim();
    let res = await this.getJson<OtpRecord>(`workspaces/registry/otp/${cleanEmail}.json`);
    if (!res.data) {
      res = await this.getJson<OtpRecord>(`workspaces/registry/otp/${encodeURIComponent(cleanEmail)}.json`);
    }
    return res.data || null;
  }

  async incrementOtpAttempts(email: string): Promise<number> {
    const cleanEmail = email.toLowerCase().trim();
    const record = await this.getOtp(cleanEmail);
    if (!record) return 0;
    const attempts = (record.attempts || 0) + 1;
    record.attempts = attempts;
    await this.storeOtp(cleanEmail, record);
    return attempts;
  }

  async deleteOtp(email: string): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();
    await this.deleteKey(`workspaces/registry/otp/${cleanEmail}.json`);
    await this.deleteKey(`workspaces/registry/otp/${encodeURIComponent(cleanEmail)}.json`);
  }

  // --- Organization & Team Workspaces ---
  async getUserWorkspaces(email: string): Promise<UserWorkspaceReference[]> {
    const cleanEmail = email.toLowerCase().trim();
    let res = await this.getJson<UserWorkspacesData>(`workspaces/registry/users/${cleanEmail}.json`);
    if (!res.data) {
      res = await this.getJson<UserWorkspacesData>(`workspaces/registry/users/${encodeURIComponent(cleanEmail)}.json`);
      if (res.data && res.data.workspaces && res.data.workspaces.length > 0) {
        // Auto-migrate to clean key
        await this.saveUserRegistry(cleanEmail, res.data.workspaces);
      }
    }
    if (res.data && res.data.workspaces && res.data.workspaces.length > 0) {
      return res.data.workspaces.map((w) => ({
        ...w,
        icon: w.icon === "🌊" || !w.icon ? "layers" : w.icon,
      }));
    }

    // Default workspace if none exists for this user
    const defaultWorkspaces: UserWorkspaceReference[] = [
      { id: "default", name: "Clocean Main", icon: "layers", role: "owner" },
    ];
    await this.saveUserRegistry(cleanEmail, defaultWorkspaces);
    return defaultWorkspaces;
  }

  async getWorkspaceMetadata(wsId: string): Promise<WorkspaceMetadata | null> {
    const key = `workspaces/${wsId}/workspace.json`;
    const res = await this.getJson<WorkspaceMetadata>(key);
    if (res.data) {
      if (res.data.icon === "🌊" || !res.data.icon) {
        res.data.icon = "layers";
      }
      return res.data;
    }

    if (wsId === "default") {
      const now = new Date().toISOString();
      const meta: WorkspaceMetadata = {
        id: "default",
        name: "Clocean Main",
        icon: "layers",
        ownerEmail: "alex@clocean.co",
        createdAt: now,
        updatedAt: now,
      };
      await this.putJson(key, meta);
      return meta;
    }
    return null;
  }

  async createWorkspace(
    name: string,
    icon: string,
    ownerEmail: string,
    ownerName: string
  ): Promise<WorkspaceMetadata> {
    const id = `ws-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const meta: WorkspaceMetadata = {
      id,
      name,
      icon: icon || "layers",
      ownerEmail,
      createdAt: now,
      updatedAt: now,
    };
    await this.putJson(`workspaces/${id}/workspace.json`, meta);

    // Initial Member (Owner)
    const membersData: WorkspaceMembersData = {
      workspaceId: id,
      members: [
        {
          email: ownerEmail,
          name: ownerName,
          role: "owner",
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(ownerEmail)}`,
          joinedAt: now,
        },
      ],
    };
    await this.putJson(`workspaces/${id}/members.json`, membersData);

    // Initial Tree for this workspace
    const initialTree: WorkspaceTree = {
      workspaceId: id,
      updatedAt: now,
      nodes: [
        {
          id: `doc-welcome-${id}`,
          name: `Welcome to ${name}`,
          type: "doc",
          parentId: null,
          updatedAt: "Just now",
          createdAt: now,
          tags: ["#welcome", "#team"],
        },
      ],
    };
    await this.putJson(`workspaces/${id}/tree.json`, initialTree);

    // Initial Doc Content
    const docData: DocContent = {
      id: `doc-welcome-${id}`,
      title: `Welcome to ${name}`,
      tags: ["#welcome", "#team"],
      content: `# Welcome to ${name}\n\nThis is your team's collaborative workspace in Clocean.\n- [ ] Invite team members\n- [ ] Create shared documents\n- [ ] Upload team assets`,
      updatedAt: now,
      attachments: [],
    };
    await this.putJson(`workspaces/${id}/docs/doc-welcome-${id}/content.json`, docData);

    // Initial empty Tasks, Photos, and Activity
    await this.putJson(`workspaces/${id}/tasks.json`, { tasks: [], updatedAt: now });
    await this.putJson(`workspaces/${id}/photos.json`, { photos: [], updatedAt: now });
    await this.putJson(`workspaces/${id}/activity.json`, {
      activities: [
        {
          id: `act-${crypto.randomUUID()}`,
          title: `Created workspace "${name}"`,
          type: "doc",
          timestamp: "Just now",
          user: ownerName,
        },
      ],
    });

    // Add to user's registered workspaces
    const userWsList = await this.getUserWorkspaces(ownerEmail);
    if (!userWsList.some((w) => w.id === id)) {
      userWsList.push({ id, name, icon: icon || "layers", role: "owner" });
      await this.saveUserRegistry(ownerEmail, userWsList);
    }

    return meta;
  }

  async getWorkspaceMembers(wsId: string): Promise<WorkspaceMember[]> {
    const key = `workspaces/${wsId}/members.json`;
    const res = await this.getJson<WorkspaceMembersData>(key);
    if (res.data && res.data.members) return res.data.members;

    if (wsId === "default") {
      const defaultMembers: WorkspaceMember[] = [
        {
          email: "alex@clocean.co",
          name: "Alex Sterling",
          role: "owner",
          avatar: "https://api.dicebear.com/7.x/initials/svg?seed=alex@clocean.co",
          joinedAt: new Date().toISOString(),
        },
        {
          email: "marcus@clocean.co",
          name: "Marcus Vance",
          role: "member",
          avatar: "https://api.dicebear.com/7.x/initials/svg?seed=marcus@clocean.co",
          joinedAt: new Date().toISOString(),
        },
        {
          email: "elena@clocean.co",
          name: "Elena Rostova",
          role: "member",
          avatar: "https://api.dicebear.com/7.x/initials/svg?seed=elena@clocean.co",
          joinedAt: new Date().toISOString(),
        },
        {
          email: "sofia@clocean.co",
          name: "Sofia Chen",
          role: "member",
          avatar: "https://api.dicebear.com/7.x/initials/svg?seed=sofia@clocean.co",
          joinedAt: new Date().toISOString(),
        },
      ];
      await this.putJson(key, { workspaceId: "default", members: defaultMembers });
      return defaultMembers;
    }

    return [];
  }

  /** Remove the historical demo roster from production and register the Access identity. */
  async ensureProductionDefaultMember(email: string): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();
    const key = "workspaces/default/members.json";
    const result = await this.getJson<WorkspaceMembersData>(key);
    const demoEmails = new Set([
      "alex@clocean.co",
      "marcus@clocean.co",
      "elena@clocean.co",
      "sofia@clocean.co",
    ]);
    const existingMembers = result.data?.members || [];
    const isDemoOnlyRoster = existingMembers.length === 0 || existingMembers.every((member) => demoEmails.has(member.email.toLowerCase()));
    const members = existingMembers.filter((member) => !demoEmails.has(member.email.toLowerCase()));
    const profile = await this.getUserProfile(cleanEmail);
    let current = members.find((member) => member.email.toLowerCase() === cleanEmail);
    if (!current && isDemoOnlyRoster) {
      current = {
        email: cleanEmail,
        name: profile.name,
        role: members.length === 0 ? "owner" : "member",
        avatar: profile.avatar,
        joinedAt: new Date().toISOString(),
      };
      members.push(current);
    }

    let owner = members.find((member) => member.role === "owner");
    if (!owner) {
      const fallbackOwner = current || members[0];
      if (fallbackOwner) {
        fallbackOwner.role = "owner";
        owner = fallbackOwner;
      }
    }

    const changed = !result.data || result.data.members.length !== members.length ||
      result.data.members.some((member, index) => {
        const next = members[index];
        return !next || member.email !== next.email || member.role !== next.role;
      });
    if (changed) await this.putJson(key, { workspaceId: "default", members });

    // Remove historical demo work items and activity from the production default workspace.
    // Local development keeps these fixtures so the open-source test environment remains useful.
    const demoNames = new Set(["Alex Sterling", "Marcus Vance", "Elena Rostova", "Sofia Chen"]);
    const tasksKey = "workspaces/default/tasks.json";
    const tasksResult = await this.getJson<TasksData>(tasksKey);
    if (tasksResult.data?.tasks) {
      const productionTasks = tasksResult.data.tasks.filter((task) => {
        const assigneeEmail = typeof task.assignee === "object" && task.assignee ? task.assignee.email?.toLowerCase() : "";
        return !demoEmails.has(assigneeEmail || "") && !/^task-[1-6]$/.test(task.id);
      });
      if (productionTasks.length !== tasksResult.data.tasks.length) {
        await this.putJson(tasksKey, { tasks: productionTasks, updatedAt: new Date().toISOString() }, tasksResult.etag || undefined);
      }
    }

    const activityKey = "workspaces/default/activity.json";
    const activityResult = await this.getJson<ActivitiesData>(activityKey);
    if (activityResult.data?.activities) {
      const productionActivities = activityResult.data.activities.filter((activity) => !demoNames.has(activity.user));
      if (productionActivities.length !== activityResult.data.activities.length) {
        await this.putJson(activityKey, { activities: productionActivities }, activityResult.etag || undefined);
      }
    }

    const meta = await this.getWorkspaceMetadata("default");
    if (meta && owner && meta.ownerEmail !== owner.email) {
      meta.ownerEmail = owner.email;
      meta.updatedAt = new Date().toISOString();
      await this.putJson("workspaces/default/workspace.json", meta);
    }

    const workspaces = await this.getUserWorkspaces(cleanEmail);
    const defaultWorkspace = workspaces.find((workspace) => workspace.id === "default");
    if (defaultWorkspace && current && defaultWorkspace.role !== current.role) {
      defaultWorkspace.role = current.role;
      await this.saveUserRegistry(cleanEmail, workspaces);
    }
  }

  async addWorkspaceMember(
    wsId: string,
    email: string,
    name: string,
    role: "admin" | "member" = "member"
  ): Promise<WorkspaceMember> {
    const members = await this.getWorkspaceMembers(wsId);
    let member = members.find((m) => m.email.toLowerCase() === email.toLowerCase());
    if (member) {
      member.role = role;
    } else {
      member = {
        email: email.toLowerCase().trim(),
        name: name || email.split("@")[0],
        role,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`,
        joinedAt: new Date().toISOString(),
      };
      members.push(member);
    }
    await this.putJson(`workspaces/${wsId}/members.json`, { workspaceId: wsId, members });

    // Also register workspace in user's workspaces
    const userWsList = await this.getUserWorkspaces(email);
    const wsMeta = await this.getWorkspaceMetadata(wsId);
    const existingEntry = userWsList.find((w) => w.id === wsId);
    if (existingEntry) {
      existingEntry.role = role;
    } else {
      userWsList.push({
        id: wsId,
        name: wsMeta?.name || "Team Workspace",
        icon: wsMeta?.icon || "layers",
        role,
      });
    }
    await this.saveUserRegistry(email, userWsList);

    return member;
  }

  async updateWorkspaceMemberRole(
    wsId: string,
    email: string,
    newRole: "admin" | "member"
  ): Promise<{ success: boolean; error?: string; members: WorkspaceMember[] }> {
    const members = await this.getWorkspaceMembers(wsId);
    const member = members.find((m) => m.email.toLowerCase() === email.toLowerCase().trim());
    if (!member) {
      return { success: false, error: "Member not found in workspace", members };
    }
    if (member.role === "owner") {
      return { success: false, error: "Cannot change the workspace owner's role", members };
    }

    member.role = newRole;
    await this.putJson(`workspaces/${wsId}/members.json`, { workspaceId: wsId, members });

    // Update user's personal registered workspaces entry
    const userWsList = await this.getUserWorkspaces(email);
    const existing = userWsList.find((w) => w.id === wsId);
    if (existing) {
      existing.role = newRole;
      await this.saveUserRegistry(email, userWsList);
    }

    return { success: true, members };
  }

  async removeWorkspaceMember(
    wsId: string,
    email: string
  ): Promise<{ success: boolean; error?: string; members: WorkspaceMember[] }> {
    const cleanEmail = email.toLowerCase().trim();
    const members = await this.getWorkspaceMembers(wsId);
    const target = members.find((member) => member.email.toLowerCase() === cleanEmail);
    if (!target) return { success: false, error: "Member not found in workspace", members };
    if (target.role === "owner") return { success: false, error: "The workspace owner cannot be removed", members };

    const remaining = members.filter((member) => member.email.toLowerCase() !== cleanEmail);
    await this.putJson(`workspaces/${wsId}/members.json`, { workspaceId: wsId, members: remaining });

    const workspaces = await this.getUserWorkspaces(cleanEmail);
    const updatedWorkspaces = workspaces.filter((workspace) => workspace.id !== wsId);
    await this.saveUserRegistry(cleanEmail, updatedWorkspaces);
    return { success: true, members: remaining };
  }

  async appendActivity(
    wsId: string,
    activity: { title: string; type: "doc" | "file" | "task" | "photo"; user: string }
  ): Promise<void> {
    const key = `workspaces/${wsId}/activity.json`;
    const actRes = await this.getJson<ActivitiesData>(key);
    const list = actRes.data?.activities || [];
    list.unshift({
      id: `act-${crypto.randomUUID()}`,
      title: activity.title,
      type: activity.type,
      timestamp: "Just now",
      user: activity.user,
    });
    await this.putJson(key, { activities: list.slice(0, 50) });
  }

  // Seed initial data if R2 is fresh
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

      // Seed initial Tasks
      const initialTasks: TasksData = {
        updatedAt: now,
        tasks: [
          {
            id: "task-1",
            title: "Define ocean palette values",
            status: "todo",
            dueDate: "Due Oct 29",
            assignee: { name: "Unassigned", email: "" },
          },
          {
            id: "task-2",
            title: "Configure baseline grid",
            status: "todo",
            dueDate: "Due Nov 2",
            assignee: { name: "Unassigned", email: "" },
          },
          {
            id: "task-3",
            title: "Draft typography manifesto",
            status: "inprogress",
            dueDate: "Due Oct 27",
            assignee: { name: "Unassigned", email: "" },
          },
          {
            id: "task-4",
            title: "Implement warm parchment assets",
            status: "inprogress",
            dueDate: "Due Oct 28",
            assignee: { name: "Unassigned", email: "" },
          },
          {
            id: "task-5",
            title: "Create Skog-inspired design blueprint",
            status: "done",
            dueDate: "Completed Oct 24",
            assignee: { name: "Unassigned", email: "" },
          },
          {
            id: "task-6",
            title: "Setup core file structures",
            status: "done",
            dueDate: "Completed Oct 23",
            assignee: { name: "Unassigned", email: "" },
          },
        ],
      };
      await this.putJson("workspaces/default/tasks.json", initialTasks);

      // Seed initial Photos
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

      // Seed initial Activity Feed
      const initialActivities: ActivitiesData = {
        activities: [
          {
            id: "act-1",
            title: "Project ocean launch overview",
            type: "doc",
            timestamp: "2 hours ago",
            user: "Workspace",
          },
          {
            id: "act-2",
            title: "Brand system guidelines.pdf",
            type: "file",
            timestamp: "Yesterday",
            user: "Workspace",
          },
          {
            id: "act-3",
            title: "Review interactive prototypes",
            type: "task",
            timestamp: "Yesterday",
            user: "Workspace",
          },
          {
            id: "act-4",
            title: "Moodboard_v2.jpg",
            type: "photo",
            timestamp: "Oct 24",
            user: "Workspace",
          },
          {
            id: "act-5",
            title: "Sprint 14 planning scratchpad",
            type: "doc",
            timestamp: "Oct 23",
            user: "Workspace",
          },
        ],
      };
      await this.putJson("workspaces/default/activity.json", initialActivities);
    }

    // Older seeds advertised demo files without storing their binary R2
    // objects. Remove only those known seed references when the object is
    // absent; user uploads and any real replacement objects are preserved.
    const repairMarker = await this.getJson<{ version: number }>("workspaces/default/.seed-file-repair.json");
    if (!repairMarker.data) {
      const seedFiles = [
        { id: "file-archive-zip", key: "workspaces/default/files/file-archive-zip/Archive.zip" },
        { id: "file-brand-guidelines", key: "workspaces/default/files/file-brand-guidelines/Brand system guidelines.pdf" },
        { id: "file-dev-roadmap", key: "workspaces/default/files/file-dev-roadmap/Development roadmap.xlsx" },
        { id: "file-manifesto-docx", key: "workspaces/default/files/file-manifesto-docx/manifesto_v2.docx" },
        { id: "file-wireframes-pdf", key: "workspaces/default/files/file-wireframes-pdf/Wireframe layouts.pdf" },
        { id: "file-moodboard", key: "workspaces/default/files/file-moodboard/moodboard.png" },
      ];
      const missingIds = new Set(
        (await Promise.all(seedFiles.map(async (file) => (await this.bucket.head(file.key)) ? null : file.id))).filter(Boolean) as string[],
      );
      if (missingIds.size > 0) {
        const treeRes = await this.getJson<WorkspaceTree>("workspaces/default/tree.json");
        if (treeRes.data) {
          treeRes.data.nodes = treeRes.data.nodes.filter((node) => !missingIds.has(node.id));
          await this.putJson("workspaces/default/tree.json", treeRes.data, treeRes.etag || undefined);
        }
        const docRes = await this.getJson<DocContent>("workspaces/default/docs/doc-manifesto/content.json");
        if (docRes.data) {
          docRes.data.attachments = docRes.data.attachments.filter((attachment) => !missingIds.has(attachment.id));
          await this.putJson("workspaces/default/docs/doc-manifesto/content.json", docRes.data, docRes.etag || undefined);
        }
      }
      await this.putJson("workspaces/default/.seed-file-repair.json", { version: 1 });
    }
  }

  async deleteWorkspace(wsId: string): Promise<void> {
    if (!wsId || wsId === "default") return;

    const standardKeys = [
      `workspaces/${wsId}/workspace.json`,
      `workspaces/${wsId}/meta.json`,
      `workspaces/${wsId}/members.json`,
      `workspaces/${wsId}/tree.json`,
      `workspaces/${wsId}/tasks.json`,
      `workspaces/${wsId}/photos.json`,
      `workspaces/${wsId}/activity.json`,
      `workspaces/${wsId}/favorites.json`,
      `workspaces/${wsId}/notifications/outbox.json`,
    ];

    for (const key of standardKeys) {
      await this.deleteKey(key);
    }

    if (this.bucket && typeof (this.bucket as any).list === "function") {
      try {
        let truncated = true;
        let cursor: string | undefined = undefined;
        while (truncated) {
          const listRes: any = await (this.bucket as any).list({
            prefix: `workspaces/${wsId}/`,
            cursor,
          });
          if (listRes?.objects && Array.isArray(listRes.objects)) {
            for (const obj of listRes.objects) {
              await this.bucket.delete(obj.key);
            }
          }
          truncated = !!listRes?.truncated;
          cursor = listRes?.truncated ? listRes.cursor : undefined;
        }
      } catch {
        // Fallback: standard keys were already deleted
      }
    }
  }

  async deleteUserAccount(email: string): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();

    // 1. Delete user profile
    await this.deleteKey(`workspaces/default/users/${cleanEmail}.json`);
    await this.deleteKey(`workspaces/default/users/${encodeURIComponent(cleanEmail)}.json`);

    // 2. Delete avatar files
    const avatarExtensions = ["png", "jpg", "jpeg", "webp", "gif"];
    for (const ext of avatarExtensions) {
      await this.deleteKey(`workspaces/default/avatars/${cleanEmail}.${ext}`);
      await this.deleteKey(`workspaces/default/avatars/${encodeURIComponent(cleanEmail)}.${ext}`);
    }

    // 3. Delete OTP record if any
    await this.deleteOtp(cleanEmail);

    // 4. Delete user notifications log
    await this.deleteKey(`workspaces/registry/users/${cleanEmail}/notifications.json`);
    await this.deleteKey(`workspaces/registry/users/${encodeURIComponent(cleanEmail)}/notifications.json`);

    // 5. Workspaces cleanup
    let userWorkspaces: UserWorkspaceReference[] = [];
    const regRes = await this.getJson<UserWorkspacesData>(`workspaces/registry/users/${cleanEmail}.json`);
    if (regRes.data?.workspaces) {
      userWorkspaces = regRes.data.workspaces;
    } else {
      const regResEnc = await this.getJson<UserWorkspacesData>(`workspaces/registry/users/${encodeURIComponent(cleanEmail)}.json`);
      if (regResEnc.data?.workspaces) {
        userWorkspaces = regResEnc.data.workspaces;
      }
    }

    // Delete user's registry files
    await this.deleteKey(`workspaces/registry/users/${cleanEmail}.json`);
    await this.deleteKey(`workspaces/registry/users/${encodeURIComponent(cleanEmail)}.json`);

    // Process each workspace
    for (const ws of userWorkspaces) {
      if (!ws.id || ws.id === "default") {
        const defaultMembers = await this.getWorkspaceMembers("default");
        const filtered = defaultMembers.filter((m) => m.email.toLowerCase() !== cleanEmail);
        if (filtered.length !== defaultMembers.length) {
          await this.putJson("workspaces/default/members.json", {
            workspaceId: "default",
            members: filtered,
          });
        }
        continue;
      }

      const members = await this.getWorkspaceMembers(ws.id);
      const remainingMembers = members.filter((m) => m.email.toLowerCase() !== cleanEmail);

      if (remainingMembers.length === 0) {
        await this.deleteWorkspace(ws.id);
      } else {
        const hasOwner = remainingMembers.some((m) => m.role === "owner");
        if (!hasOwner) {
          const newOwner = remainingMembers.find((m) => m.role === "admin") || remainingMembers[0];
          newOwner.role = "owner";
          const meta = await this.getWorkspaceMetadata(ws.id);
          if (meta) {
            meta.ownerEmail = newOwner.email;
            meta.updatedAt = new Date().toISOString();
            await this.putJson(`workspaces/${ws.id}/workspace.json`, meta);
          }
        }

        await this.putJson(`workspaces/${ws.id}/members.json`, {
          workspaceId: ws.id,
          members: remainingMembers,
        });

        await this.appendActivity(ws.id, {
          title: `${cleanEmail} left the workspace (account deleted)`,
          type: "doc",
          user: "System",
        });
      }
    }
  }
}
