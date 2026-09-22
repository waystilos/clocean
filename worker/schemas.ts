import { z } from "zod";

// =====================================================================
// Core Data Model Schemas
// =====================================================================

export const DocAttachmentSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  type: z.string().max(100),
  size: z.number().nonnegative(),
  url: z.string().min(1).max(2048),
});
export type DocAttachment = z.infer<typeof DocAttachmentSchema>;

export const TreeNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  type: z.enum(["doc", "file", "folder"]),
  parentId: z.string().nullable(),
  size: z.number().nonnegative().optional(),
  mimeType: z.string().optional(),
  icon: z.string().optional(),
  updatedAt: z.string(),
  createdAt: z.string(),
  tags: z.array(z.string()).optional(),
  r2Key: z.string().optional(),
});
export type TreeNode = z.infer<typeof TreeNodeSchema>;

export const WorkspaceTreeSchema = z.object({
  workspaceId: z.string().min(1),
  updatedAt: z.string(),
  nodes: z.array(TreeNodeSchema),
});
export type WorkspaceTree = z.infer<typeof WorkspaceTreeSchema>;

export const DocRevisionSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string(),
  title: z.string(),
  author: z.object({
    name: z.string(),
    email: z.string(),
    avatar: z.string().optional(),
  }),
  snippet: z.string(),
  content: z.string(),
});
export type DocRevision = z.infer<typeof DocRevisionSchema>;

export const DocContentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  tags: z.array(z.string()).default([]),
  content: z.string().default(""),
  updatedAt: z.string(),
  attachments: z.array(DocAttachmentSchema).default([]),
  icon: z.string().optional(),
  cover: z.string().optional(),
  isPublic: z.boolean().optional(),
  publicToken: z.string().optional(),
});
export type DocContent = z.infer<typeof DocContentSchema>;

export const WorkspaceMemberSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(100),
  role: z.enum(["owner", "admin", "member"]),
  avatar: z.string(),
  joinedAt: z.string(),
});
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

export const UserWorkspaceReferenceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  icon: z.string(),
  role: z.enum(["owner", "admin", "member"]),
});
export type UserWorkspaceReference = z.infer<typeof UserWorkspaceReferenceSchema>;

export const TaskSubtaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  completed: z.boolean(),
});
export type TaskSubtask = z.infer<typeof TaskSubtaskSchema>;

export const TaskTypeSchema = z.enum(["task", "bug", "feature", "improvement", "question"]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const TaskCommentSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(5000),
  user: z.object({
    name: z.string().max(200),
    email: z.string().email(),
    avatar: z.string().max(2000).optional(),
  }),
  createdAt: z.string(),
});
export type TaskComment = z.infer<typeof TaskCommentSchema>;

export const TaskItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string().max(10000).optional(),
  type: TaskTypeSchema.optional(),
  status: z.enum(["todo", "inprogress", "in_progress", "done"]),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  dueDate: z.string().optional(),
  assignee: z.union([
    z.string(),
    z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      avatar: z.string().optional(),
    }),
  ]).optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
  subtasks: z.array(TaskSubtaskSchema).max(100).optional(),
  comments: z.array(TaskCommentSchema).max(200).optional(),
  lastAlertedAt: z.string().optional(),
});
export type TaskItem = z.infer<typeof TaskItemSchema>;

export const PhotoItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().min(1),
  size: z.number().nonnegative(),
  album: z.string(),
  uploadedAt: z.string(),
});
export type PhotoItem = z.infer<typeof PhotoItemSchema>;

export const DocCommentSchema = z.object({
  id: z.string().min(1),
  docId: z.string().min(1),
  user: z.object({
    name: z.string().min(1),
    email: z.email(),
    avatar: z.string(),
  }),
  text: z.string().min(1).max(5000),
  mentions: z.array(z.string()).default([]),
  createdAt: z.string(),
});
export type DocComment = z.infer<typeof DocCommentSchema>;

export const MentionNotificationSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  workspaceName: z.string().optional(),
  documentId: z.string().optional(),
  documentTitle: z.string().optional(),
  taskId: z.string().optional(),
  taskTitle: z.string().optional(),
  inviteRole: z.enum(["admin", "member"]).optional(),
  type: z.enum(["doc", "comment", "task", "invite", "test"]).optional(),
  sender: z.object({
    name: z.string().min(1),
    email: z.email(),
    avatar: z.string(),
  }),
  recipientEmail: z.email(),
  recipientName: z.string(),
  contextSnippet: z.string(),
  timestamp: z.string(),
  emailStatus: z.enum(["sent", "delivered"]),
  read: z.boolean().default(false),
});
export type MentionNotification = z.infer<typeof MentionNotificationSchema>;

// =====================================================================
// API Request Payload Validation Schemas
// =====================================================================

export const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(60, "Workspace name is too long"),
  icon: z.string().max(50).optional(),
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

export const InviteMemberSchema = z.object({
  email: z.string().trim().pipe(z.email("A valid email address is required")),
  name: z.string().trim().max(100).optional(),
  role: z.enum(["admin", "member"]).default("member"),
});
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;

