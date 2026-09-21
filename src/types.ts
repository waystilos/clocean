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
