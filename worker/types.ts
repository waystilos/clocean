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
}

export interface TaskItem {
  id: string;
  title: string;
  status: "todo" | "inprogress" | "done";
  dueDate: string;
  assignee: {
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface TasksData {
  tasks: TaskItem[];
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

export interface Env {
  CLOCEAN_STORAGE: R2Bucket;
  DOC_SESSION: DurableObjectNamespace;
  ASSETS?: Fetcher;
}