export const SaveDocSchema = z.object({
  title: z.string().trim().min(1, "Document title cannot be empty").max(200),
  content: z.string().max(5 * 1024 * 1024).default(""),
  tags: z.array(z.string().max(50)).max(50).default([]),
  icon: z.string().max(50).optional(),
  cover: z.string().max(100).optional(),
  attachments: z.array(DocAttachmentSchema).max(50).optional(),
  isPublic: z.boolean().optional(),
  publicToken: z.string().optional(),
});
export type SaveDocInput = z.infer<typeof SaveDocSchema>;

export const ShareDocSchema = z.object({
  isPublic: z.boolean(),
});
export type ShareDocInput = z.infer<typeof ShareDocSchema>;

export const SaveTasksSchema = z.object({
  tasks: z.array(TaskItemSchema),
});
export type SaveTasksInput = z.infer<typeof SaveTasksSchema>;

export const SavePhotosSchema = z.object({
  photos: z.array(PhotoItemSchema),
});
export type SavePhotosInput = z.infer<typeof SavePhotosSchema>;

export const AddCommentSchema = z.object({
  text: z.string().trim().min(1, "Comment text cannot be empty").max(5000),
  replyToId: z.string().optional(),
});
export type AddCommentInput = z.infer<typeof AddCommentSchema>;

export const MentionNotificationPayloadSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  documentTitle: z.string().optional(),
  text: z.string().trim().min(1, "Notification text content is required"),
  type: z.enum(["doc", "comment", "task", "invite", "test"]).optional(),
});
export type MentionNotificationPayload = z.infer<typeof MentionNotificationPayloadSchema>;

export const UpdateUserProfileSchema = z.object({
  name: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(500).optional(),
});
export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;

export const CreateTreeNodeSchema = z.object({
  id: z.string().max(100).optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  type: z.enum(["doc", "file", "folder"]).default("doc"),
  parentId: z.string().nullable().optional(),
  size: z.number().nonnegative().optional(),
  mimeType: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional(),
});
export type CreateTreeNodeInput = z.infer<typeof CreateTreeNodeSchema>;

export const UpdateTreeNodeSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  parentId: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
});
export type UpdateTreeNodeInput = z.infer<typeof UpdateTreeNodeSchema>;

export const ToggleFavoriteSchema = z.object({
  docId: z.string().trim().min(1, "docId is required").max(100),
});
export type ToggleFavoriteInput = z.infer<typeof ToggleFavoriteSchema>;

export const SetupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().pipe(z.email("Valid email is required")),
  workspaceName: z.string().trim().min(1).max(100).optional(),
  theme: z.enum(["dark", "light"]).optional(),
});
export type SetupInput = z.infer<typeof SetupSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().pipe(z.email("Valid email is required")),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const SendOtpSchema = z.object({
  email: z.string().trim().pipe(z.email("Valid email is required")),
  purpose: z.enum(["setup", "login", "signin", "join"]),
  name: z.string().trim().min(1).max(100).optional(),
  workspaceName: z.string().trim().min(1).max(100).optional(),
  workspaceId: z.string().trim().min(1).max(100).optional(),
});
export type SendOtpInput = z.infer<typeof SendOtpSchema>;

export const VerifyOtpSchema = z.object({
  email: z.string().trim().pipe(z.email("Valid email is required")),
  code: z.string().trim().regex(/^\d{6}$/, "Verification code must be exactly 6 numeric digits"),
  purpose: z.enum(["setup", "login", "signin", "join"]).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  workspaceName: z.string().trim().min(1).max(100).optional(),
  workspaceId: z.string().trim().min(1).max(100).optional(),
});
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;

export const CheckDeadlinesSchema = z.object({
  workspaceId: z.string().trim().min(1).optional(),
});
export type CheckDeadlinesInput = z.infer<typeof CheckDeadlinesSchema>;

export const DatabasePropertySchema = z.object({
  id: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/).max(40),
  name: z.string().trim().min(1).max(80),
  type: z.enum(["text", "number", "select", "multi_select", "date", "checkbox", "person", "url"]),
  options: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
});

export const CreateDatabaseSchema = z.object({
  name: z.string().trim().min(1).max(100),
  properties: z.array(DatabasePropertySchema).max(30).default([]),
}).superRefine((value, ctx) => {
  const ids = new Set<string>();
  for (const property of value.properties) {
    if (ids.has(property.id)) ctx.addIssue({ code: "custom", path: ["properties"], message: "Property IDs must be unique" });
    ids.add(property.id);
    if (["select", "multi_select"].includes(property.type) && (!property.options || property.options.length === 0)) {
      ctx.addIssue({ code: "custom", path: ["properties"], message: `${property.type} properties require options` });
    }
  }
});
export type CreateDatabaseInput = z.infer<typeof CreateDatabaseSchema>;

export const DatabaseRecordPayloadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  properties: z.record(z.string().regex(/^[a-zA-Z0-9_-]+$/).max(40), z.unknown()).default({}),
});
export type DatabaseRecordPayload = z.infer<typeof DatabaseRecordPayloadSchema>;
