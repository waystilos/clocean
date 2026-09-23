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

export interface WorkspaceTree {
  workspaceId: string;
  updatedAt: string;
  nodes: TreeNode[];
  trash?: { id: string; name: string; deletedAt: string; nodes: TreeNode[] }[];
}

export type DatabasePropertyType = "text" | "number" | "select" | "multi_select" | "date" | "checkbox" | "person" | "url";

export interface DatabaseProperty {
  id: string;
  name: string;
  type: DatabasePropertyType;
  options?: string[];
}

export interface DatabaseSchema {
  id: string;
  workspaceId: string;
  name: string;
  properties: DatabaseProperty[];
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseRecord {
  id: string;
  databaseId: string;
  title: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
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
  content: string; // Markdown or serialized rich text
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

export type TaskType = "task" | "bug" | "feature" | "improvement" | "question";

export interface TaskComment {
  id: string;
  text: string;
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
  createdAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  type?: TaskType;
  status: "todo" | "inprogress" | "done" | string;
  priority?: "urgent" | "high" | "medium" | "low";
  dueDate: string;
  assignee: {
    name: string;
    email: string;
    avatar?: string;
  };
  tags?: string[];
  subtasks?: TaskSubtask[];
  comments?: TaskComment[];
  lastAlertedAt?: string;
}

export interface TasksData {
  tasks: TaskItem[];
  updatedAt: string;
}

export interface TaskBoardColumn {
  id: string;
  title: string;
  color?: string;
  wipLimit?: number;
}

export interface TaskBoard {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  columns?: TaskBoardColumn[];
  defaultView?: "board" | "table";
  defaultPriority?: "urgent" | "high" | "medium" | "low";
  createdAt: string;
  updatedAt: string;
}

export interface PhotoItem {
  id: string;
  name: string;
  url: string;
  size: number;
  album: string;
  uploadedAt: string;
}

export interface PhotosData {
  photos: PhotoItem[];
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  type: "doc" | "file" | "task" | "photo";
  timestamp: string;
  user: string;
}

export interface ActivitiesData {
  activities: ActivityItem[];
}

export interface UserProfile {
  email: string;
  name: string;
  avatar: string;
  bio?: string;
  updatedAt: string;
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

export interface WorkspaceMembersData {
  workspaceId: string;
  members: WorkspaceMember[];
}

export interface UserWorkspaceReference {
  id: string;
  name: string;
  icon: string;
  role: "owner" | "admin" | "member";
}

export interface UserWorkspacesData {
  email: string;
  workspaces: UserWorkspaceReference[];
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

export interface DocCommentsData {
  docId: string;
  comments: DocComment[];
}

export interface OtpRecord {
  email: string;
  hashedCode: string;
  salt: string;
  purpose: "setup" | "login" | "signin" | "join";
  metadata?: {
    name?: string;
    workspaceName?: string;
    workspaceId?: string;
    theme?: string;
  };
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

export interface MentionNotification {
  id: string;
  workspaceId: string;
  workspaceName: string;
  documentId?: string;
  documentTitle?: string;
  taskId?: string;
  taskTitle?: string;
  type?: "doc" | "comment" | "task" | "invite" | "test" | "deadline";
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

export interface UserNotificationsData {
  email: string;
  notifications: MentionNotification[];
}

export interface Env {
  CLOCEAN_STORAGE: R2Bucket;
  DOC_SESSION: DurableObjectNamespace;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_JWKS_URL?: string;
  ALLOWED_ORIGINS?: string;
  APP_URL?: string;
  SEND_EMAIL?: any;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SESSION_SECRET?: string;
}
