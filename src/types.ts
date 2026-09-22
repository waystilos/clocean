export type ViewMode = "home" | "tasks" | "notes" | "documents" | "photos" | "templates" | "import" | "trash";

export interface TreeNode {
  id: string;
  name: string;
  type: "doc" | "file" | "folder";
  parentId: string | null;
  size?: number;
  mimeType?: string;
  icon?: string;
  updatedAt: string;
  createdAt: string;
  tags?: string[];
  r2Key?: string;
}

export interface DocAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface DocContent {
  id: string;
  title: string;
  tags: string[];
  content: string;
  updatedAt: string;
  attachments: DocAttachment[];
  icon?: string;
  cover?: string;
  isPublic?: boolean;
  publicToken?: string;
}

export interface DocRevision {
  id: string;
  timestamp: string;
  title: string;
  author: {
    name: string;
    email: string;
    avatar?: string;
  };
  snippet: string;
  content: string;
}

export interface DocRevisionsData {
  docId: string;
  revisions: DocRevision[];
}

export interface WorkspaceFavoritesData {
  workspaceId: string;
  docIds: string[];
}

export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "inprogress" | "done";
  priority?: "urgent" | "high" | "medium" | "low";
  dueDate: string;
  assignee: {
    name: string;
    email: string;
    avatar?: string;
  };
  tags?: string[];
  subtasks?: TaskSubtask[];
  lastAlertedAt?: string;
}

export interface PhotoItem {
  id: string;
  name: string;
  url: string;
  size: number;
  album: string;
  uploadedAt: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  type: "doc" | "file" | "task" | "photo";
  timestamp: string;
  user: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
}

export interface WorkspaceMetadata {
  id: string;
  name: string;
  icon: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
  avatar: string;
  joinedAt: string;
}

export interface UserWorkspaceReference {
  id: string;
  name: string;
  icon: string;
  role: "owner" | "admin" | "member";
}

export interface DocComment {
  id: string;
  docId: string;
  user: {
    name: string;
    email: string;
    avatar: string;
  };
  text: string;
  mentions: string[];
  createdAt: string;
}

export interface MentionNotification {
  id: string;
  workspaceId: string;
  workspaceName: string;
  documentId?: string;
  documentTitle?: string;
  taskId?: string;
  taskTitle?: string;
  type?: "doc" | "comment" | "task" | "invite" | "test";
  inviteRole?: "admin" | "member";
  sender: {
    name: string;
    email: string;
    avatar: string;
  };
  recipientEmail: string;
  recipientName: string;
  contextSnippet: string;
  timestamp: string;
  emailStatus: "sent" | "delivered";
  read: boolean;
}
