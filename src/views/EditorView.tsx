import React, { useState, useEffect, useRef } from "react";
import {
  Paperclip,
  Heading1,
  Bold,
  Italic,
  Link as LinkIcon,
  Image as ImageIcon,
  List,
  CheckSquare,
  FileText,
  Download,
  Plus,
  Trash,
  AtSign,
  MessageSquare,
  Send,
  Mail,
  Shield,
  Check,
  Eye,
  Columns,
  Edit3,
  Table as TableIcon,
  Code,
  Quote,
  Star,
  Globe,
  History,
  Sparkles,
  Lightbulb,
  AlertTriangle,
  ChevronRight,
  X,
  RotateCcw,
  Copy,
  Smile,
  Minus,
  ListOrdered,
  Share2,
  BookOpen,
  Bookmark,
  Target,
  Cpu,
  Layers,
  Terminal,
  Zap,
  Tag,
  Calendar,
  Palette,
  Briefcase,
  Link2,
  UserPlus,
  Users,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  DocContent,
  DocAttachment,
  UserProfile,
  WorkspaceMember,
  DocComment,
  DocRevision,
} from "../types.ts";
import { MarkdownRenderer } from "../components/MarkdownRenderer.tsx";
import { LiveMarkdownEditor } from "../components/LiveMarkdownEditor.tsx";

interface EditorViewProps {
  docId: string;
  currentUser: UserProfile;
  workspaceId?: string;
  onUpdateAttachments?: () => void;
  onOpenFilePreview?: (attachment: DocAttachment) => void;
  sessionToken?: string | null;
}

interface RemoteCursor {
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    color: string;
  };
  cursor: {
    line: number;
    ch: number;
  };
}

const COVER_PRESETS = [
  { name: "Obsidian Emerald", style: "linear-gradient(135deg, #141412 0%, #1E7D6B 100%)" },
  { name: "Warm Sunset", style: "linear-gradient(135deg, #7C2D12 0%, #D97706 100%)" },
  { name: "Ocean Deep", style: "linear-gradient(135deg, #0C4A6E 0%, #0284C7 100%)" },
  { name: "Violet Twilight", style: "linear-gradient(135deg, #4C1D95 0%, #8B5CF6 100%)" },
  { name: "Obsidian Monochrome", style: "linear-gradient(135deg, #232321 0%, #141412 100%)" },
];

interface PageIconOption {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const PAGE_ICON_OPTIONS: PageIconOption[] = [
  { id: "file-text", label: "Document", icon: <FileText size={16} /> },
  { id: "book-open", label: "Book", icon: <BookOpen size={16} /> },
  { id: "bookmark", label: "Bookmark", icon: <Bookmark size={16} /> },
  { id: "target", label: "Target", icon: <Target size={16} /> },
  { id: "layers", label: "Layers", icon: <Layers size={16} /> },
  { id: "cpu", label: "Tech", icon: <Cpu size={16} /> },
  { id: "terminal", label: "Terminal", icon: <Terminal size={16} /> },
  { id: "shield", label: "Shield", icon: <Shield size={16} /> },
  { id: "zap", label: "Action", icon: <Zap size={16} /> },
  { id: "globe", label: "Web", icon: <Globe size={16} /> },
  { id: "code", label: "Code", icon: <Code size={16} /> },
  { id: "tag", label: "Tag", icon: <Tag size={16} /> },
  { id: "calendar", label: "Calendar", icon: <Calendar size={16} /> },
  { id: "mail", label: "Mail", icon: <Mail size={16} /> },
  { id: "star", label: "Star", icon: <Star size={16} /> },
  { id: "briefcase", label: "Work", icon: <Briefcase size={16} /> },
];

const renderPageIcon = (iconId: string, size = 22) => {
  const match = PAGE_ICON_OPTIONS.find((o) => o.id === iconId);
  if (match) {
    return React.cloneElement(match.icon as React.ReactElement<any>, { size, color: "var(--accent)" });
  }
  return <FileText size={size} color="var(--accent)" />;
};

const renderTemplateIcon = (id: string) => {
  switch (id) {
    case "meeting":
      return <List size={18} color="var(--accent)" />;
    case "prd":
      return <FileText size={18} color="var(--accent)" />;
    case "sprint":
      return <Target size={18} color="var(--accent)" />;
    case "wiki":
      return <BookOpen size={18} color="var(--accent)" />;
    case "design_doc":
      return <Cpu size={18} color="var(--accent)" />;
    default:
      return <FileText size={18} color="var(--accent)" />;
  }
};

const STARTER_TEMPLATES = [
  {
    id: "meeting",
    title: "Weekly Team Sync Notes",
    icon: "file-text",
    tags: ["#meetings", "#notes"],
    content: `# Weekly Team Sync Notes\n\n> [!NOTE]\n> **Meeting Goal**: Align on sprint deliverables, address roadblocks, and finalize deployment plan.\n\n### Attendees\n- Workspace lead\n- Engineering lead\n- Design lead\n\n### Agenda\n1. Review sprint burndown and outstanding PRs\n2. Database architecture on Cloudflare R2\n3. Zero Trust Access configuration\n\n### Discussion Points\n- Performance benchmarks show sub-millisecond edge latency with Durable Objects.\n- ETag optimistic locking successfully prevents concurrent write collisions.\n\n### Action Items\n- [ ] Finalize production R2 bucket bindings\n- [ ] Invite QA engineers to workspace roster\n- [ ] Deploy the next dashboard update\n`,
  },
  {
    id: "prd",
    title: "Product Requirement Spec (PRD)",
    icon: "file-text",
    tags: ["#spec", "#product"],
    content: `# Feature Spec: Cloudflare R2 Workspace Database\n\n> [!TIP]\n> **Objective**: Provide a fully serverless, zero-database-cost persistence layer using Cloudflare R2 and optimistic locking.\n\n## 1. Problem Statement\nTraditional databases add standing monthly costs and infrastructure management overhead. We need infinite serverless scalability at near-zero standing cost.\n\n## 2. Requirements Matrix\n| Feature | Priority | Target Sprint | Status |\n| :--- | :---: | :---: | ---: |\n| Optimistic ETag Concurrency | Urgent | Sprint 14 | Done |\n| Real-Time WebSocket Rooms | High | Sprint 14 | In Progress |\n| Public Read-Only Share Link | Medium | Sprint 15 | Todo |\n\n## 3. Architecture Overview\n> [toggle] Edge Data Flow Details\n> All JSON metadata files reside in Cloudflare R2. Durable Objects maintain in-memory state and debounce writes.\n\n## 4. Open Questions\n- [ ] What is the maximum payload size for single-document markdown files? (Currently set to 5 MB)\n- [ ] Should public share links support password protection?\n`,
  },
  {
    id: "sprint",
    title: "Sprint Planning",
    icon: "target",
    tags: ["#sprint", "#planning"],
    content: `# Sprint 15 Planning & Goals\n\n> [!IMPORTANT]\n> **Sprint Theme**: Core Workspace Enhancements (Slash Menu, Multi-View Kanban/Table, Public Sharing).\n\n## Sprint Objectives\n1. Release fluid Slash command menu for rich document authoring.\n2. Add Table View alongside Kanban board in Tasks view.\n3. Complete Red-Team security verification of all edge routes.\n\n## Workstream Breakdown\n| Workstream | Owner | Estimated Days | Risk Level |\n| :--- | :--- | :---: | ---: |\n| Document Engine | Engineering lead | 3 days | Low |\n| Kanban & Table Multi-View | Product team | 2 days | Low |\n| Edge Auth & Public Sharing | Workspace lead | 2 days | Medium |\n\n## Identified Risks & Mitigations\n> [!WARNING]\n> Public document sharing must strictly isolate internal workspace metadata, preventing ID enumeration or member leakage.\n`,
  },
  {
    id: "wiki",
    title: "Company Knowledge Base",
    icon: "book-open",
    tags: ["#wiki", "#handbook"],
    content: `# Team Handbook & Knowledge Base\n\n> [!NOTE]\n> Welcome to the Clocean workspace! This document outlines team workflows, core repositories, and deployment guides.\n\n## Quick Links\n- [GitHub Repository](https://github.com/waystilos/clocean)\n- [Design System & Figma Tokens](https://figma.com)\n- [Cloudflare Dashboard](https://dash.cloudflare.com)\n\n## Team Principles\n- **Zero Database Costs**: Persist state as structured JSON in Cloudflare R2.\n- **Sub-Millisecond Edge Latency**: Collab over Durable Objects WebSockets.\n- **Design Fidelity**: Strict adherence to Obsidian Dark & Parchment Light themes.\n\n## Frequently Asked Questions\n> [toggle] How do I invite team members?\n> Workspace Admins and Owners can invite colleagues directly from the workspace dropdown. An invitation email with a joining link is dispatched automatically.\n\n> [toggle] How does document collaboration work?\n> Cloudflare Durable Objects track connected users, broadcast live cursor positions, and flush debounced markdown content directly into R2.\n`,
  },
  {
    id: "design_doc",
    title: "Engineering Design Doc",
    icon: "cpu",
    tags: ["#architecture", "#engineering"],
    content: `# RFC: Edge-Native Transactional Email & Mentions\n\n> [!NOTE]\n> **Author**: Workspace team\n> **Status**: Accepted & Implemented\n\n## 1. Context & Motivation\nWhen collaborators are @ mentioned in documents, comments, or sprint tasks, they need immediate email notifications with deep-links to the exact document.\n\n## 2. Technical Design\n\`\`\`typescript\ninterface MentionNotification {\n  id: string;\n  workspaceId: string;\n  recipientEmail: string;\n  documentId: string;\n  contextSnippet: string;\n}\n\`\`\`\n\n## 3. Security Considerations\n> [!CAUTION]\n> Ensure recipient emails are verified against the workspace members roster to prevent arbitrary relay of unsolicited emails.\n`,
  },
];

export const EditorView: React.FC<EditorViewProps> = ({
  docId,
  currentUser,
  workspaceId = "default",
  onOpenFilePreview,
  sessionToken,
}) => {
  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = sessionToken || localStorage.getItem("clocean_session_token");
    return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };
  const [doc, setDoc] = useState<DocContent | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<DocAttachment[]>([]);
  const [icon, setIcon] = useState("file-text");
  const [cover, setCover] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "source" | "split" | "preview">("edit");
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(0);

  // Favorites state
  const [isFavorite, setIsFavorite] = useState(false);

  // Public Sharing state
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [publicToken, setPublicToken] = useState("");
  const [copiedShare, setCopiedShare] = useState(false);
  const [shareTab, setShareTab] = useState<"invite" | "publish">("invite");
  const [inviteDocEmail, setInviteDocEmail] = useState("");
  const [inviteDocRole, setInviteDocRole] = useState<"member" | "admin">("member");
  const [isDocInviting, setIsDocInviting] = useState(false);
  const [docInviteSuccess, setDocInviteSuccess] = useState<string | null>(null);
  const [docInviteError, setDocInviteError] = useState<string | null>(null);
  const [copiedDocInvite, setCopiedDocInvite] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);

  // History & Revisions state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<DocRevision[]>([]);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);

  // Pickers & Popovers
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);

  // Slash Command Menu state
  const [slashMenu, setSlashMenu] = useState<{
    visible: boolean;
    query: string;
    selectedIndex: number;
    pos: number;
  }>({ visible: false, query: "", selectedIndex: 0, pos: 0 });

  // Discussion & Mentions State
  const [activeTab, setActiveTab] = useState<"attachments" | "discussion">("attachments");
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [comments, setComments] = useState<DocComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentFeedback, setCommentFeedback] = useState<string | null>(null);
  const [mentionPopup, setMentionPopup] = useState<{
    visible: boolean;
    query: string;
    target: "content" | "comment";
  }>({ visible: false, query: "", target: "content" });

  const socketRef = useRef<WebSocket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mentionPopupRef = useRef<HTMLDivElement | null>(null);
  const slashMenuRef = useRef<HTMLDivElement | null>(null);

  // Load initial document from API
  useEffect(() => {
    fetch(`/api/docs/${docId}`, {
      headers: getAuthHeaders({ "x-workspace-id": workspaceId }),
    })
      .then((res) => res.json())
      .then((raw) => {
        const data = raw as DocContent;
        setDoc(data);
        setTitle(data.title || "Untitled Document");
        setTags(data.tags || ["#notes"]);
        setContent(data.content || "");
        setAttachments(data.attachments || []);
        setIcon(data.icon || "file-text");
        setCover(data.cover || null);
        setIsPublic(!!data.isPublic);
        setPublicToken(data.publicToken || "");
      })
      .catch((err) => console.error("Error loading document:", err));
  }, [docId, workspaceId]);

  // Load favorites
  useEffect(() => {
    fetch(`/api/workspaces/${workspaceId}/favorites`, { headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((favs: any) => {
        if (Array.isArray(favs)) {
          setIsFavorite(favs.includes(docId));
        }
      })
      .catch(() => {});
  }, [workspaceId, docId]);

  // Load workspace members for @ mention autocompletion
  useEffect(() => {
    fetch(`/api/workspaces/${workspaceId}/members?user=${encodeURIComponent(currentUser.email)}`, { headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any) => {
        setMembers(Array.isArray(data) ? data : data?.members || []);
      })
      .catch(() => {});
  }, [workspaceId, currentUser.email]);

  // Load comments
  const loadComments = () => {
    fetch(`/api/docs/${docId}/comments`, {
      headers: getAuthHeaders({ "x-workspace-id": workspaceId }),
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setComments(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadComments();
  }, [docId, workspaceId]);

  // Connect to Cloudflare Durable Object WebSocket for real-time multiplayer editing
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const token = localStorage.getItem("clocean_session_token") || "";
    const wsUrl = `${protocol}//${window.location.host}/api/collab/${docId}?email=${encodeURIComponent(
      currentUser.email
    )}&name=${encodeURIComponent(currentUser.name)}&avatar=${encodeURIComponent(
      currentUser.avatar
    )}&ws=${encodeURIComponent(workspaceId)}&token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "init":
            if (data.content && !content) setContent(data.content);
            if (data.title && !title) setTitle(data.title);
            if (data.tags) setTags(data.tags);
            if (data.attachments) setAttachments(data.attachments);
            if (data.activeCollaborators) setCollaborators(data.activeCollaborators);
            break;

          case "edit":
            if (data.content !== undefined) setContent(data.content);
            if (data.title !== undefined) setTitle(data.title);
            if (data.tags !== undefined) setTags(data.tags);
            if (data.attachments !== undefined) setAttachments(data.attachments);
            break;

          case "presence_join":
          case "presence_leave":
            if (data.activeCollaborators) setCollaborators(data.activeCollaborators);
            break;

          case "cursor":
            if (data.user?.id) {
              setRemoteCursors((prev) => ({
                ...prev,
                [data.user.id]: { user: data.user, cursor: data.cursor },
              }));
            }
            break;
        }
      } catch (err) {
        console.error("Failed to parse collab message:", err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [docId, currentUser, workspaceId]);

  // Close mention and slash popups on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionPopupRef.current && !mentionPopupRef.current.contains(e.target as Node)) {
        setMentionPopup((prev) => ({ ...prev, visible: false }));
      }
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setSlashMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    if (mentionPopup.visible || slashMenu.visible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mentionPopup.visible, slashMenu.visible]);

  // Send edits to peers & Durable Object
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsSaving(true);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "edit",
          content: newContent,
          title,
          tags,
          attachments,
        })
      );
    }

    // Debounced persist to Cloudflare R2
    const timeout = setTimeout(() => {
      fetch(`/api/docs/${docId}?user=${encodeURIComponent(currentUser.email)}`, {
        method: "PUT",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        }),
        body: JSON.stringify({
          title,
          content: newContent,
          tags,
          attachments,
          icon,
          cover,
          isPublic,
          publicToken,
        }),
      }).then(() => setIsSaving(false));
    }, 1200);

    return () => clearTimeout(timeout);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "edit",
          title: newTitle,
          content,
          tags,
          attachments,
        })
      );
    }

    fetch(`/api/docs/${docId}?user=${encodeURIComponent(currentUser.email)}`, {
      method: "PUT",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
        "x-workspace-id": workspaceId,
      }),
      body: JSON.stringify({
        title: newTitle,
        content,
        tags,
        attachments,
        icon,
        cover,
      }),
    });
  };

  const handleUpdateIcon = (newIcon: string) => {
    setIcon(newIcon);
    setIsEmojiPickerOpen(false);
    fetch(`/api/docs/${docId}?user=${encodeURIComponent(currentUser.email)}`, {
      method: "PUT",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
        "x-workspace-id": workspaceId,
      }),
      body: JSON.stringify({ title, content, tags, attachments, icon: newIcon, cover }),
    });
  };

  const handleUpdateCover = (newCover: string | null) => {
    setCover(newCover);
    setIsCoverPickerOpen(false);
    fetch(`/api/docs/${docId}?user=${encodeURIComponent(currentUser.email)}`, {
      method: "PUT",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
        "x-workspace-id": workspaceId,
      }),
      body: JSON.stringify({ title, content, tags, attachments, icon, cover: newCover }),
    });
  };

  // Toggle favorite
  const handleToggleFavorite = async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/favorites`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json", "x-workspace-id": workspaceId }),
        body: JSON.stringify({ docId }),
      });
      if (res.ok) {
        const favs: string[] = await res.json();
        setIsFavorite(favs.includes(docId));
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  // Public Sharing toggle
  const handleToggleShare = async (nextPublic: boolean) => {
    try {
      const res = await fetch(`/api/docs/${docId}/share`, {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        }),
        body: JSON.stringify({ isPublic: nextPublic }),
      });
      if (res.ok) {
        const data: any = await res.json();
        setIsPublic(data.isPublic);
        setPublicToken(data.publicToken || "");
      }
    } catch (err) {
      console.error("Failed to toggle public share:", err);
    }
  };

  // Fetch members for Notion-style Share modal
  useEffect(() => {
    if (!isShareOpen) return;
    const ws = workspaceId || "default";
    const headers = getAuthHeaders();

    fetch(`/api/workspaces/${ws}/members?user=${encodeURIComponent(currentUser.email)}`, { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any) => {
        setWorkspaceMembers(Array.isArray(data) ? data : data?.members || []);
      })
      .catch(() => {});
  }, [isShareOpen, workspaceId, currentUser.email]);

  const handleInviteToDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = inviteDocEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setDocInviteError("Please enter a valid email address.");
      return;
    }
    setIsDocInviting(true);
    setDocInviteError(null);
    setDocInviteSuccess(null);
    try {
      const ws = workspaceId || "default";
      const headers = getAuthHeaders({ "Content-Type": "application/json" });

      const res = await fetch(`/api/workspaces/${ws}/members?user=${encodeURIComponent(currentUser.email)}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: cleanEmail,
          role: inviteDocRole,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as any;
        throw new Error(errData.error || "Failed to invite collaborator");
      }
      const updatedMembers: any = await res.json();
      setWorkspaceMembers(Array.isArray(updatedMembers) ? updatedMembers : updatedMembers?.members || []);
      setDocInviteSuccess(`Invited ${cleanEmail} to collaborate on this document!`);
      setInviteDocEmail("");
      setTimeout(() => setDocInviteSuccess(null), 4000);
    } catch (err: any) {
      setDocInviteError(err.message || "Failed to invite collaborator");
    } finally {
      setIsDocInviting(false);
    }
  };

  // Load Revisions
  const loadRevisions = async () => {
    setIsLoadingRevisions(true);
    try {
      const res = await fetch(`/api/docs/${docId}/revisions`, {
        headers: getAuthHeaders({ "x-workspace-id": workspaceId }),
      });
      if (res.ok) {
        const list: any = await res.json();
        setRevisions(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.error("Failed to load revisions:", err);
    } finally {
      setIsLoadingRevisions(false);
    }
  };

  const handleRestoreRevision = async (revId: string) => {
    if (!confirm("Restore this version? Current editor text will be replaced.")) return;
    try {
      const res = await fetch(`/api/docs/${docId}/revisions/${revId}/restore`, {
        method: "POST",
        headers: getAuthHeaders({ "x-workspace-id": workspaceId }),
      });
      if (res.ok) {
        const restored: any = await res.json();
        setContent(restored.content);
        setTitle(restored.title);
        handleContentChange(restored.content);
        setIsHistoryOpen(false);
      }
    } catch (err) {
      console.error("Failed to restore revision:", err);
    }
  };

  // Document Export
  const handleExportMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "document"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1c1c1a; background: #faf8f5; }
    h1, h2, h3 { font-family: Georgia, serif; }
    pre { background: #232321; color: #e8e5e0; padding: 14px; border-radius: 6px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #e5e5e5; padding: 8px 12px; text-align: left; }
    th { background: #f2ede6; }
    blockquote { border-left: 4px solid #1E7D6B; background: rgba(30,125,107,0.08); margin: 16px 0; padding: 10px 16px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div style="color: #666; margin-bottom: 20px;">Tags: ${tags.join(" ")}</div>
  <hr/>
  <pre style="white-space: pre-wrap; font-family: inherit; background: none; color: inherit; padding: 0;">${content}</pre>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "document"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Apply Starter Template
  const handleApplyTemplate = (tmpl: (typeof STARTER_TEMPLATES)[0]) => {
    if (content.trim().length > 0 && !confirm("Replace current content with this template?")) return;
    setTitle(tmpl.title);
    setIcon(tmpl.icon);
    setTags(tmpl.tags);
    setContent(tmpl.content);
    handleContentChange(tmpl.content);
    setIsTemplatePickerOpen(false);
  };

  // Execute Slash Command
  const executeSlashCommand = (snippet: string) => {
    if (viewMode === "edit" && activeLineIndex !== null) {
      const lines = content.split("\n");
      const currentLine = lines[activeLineIndex] || "";
      const slashIndex = currentLine.lastIndexOf("/");

      if (snippet.includes("\n")) {
        const snippetLines = snippet.trim().split("\n");
        const newLines = [
          ...lines.slice(0, activeLineIndex),
          ...snippetLines,
          ...lines.slice(activeLineIndex + 1),
        ];
        handleContentChange(newLines.join("\n"));
        setActiveLineIndex(activeLineIndex + snippetLines.length - 1);
      } else {
        const cleanText = currentLine
          .replace(/^(#{1,3}\s+|-\s*\[[ xX]\]\s+|[-*]\s+|\d+\.\s+|>\s*)/, "")
          .replace(/\/([a-zA-Z0-9_-]*)$/, "");
        lines[activeLineIndex] = snippet + cleanText.trim();
        handleContentChange(lines.join("\n"));
      }

      setSlashMenu({ visible: false, query: "", selectedIndex: 0, pos: 0 });
      return;
    }

    if (!textareaRef.current) return;
    const val = content;
    const start = slashMenu.pos;
    const end = textareaRef.current.selectionStart;
    const newContent = val.slice(0, start) + snippet + val.slice(end);
    handleContentChange(newContent);
    setSlashMenu({ visible: false, query: "", selectedIndex: 0, pos: 0 });
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = start + snippet.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  // Slash commands registry
  const slashCommands = [
    {
      id: "h1",
      label: "Heading 1",
      description: "Large section header",
      icon: <Heading1 size={16} />,
      execute: () => executeSlashCommand("# "),
    },
    {
      id: "h2",
      label: "Heading 2",
      description: "Medium section header",
      icon: <Heading1 size={14} />,
      execute: () => executeSlashCommand("## "),
    },
    {
      id: "h3",
      label: "Heading 3",
      description: "Small section header",
      icon: <Heading1 size={12} />,
      execute: () => executeSlashCommand("### "),
    },
    {
      id: "table",
      label: "Table",
      description: "Add a 3x3 GFM markdown table",
      icon: <TableIcon size={16} />,
      execute: () =>
        executeSlashCommand(
          "\n| Feature | Status | Assignee |\n| :--- | :---: | ---: |\n| Document Sync | Done | Engineering lead |\n| Kanban Tasks | In Progress | Product team |\n| Workspace Media | Todo | Unassigned |\n\n"
        ),
    },
    {
      id: "callout_tip",
      label: "Callout: Tip",
      description: "Emerald highlighted tip box",
      icon: <Lightbulb size={16} color="var(--accent)" />,
      execute: () => executeSlashCommand("> [!TIP]\n> Your tip goes here\n\n"),
    },
    {
      id: "callout_warning",
      label: "Callout: Warning",
      description: "Amber warning card",
      icon: <AlertTriangle size={16} color="#D97706" />,
      execute: () => executeSlashCommand("> [!WARNING]\n> Your warning goes here\n\n"),
    },
    {
      id: "callout_note",
      label: "Callout: Note",
      description: "Informational note box",
      icon: <Lightbulb size={16} color="#0284C7" />,
      execute: () => executeSlashCommand("> [!NOTE]\n> Your note goes here\n\n"),
    },
    {
      id: "toggle",
      label: "Toggle Accordion",
      description: "Collapsible details section",
      icon: <ChevronRight size={16} />,
      execute: () => executeSlashCommand("> [toggle] Section Details\n> Content hidden inside toggle\n\n"),
    },
    {
      id: "code",
      label: "Code Block",
      description: "Syntax highlighted code card",
      icon: <Code size={16} />,
      execute: () => executeSlashCommand("```typescript\n// code here\n```\n"),
    },
    {
      id: "todo",
      label: "To-do Checklist",
      description: "Interactive task checklist item",
      icon: <CheckSquare size={16} />,
      execute: () => executeSlashCommand("- [ ] "),
    },
    {
      id: "bullet",
      label: "Bulleted List",
      description: "Simple bulleted list item",
      icon: <List size={16} />,
      execute: () => executeSlashCommand("- "),
    },
    {
      id: "num",
      label: "Numbered List",
      description: "Numbered list item",
      icon: <ListOrdered size={16} />,
      execute: () => executeSlashCommand("1. "),
    },
    {
      id: "quote",
      label: "Quote",
      description: "Capture a quote with accent bar",
      icon: <Quote size={16} />,
      execute: () => executeSlashCommand("> "),
    },
    {
      id: "divider",
      label: "Divider",
      description: "Visually separate sections",
      icon: <Minus size={16} />,
      execute: () => executeSlashCommand("\n---\n\n"),
    },
    {
      id: "toc",
      label: "Table of Contents",
      description: "Auto-generated document outline",
      icon: <List size={16} color="var(--accent)" />,
      execute: () => executeSlashCommand("\n[TOC]\n\n"),
    },
  ];

  const filteredSlashCommands = slashCommands.filter(
    (c) =>
      c.label.toLowerCase().includes(slashMenu.query) ||
      c.id.toLowerCase().includes(slashMenu.query)
  );

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    handleContentChange(val);

    const pos = e.target.selectionStart;
    const textBefore = val.slice(0, pos);

    // Detect / command trigger
    const slashMatch = textBefore.match(/(?:^|\n|\s)\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch) {
      setSlashMenu({
        visible: true,
        query: slashMatch[1].toLowerCase(),
        selectedIndex: 0,
        pos: pos - slashMatch[1].length - 1,
      });
    } else if (slashMenu.visible) {
      setSlashMenu((prev) => ({ ...prev, visible: false }));
    }

    // Detect @ symbol for autocompletion
    const atMatch = textBefore.match(/@([a-zA-Z0-9._ ]*)$/);
    if (atMatch) {
      setMentionPopup({
        visible: true,
        query: atMatch[1].toLowerCase(),
        target: "content",
      });
    } else if (mentionPopup.target === "content") {
      setMentionPopup((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenu.visible && filteredSlashCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenu((prev) => ({
          ...prev,
          selectedIndex: (prev.selectedIndex + 1) % filteredSlashCommands.length,
        }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenu((prev) => ({
          ...prev,
          selectedIndex:
            (prev.selectedIndex - 1 + filteredSlashCommands.length) % filteredSlashCommands.length,
        }));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filteredSlashCommands[slashMenu.selectedIndex]?.execute();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSlashMenu((prev) => ({ ...prev, visible: false }));
      }
    }
  };

  const handleSelectMention = (member: WorkspaceMember) => {
    if (mentionPopup.target === "content") {
      if (viewMode === "edit" && activeLineIndex !== null) {
        const lines = content.split("\n");
        const currentLine = lines[activeLineIndex] || "";
        const atIndex = currentLine.lastIndexOf("@");
        if (atIndex !== -1) {
          lines[activeLineIndex] = currentLine.slice(0, atIndex) + `@${member.name} `;
          handleContentChange(lines.join("\n"));
        }
      } else if (textareaRef.current) {
        const pos = textareaRef.current.selectionStart;
        const textBefore = content.slice(0, pos);
        const textAfter = content.slice(pos);
        const atIndex = textBefore.lastIndexOf("@");
        if (atIndex !== -1) {
          const newText = textBefore.slice(0, atIndex) + `@${member.name} ` + textAfter;
          handleContentChange(newText);
        }
      }
    } else if (mentionPopup.target === "comment") {
      const atIndex = commentText.lastIndexOf("@");
      if (atIndex !== -1) {
        setCommentText(commentText.slice(0, atIndex) + `@${member.name} `);
      } else {
        setCommentText((prev) => prev + `@${member.name} `);
      }
    }
    setMentionPopup({ visible: false, query: "", target: "content" });
  };

  const handleCursorMove = () => {
    if (!textareaRef.current || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN)
      return;
    const selStart = textareaRef.current.selectionStart;
    socketRef.current.send(
      JSON.stringify({
        type: "cursor",
        cursor: { line: 0, ch: selStart },
      })
    );
  };

  const applyFormat = (prefix: string, suffix: string = "") => {
    if (viewMode === "edit" && activeLineIndex !== null) {
      const lines = content.split("\n");
      const current = lines[activeLineIndex] || "";
      if (!suffix) {
        const clean = current.replace(/^(#{1,3}\s+|-\s*\[[ xX]\]\s+|[-*]\s+|\d+\.\s+|>\s*)/, "");
        lines[activeLineIndex] = `${prefix}${clean}`;
      } else {
        lines[activeLineIndex] = `${prefix}${current}${suffix}`;
      }
      handleContentChange(lines.join("\n"));
      return;
    }

    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd, value } = textareaRef.current;
    const selectedText = value.substring(selectionStart, selectionEnd) || "text";
    const replacement = `${prefix}${selectedText}${suffix}`;
    const newContent =
      value.substring(0, selectionStart) + replacement + value.substring(selectionEnd);
    handleContentChange(newContent);
  };

  const toggleCheckbox = (lineIndex: number) => {
    const lines = content.split("\n");
    const targetLine = lines[lineIndex];
    if (targetLine.includes("- [ ]")) {
      lines[lineIndex] = targetLine.replace("- [ ]", "- [x]");
    } else if (targetLine.includes("- [x]")) {
      lines[lineIndex] = targetLine.replace("- [x]", "- [ ]");
    }
    handleContentChange(lines.join("\n"));
  };

  const handlePostComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    setCommentFeedback(null);

    try {
      const res = await fetch(
        `/api/docs/${docId}/comments?user=${encodeURIComponent(currentUser.email)}`,
        {
          method: "POST",
          headers: getAuthHeaders({
            "Content-Type": "application/json",
            "x-workspace-id": workspaceId,
          }),
          body: JSON.stringify({
            text: commentText.trim(),
            documentTitle: title,
          }),
        }
      );

      if (res.ok) {
        const newComment: DocComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        if (newComment.mentions && newComment.mentions.length > 0) {
          setCommentFeedback(
            `Email notification dispatched to ${newComment.mentions.join(", ")}!`
          );
          setTimeout(() => setCommentFeedback(null), 4000);
        }
        setCommentText("");
      }
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!mentionPopup.query) return true;
    return (
      m.name.toLowerCase().includes(mentionPopup.query) ||
      m.email.toLowerCase().includes(mentionPopup.query)
    );
  });

  const lines = content.split("\n");

  return (
    <div
      className="animate-fade-in editor-workspace"
      style={{
        display: "flex",
        width: "100%",
        minHeight: "calc(100vh - 64px)",
        minWidth: 0,
        maxWidth: "100%",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      {/* Main Document Content Area */}
      <div
        className="editor-content"
        style={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          padding: cover ? "0 64px 120px 64px" : "32px 64px 120px 64px",
          maxWidth: "860px",
          margin: "0 auto",
          position: "relative",
        }}
      >
        {/* Cover Banner Area */}
        {cover && (
          <div
            className="editor-cover"
            style={{
              height: "180px",
              background: cover,
              borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
              marginBottom: "32px",
              position: "relative",
              marginLeft: "-64px",
              marginRight: "-64px",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setIsCoverPickerOpen(true)}
                className="btn-secondary"
                style={{ fontSize: "11px", padding: "4px 8px", backgroundColor: "rgba(0,0,0,0.6)", color: "#FFF", border: "none" }}
              >
                <Palette size={12} /> Change Cover
              </button>
              <button
                onClick={() => handleUpdateCover(null)}
                className="btn-secondary"
                style={{ fontSize: "11px", padding: "4px 8px", backgroundColor: "rgba(0,0,0,0.6)", color: "#FFF", border: "none" }}
              >
                <X size={12} /> Remove
              </button>
            </div>
          </div>
        )}

        {/* Cover / Icon Action Row when no cover exists */}
        {!cover && (
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <button
              onClick={() => setIsEmojiPickerOpen(true)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "12px",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Tag size={13} /> Change icon
            </button>
            <button
              onClick={() => setIsCoverPickerOpen(true)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "12px",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Palette size={13} /> Add cover
            </button>
          </div>
        )}

        {/* Cover Picker Popover */}
        {isCoverPickerOpen && (
          <div
            className="animate-fade-in"
            style={{
              position: "absolute",
              top: cover ? "120px" : "60px",
              right: "64px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
              padding: "12px",
              zIndex: 100,
              width: "240px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
              Curated Gradients
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {COVER_PRESETS.map((cp) => (
                <button
                  key={cp.name}
                  onClick={() => handleUpdateCover(cp.style)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "transparent",
                    border: "none",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-nav-active)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div style={{ width: "24px", height: "18px", borderRadius: "3px", background: cp.style }} />
                  <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>{cp.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Page Icon & Picker */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: "8px" }}>
          <button
            onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
            style={{
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer",
              borderRadius: "8px",
            }}
            title="Click to change page icon"
          >
            {renderPageIcon(icon, 22)}
          </button>

          {isEmojiPickerOpen && (
            <div
              className="animate-fade-in"
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
                padding: "10px",
                zIndex: 100,
                width: "220px",
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "6px",
              }}
            >
              {PAGE_ICON_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleUpdateIcon(item.id)}
                  style={{
                    height: "36px",
                    background: icon === item.id ? "var(--bg-nav-active)" : "transparent",
                    border: icon === item.id ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                    color: icon === item.id ? "var(--accent)" : "var(--text-secondary)",
                    cursor: "pointer",
                    padding: "4px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title={item.label}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-nav-active)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = icon === item.id ? "var(--bg-nav-active)" : "transparent")}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Document Header Row: Tags & Actions Bar */}
        <div
          className="editor-formatting-toolbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {/* Tags */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {tags.map((tag, i) => (
              <span
                key={i}
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--accent-text)",
                  letterSpacing: "0.01em",
                }}
              >
                {tag}
              </span>
            ))}
            <button
              onClick={() => {
                const newTag = prompt("Enter tag name (e.g. #project):");
                if (newTag) setTags([...tags, newTag.startsWith("#") ? newTag : `#${newTag}`]);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              title="Add tag"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Action Tools: Star, Share, History, Export, Templates, View Modes */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Favorite Star */}
            <button
              onClick={handleToggleFavorite}
              className="btn-icon"
              title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              style={{ width: "28px", height: "28px" }}
            >
              <Star
                size={15}
                color={isFavorite ? "#F59E0B" : "var(--text-muted)"}
                fill={isFavorite ? "#F59E0B" : "none"}
              />
            </button>

            {/* Share to Web */}
            <button
              onClick={() => setIsShareOpen(true)}
              className="btn-icon"
              title="Publish to Web / Share Link"
              style={{
                width: "auto",
                padding: "3px 8px",
                height: "26px",
                fontSize: "12px",
                color: isPublic ? "var(--accent)" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Globe size={13} />
              <span>{isPublic ? "Shared" : "Share"}</span>
            </button>

            {/* Version History */}
            <button
              onClick={() => {
                setIsHistoryOpen(true);
                loadRevisions();
              }}
              className="btn-icon"
              title="Document Revision History"
              style={{
                width: "auto",
                padding: "3px 8px",
                height: "26px",
                fontSize: "12px",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <History size={13} />
              <span>History</span>
            </button>

            {/* Templates */}
            <button
              onClick={() => setIsTemplatePickerOpen(true)}
              className="btn-icon"
              title="Starter Templates"
              style={{
                width: "auto",
                padding: "3px 8px",
                height: "26px",
                fontSize: "12px",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Sparkles size={13} />
              <span>Templates</span>
            </button>

            {/* Export Menu */}
            <button
              onClick={handleExportMarkdown}
              className="btn-icon"
              title="Export as Markdown (.md)"
              style={{
                width: "auto",
                padding: "3px 8px",
                height: "26px",
                fontSize: "12px",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Download size={13} />
              <span>Export</span>
            </button>

            {/* View Mode Switcher: Edit | Split | Preview */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "2px",
                gap: "2px",
              }}
            >
              <button
                onClick={() => setViewMode("edit")}
                className="btn-icon"
                style={{
                  width: "auto",
                  padding: "3px 8px",
                  height: "24px",
                  fontSize: "11px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: viewMode === "edit" ? "var(--bg-nav-active)" : "transparent",
                  color: viewMode === "edit" ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: viewMode === "edit" ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Live Editor (Renders regular unless editing that line)"
              >
                <Edit3 size={11} /> Edit
              </button>
              <button
                onClick={() => setViewMode("source")}
                className="btn-icon"
                style={{
                  width: "auto",
                  padding: "3px 8px",
                  height: "24px",
                  fontSize: "11px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: viewMode === "source" ? "var(--bg-nav-active)" : "transparent",
                  color: viewMode === "source" ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: viewMode === "source" ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Raw Markdown Source"
              >
                <Code size={11} /> Source
              </button>
              <button
                onClick={() => setViewMode("split")}
                className="btn-icon"
                style={{
                  width: "auto",
                  padding: "3px 8px",
                  height: "24px",
                  fontSize: "11px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: viewMode === "split" ? "var(--bg-nav-active)" : "transparent",
                  color: viewMode === "split" ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: viewMode === "split" ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Side-by-side Live Split View"
              >
                <Columns size={11} /> Split
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className="btn-icon"
                style={{
                  width: "auto",
                  padding: "3px 8px",
                  height: "24px",
                  fontSize: "11px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: viewMode === "preview" ? "var(--bg-nav-active)" : "transparent",
                  color: viewMode === "preview" ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: viewMode === "preview" ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Rendered Document Preview"
              >
                <Eye size={11} /> Preview
              </button>
            </div>
          </div>
        </div>

        {/* Document Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled Document"
          className="font-serif"
          style={{
            width: "100%",
            fontSize: "38px",
            fontWeight: 600,
            lineHeight: 1.2,
            color: "var(--text-primary)",
            background: "transparent",
            border: "none",
            outline: "none",
            marginBottom: "24px",
            letterSpacing: "-0.02em",
          }}
        />

        {/* If document is completely empty, offer 1-click starter template cards */}
        {content.trim().length === 0 && (
          <div
            style={{
              padding: "24px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              marginBottom: "24px",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
              Get started with a template
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
              Click any template to populate the document, or type <code style={{ color: "var(--accent)" }}>/</code> in the editor for blocks.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
              {STARTER_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleApplyTemplate(tmpl)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                >
                  <div style={{ flexShrink: 0 }}>{renderTemplateIcon(tmpl.id)}</div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{tmpl.title}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tmpl.tags.join(" ")}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Checkbox Items Rendered Above Editor in Source mode only */}
        {viewMode === "source" && (
          <div style={{ marginBottom: "20px" }}>
            {lines.map((line, idx) => {
              if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) {
                const isChecked = line.startsWith("- [x] ");
                const itemText = line.replace(/^- \[[ x]\] /, "");
                return (
                  <div
                    key={idx}
                    onClick={() => toggleCheckbox(idx)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "4px 0",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "3px",
                        backgroundColor: isChecked ? "var(--accent)" : "transparent",
                        border: `1.5px solid ${isChecked ? "var(--accent)" : "var(--border-subtle)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.1s ease",
                      }}
                    >
                      {isChecked && <CheckSquare size={12} color="#FFFFFF" />}
                    </div>
                    <span
                      style={{
                        fontSize: "15px",
                        color: isChecked ? "var(--text-secondary)" : "var(--text-primary)",
                        textDecoration: isChecked ? "line-through" : "none",
                      }}
                    >
                      {itemText}
                    </span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}

        {/* Document Body: Preview vs Split vs Source vs Edit (Live WYSIWYG) */}
        {viewMode === "preview" ? (
          <div style={{ minHeight: "450px", padding: "12px 0" }}>
            <MarkdownRenderer content={content} onToggleCheckbox={toggleCheckbox} members={members} />
          </div>
        ) : viewMode === "split" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px", minHeight: "500px" }}>
            <div style={{ position: "relative" }}>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                onSelect={handleCursorMove}
                onKeyUp={handleCursorMove}
                placeholder="Type '/' for slash commands, '@' to mention a teammate..."
                rows={20}
                style={{
                  width: "100%",
                  minHeight: "450px",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "vertical",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  lineHeight: 1.7,
                  letterSpacing: "-0.01em",
                }}
              />
            </div>

            {/* Split View: Live Rendered Markdown & Tables */}
            <div
              style={{
                borderLeft: "1px solid var(--border-subtle)",
                paddingLeft: "28px",
                overflowY: "auto",
                maxHeight: "calc(100vh - 220px)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Eye size={12} color="var(--accent)" /> Live Markdown & Table Preview
              </div>
              <MarkdownRenderer content={content} onToggleCheckbox={toggleCheckbox} members={members} />
            </div>
          </div>
        ) : viewMode === "source" ? (
          <div style={{ position: "relative" }}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onSelect={handleCursorMove}
              onKeyUp={handleCursorMove}
              placeholder="Type raw markdown here..."
              rows={22}
              style={{
                width: "100%",
                minHeight: "450px",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "vertical",
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "14px",
                lineHeight: 1.7,
                letterSpacing: "0",
              }}
            />
          </div>
        ) : (
          <LiveMarkdownEditor
            content={content}
            onChange={handleContentChange}
            members={members}
            activeLineIndex={activeLineIndex}
            onActiveLineChange={setActiveLineIndex}
            slashMenuVisible={slashMenu.visible}
            onSlashKeyDown={handleKeyDown}
            onSlashTrigger={(query, lineIdx, caretPos) => {
              setSlashMenu({
                visible: true,
                query,
                selectedIndex: 0,
                pos: caretPos,
              });
            }}
            onMentionTrigger={(query, lineIdx, caretPos) => {
              setMentionPopup({
                visible: true,
                query,
                target: "content",
              });
            }}
            onCursorMove={(lineIdx, ch) => {
              if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.send(
                  JSON.stringify({
                    type: "cursor",
                    user: currentUser.email,
                    name: currentUser.name,
                    color: "#1E7D6B",
                    line: lineIdx,
                    ch,
                  })
                );
              }
            }}
            activeOverlay={
              <>
                {slashMenu.visible && filteredSlashCommands.length > 0 && (
                  <div
                    ref={slashMenuRef}
                    className="animate-fade-in"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "0",
                      width: "320px",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      boxShadow: "0 14px 32px rgba(0, 0, 0, 0.45)",
                      zIndex: 100,
                      padding: "6px",
                      marginTop: "6px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        padding: "6px 8px",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Blocks & Formatting
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        maxHeight: "240px",
                        overflowY: "auto",
                      }}
                    >
                      {filteredSlashCommands.map((item, idx) => {
                        const isSelected = idx === slashMenu.selectedIndex;
                        return (
                          <button
                            key={item.id}
                            onClick={item.execute}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              padding: "8px 10px",
                              borderRadius: "var(--radius-sm)",
                              border: "none",
                              backgroundColor: isSelected ? "var(--bg-nav-active)" : "transparent",
                              color: "var(--text-primary)",
                              cursor: "pointer",
                              textAlign: "left",
                              width: "100%",
                            }}
                            onMouseEnter={() =>
                              setSlashMenu((prev) => ({ ...prev, selectedIndex: idx }))
                            }
                          >
                            <div
                              style={{
                                color: "var(--accent)",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              {item.icon}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                minWidth: 0,
                                flex: 1,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: isSelected ? 600 : 500,
                                }}
                              >
                                {item.label}
                              </span>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                {item.description}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {mentionPopup.visible &&
                  mentionPopup.target === "content" &&
                  filteredMembers.length > 0 && (
                    <div
                      ref={mentionPopupRef}
                      className="animate-fade-in"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: "0",
                        width: "280px",
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35)",
                        zIndex: 100,
                        padding: "6px",
                        marginTop: "6px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          padding: "6px 8px",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Mention Teammate (Email will be sent)
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          maxHeight: "180px",
                          overflowY: "auto",
                        }}
                      >
                        {filteredMembers.map((m) => (
                          <button
                            key={m.email}
                            onClick={() => handleSelectMention(m)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              padding: "6px 8px",
                              borderRadius: "var(--radius-sm)",
                              border: "none",
                              backgroundColor: "transparent",
                              color: "var(--text-primary)",
                              cursor: "pointer",
                              textAlign: "left",
                              width: "100%",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = "var(--bg-nav-active)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = "transparent")
                            }
                          >
                            <img
                              src={
                                m.avatar ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                  m.email
                                )}`
                              }
                              alt={m.name}
                              style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {m.name}
                              </span>
                              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                                {m.email}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            }
          />
        )}

        {/* Fallback Slash Command Palette Popup for Source / Split mode */}
        {viewMode !== "edit" && slashMenu.visible && filteredSlashCommands.length > 0 && (
          <div
            ref={slashMenuRef}
            className="animate-fade-in"
            style={{
              position: "absolute",
              top: "220px",
              left: "64px",
              width: "320px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 14px 32px rgba(0, 0, 0, 0.45)",
              zIndex: 100,
              padding: "6px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                padding: "6px 8px",
                letterSpacing: "0.05em",
              }}
            >
              Blocks & Formatting
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "240px", overflowY: "auto" }}>
              {filteredSlashCommands.map((item, idx) => {
                const isSelected = idx === slashMenu.selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={item.execute}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      backgroundColor: isSelected ? "var(--bg-nav-active)" : "transparent",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                    }}
                    onMouseEnter={() => setSlashMenu((prev) => ({ ...prev, selectedIndex: idx }))}
                  >
                    <div style={{ color: "var(--accent)", display: "flex", alignItems: "center" }}>
                      {item.icon}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: "13px", fontWeight: isSelected ? 600 : 500 }}>{item.label}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fallback Mention Autocomplete Dropdown Popup for Source / Split mode */}
        {viewMode !== "edit" && mentionPopup.visible && mentionPopup.target === "content" && filteredMembers.length > 0 && (
          <div
            ref={mentionPopupRef}
            className="animate-fade-in"
            style={{
              position: "absolute",
              top: "220px",
              left: "64px",
              width: "280px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35)",
              zIndex: 100,
              padding: "6px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                padding: "6px 8px",
                letterSpacing: "0.05em",
              }}
            >
              Mention Teammate (Email will be sent)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "180px", overflowY: "auto" }}>
              {filteredMembers.map((m) => (
                <button
                  key={m.email}
                  onClick={() => handleSelectMention(m)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "6px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-nav-active)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <img
                    src={m.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.email)}`}
                    alt={m.name}
                    style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {m.name}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                      {m.email}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Floating Formatting Toolbar */}
        <div
          style={{
            position: "fixed",
            bottom: "32px",
            left: "calc(var(--sidebar-width) + 32px)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "var(--shadow-md)",
            zIndex: 20,
          }}
        >
          <button
            onClick={() => applyFormat("# ", "")}
            className="btn-icon font-serif"
            style={{ fontSize: "14px", fontWeight: 700 }}
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => applyFormat("## ", "")}
            className="btn-icon font-serif"
            style={{ fontSize: "13px", fontWeight: 700 }}
            title="Heading 2"
          >
            H2
          </button>
          <button
            onClick={() => applyFormat("**", "**")}
            className="btn-icon"
            style={{ fontWeight: 700 }}
            title="Bold"
          >
            <Bold size={15} />
          </button>
          <button
            onClick={() => applyFormat("*", "*")}
            className="btn-icon"
            title="Italic"
          >
            <Italic size={15} />
          </button>
          <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-subtle)" }} />
          {/* Table */}
          <button
            onClick={() =>
              executeSlashCommand(
                "\n| Feature | Status | Assignee |\n| :--- | :---: | ---: |\n| Document Sync | Done | Engineering lead |\n| Kanban Tasks | In Progress | Product team |\n| Workspace Media | Todo | Unassigned |\n\n"
              )
            }
            className="btn-icon"
            title="Insert Table"
          >
            <TableIcon size={15} />
          </button>
          {/* Code */}
          <button
            onClick={() => applyFormat("```typescript\n", "\n```")}
            className="btn-icon"
            title="Code Block"
          >
            <Code size={15} />
          </button>
          {/* Quote */}
          <button
            onClick={() => applyFormat("> ", "")}
            className="btn-icon"
            title="Quote Block"
          >
            <Quote size={15} />
          </button>
          <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-subtle)" }} />
          <button
            onClick={() => {
              const url = prompt("Enter link URL:");
              if (url) applyFormat("[", `](${url})`);
            }}
            className="btn-icon"
            title="Link"
          >
            <LinkIcon size={15} />
          </button>
          <button
            onClick={() => applyFormat("- [ ] ", "")}
            className="btn-icon"
            title="Checklist Item"
          >
            <CheckSquare size={15} />
          </button>
          <button
            onClick={() => applyFormat("- ", "")}
            className="btn-icon"
            title="Bullet List"
          >
            <List size={15} />
          </button>
          <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-subtle)" }} />
          {/* Mention Teammate */}
          <button
            onClick={() => {
              if (textareaRef.current) {
                const pos = textareaRef.current.selectionStart;
                const newContent = content.slice(0, pos) + "@" + content.slice(pos);
                handleContentChange(newContent);
                setMentionPopup({ visible: true, query: "", target: "content" });
                textareaRef.current.focus();
              }
            }}
            className="btn-icon"
            style={{ color: "var(--accent)" }}
            title="Mention Teammate (@)"
          >
            <AtSign size={15} />
          </button>
        </div>
      </div>

      {/* Right Sidebar: Attachments & Discussion */}
      {isRightPanelOpen ? <aside
        className="editor-right-panel"
        style={{
          width: "280px",
          minWidth: "280px",
          borderLeft: "1px solid var(--border-subtle)",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          backgroundColor: "var(--bg-primary)",
        }}
      >
        {/* Tab Headers */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "10px", gap: "6px" }}>
          <button
            onClick={() => setActiveTab("attachments")}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "attachments" ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === "attachments" ? "var(--text-primary)" : "var(--text-secondary)",
              padding: "4px 8px",
              fontSize: "13px",
              fontWeight: activeTab === "attachments" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            Files ({attachments.length})
          </button>
          <button
            onClick={() => setActiveTab("discussion")}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "discussion" ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === "discussion" ? "var(--text-primary)" : "var(--text-secondary)",
              padding: "4px 8px",
              fontSize: "13px",
              fontWeight: activeTab === "discussion" ? 600 : 400,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <MessageSquare size={13} />
            Discussion ({comments.length})
          </button>
          <button
            onClick={() => setIsRightPanelOpen(false)}
            className="btn-icon"
            title="Hide files and discussion"
            aria-label="Hide files and discussion"
            style={{ marginLeft: "auto", width: "26px", height: "26px" }}
          >
            <PanelRightClose size={15} />
          </button>
        </div>

        {/* Tab: Attachments */}
        {activeTab === "attachments" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {attachments.map((att) => (
                <div
                  key={att.id}
                  onClick={() => onOpenFilePreview && onOpenFilePreview(att)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-focus)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                    {att.name.endsWith(".png") || att.name.endsWith(".jpg") ? (
                      <ImageIcon size={16} color="var(--accent)" />
                    ) : (
                      <FileText size={16} color="var(--accent)" />
                    )}
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 400,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {att.name}
                    </span>
                  </div>
                  <a
                    href={att.url}
                    download={att.name}
                    onClick={(e) => e.stopPropagation()}
                    className="btn-icon"
                    style={{ width: "24px", height: "24px" }}
                  >
                    <Download size={13} />
                  </a>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                const fileName = prompt("Enter attachment name from Drive (e.g. brand_guidelines.pdf):");
                if (fileName) {
                  const newAtt: DocAttachment = {
                    id: `att-${Date.now()}`,
                    name: fileName,
                    type: "application/octet-stream",
                    size: 1048576,
                    url: `/api/files/sample/${encodeURIComponent(fileName)}`,
                  };
                  const updated = [...attachments, newAtt];
                  setAttachments(updated);
                  fetch(`/api/docs/${docId}`, {
                    method: "PUT",
                    headers: getAuthHeaders({
                      "Content-Type": "application/json",
                      "x-workspace-id": workspaceId,
                    }),
                    body: JSON.stringify({ title, content, tags, attachments: updated, icon, cover }),
                  });
                }
              }}
              className="btn-secondary"
              style={{ width: "100%", justifyContent: "center", fontSize: "12px" }}
            >
              <Paperclip size={14} /> Attach from Drive
            </button>
          </div>
        )}

        {/* Tab: Discussion & Mentions */}
        {activeTab === "discussion" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1, minHeight: 0 }}>
            {commentFeedback && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  color: "var(--accent)",
                  backgroundColor: "rgba(30, 125, 107, 0.15)",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid rgba(30, 125, 107, 0.3)",
                }}
              >
                <Check size={12} /> {commentFeedback}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "350px", overflowY: "auto" }}>
              {comments.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "20px 0" }}>
                  No comments yet. Mention a teammate with @ to notify them via email!
                </div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "8px 10px",
                      backgroundColor: "var(--bg-surface)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <img
                        src={c.user.avatar}
                        alt={c.user.name}
                        style={{ width: "20px", height: "20px", borderRadius: "50%", objectFit: "cover" }}
                      />
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {c.user.name}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.4 }}>
                      {c.text.split(" ").map((word, idx) => {
                        if (word.startsWith("@")) {
                          return (
                            <span key={idx} style={{ color: "var(--accent)", fontWeight: 600 }}>
                              {word}{" "}
                            </span>
                          );
                        }
                        return word + " ";
                      })}
                    </div>
                    {c.mentions && c.mentions.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", fontSize: "10px", color: "var(--accent)" }}>
                        <Mail size={10} /> Email sent to {c.mentions.join(", ")}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Post Comment Input */}
            <form onSubmit={handlePostComment} style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ position: "relative" }}>
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => {
                    setCommentText(e.target.value);
                    const pos = e.target.selectionStart;
                    const textBefore = e.target.value.slice(0, pos);
                    const atMatch = textBefore.match(/@([a-zA-Z0-9._ ]*)$/);
                    if (atMatch) {
                      setMentionPopup({
                        visible: true,
                        query: atMatch[1].toLowerCase(),
                        target: "comment",
                      });
                    } else if (mentionPopup.target === "comment") {
                      setMentionPopup((prev) => ({ ...prev, visible: false }));
                    }
                  }}
                  placeholder="Add a comment... (Type @ to mention)"
                  style={{
                    width: "100%",
                    padding: "8px",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    outline: "none",
                    resize: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    setCommentText((prev) => prev + "@");
                    setMentionPopup({ visible: true, query: "", target: "comment" });
                  }}
                  className="btn-icon"
                  style={{ width: "24px", height: "24px" }}
                  title="Mention Teammate (@)"
                >
                  <AtSign size={13} />
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingComment || !commentText.trim()}
                  className="btn-primary"
                  style={{
                    padding: "4px 12px",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    opacity: isSubmittingComment || !commentText.trim() ? 0.6 : 1,
                  }}
                >
                  <Send size={12} />
                  <span>Send</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </aside> : (
        <button
          className="editor-right-panel-toggle"
          onClick={() => setIsRightPanelOpen(true)}
          title="Show files and discussion"
          aria-label="Show files and discussion"
        >
          <PanelRightOpen size={17} />
        </button>
      )}

      {/* Notion-Style Share & Invite Modal */}
      {isShareOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsShareOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="modal-content animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "500px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Share2 size={18} color="var(--accent)" />
                <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                  Share Document
                </h3>
              </div>
              <button onClick={() => setIsShareOpen(false)} className="btn-icon">
                <X size={16} />
              </button>
            </div>

            {/* Notion-Style Tab Navigation */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                padding: "3px",
                backgroundColor: "var(--bg-primary)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                marginBottom: "20px",
              }}
            >
              <button
                type="button"
                onClick={() => setShareTab("invite")}
                style={{
                  flex: 1,
                  padding: "7px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  backgroundColor: shareTab === "invite" ? "var(--bg-surface)" : "transparent",
                  color: shareTab === "invite" ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: shareTab === "invite" ? 600 : 400,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  boxShadow: shareTab === "invite" ? "var(--shadow-sm)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <UserPlus size={14} />
                <span>Share & Invite</span>
              </button>
              <button
                type="button"
                onClick={() => setShareTab("publish")}
                style={{
                  flex: 1,
                  padding: "7px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  backgroundColor: shareTab === "publish" ? "var(--bg-surface)" : "transparent",
                  color: shareTab === "publish" ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: shareTab === "publish" ? 600 : 400,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  boxShadow: shareTab === "publish" ? "var(--shadow-sm)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <Globe size={14} />
                <span>Publish to Web</span>
              </button>
            </div>

            {/* Tab 1: Share & Invite */}
            {shareTab === "invite" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* 1-Click Document Invite Link */}
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                      <Link2 size={14} color="var(--accent)" />
                      <span>Document Invite Link</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      Opens directly to this page
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}?join=${workspaceId || "default"}&doc=${docId}`}
                      style={{
                        flex: 1,
                        fontSize: "12px",
                        padding: "7px 10px",
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text-primary)",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}?join=${workspaceId || "default"}&doc=${docId}`);
                        setCopiedDocInvite(true);
                        setTimeout(() => setCopiedDocInvite(false), 2500);
                      }}
                      className="btn-primary"
                      style={{
                        padding: "6px 14px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {copiedDocInvite ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedDocInvite ? "Copied!" : "Copy Link"}</span>
                    </button>
                  </div>
                </div>

                {/* Direct Email Invite Form */}
                <form onSubmit={handleInviteToDoc} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Invite Collaborator by Email
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="email"
                      placeholder="teammate@company.com"
                      value={inviteDocEmail}
                      onChange={(e) => setInviteDocEmail(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        fontSize: "12px",
                        backgroundColor: "var(--bg-primary)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <select
                      value={inviteDocRole}
                      onChange={(e) => setInviteDocRole(e.target.value as any)}
                      style={{
                        padding: "8px 10px",
                        fontSize: "12px",
                        backgroundColor: "var(--bg-primary)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <option value="member">Can edit</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isDocInviting}
                      className="btn-primary"
                      style={{ padding: "8px 16px", fontSize: "12px", whiteSpace: "nowrap" }}
                    >
                      {isDocInviting ? "Inviting..." : "Invite"}
                    </button>
                  </div>
                  {docInviteError && (
                    <span style={{ fontSize: "12px", color: "#ef4444" }}>{docInviteError}</span>
                  )}
                  {docInviteSuccess && (
                    <span style={{ fontSize: "12px", color: "var(--accent)" }}>{docInviteSuccess}</span>
                  )}
                </form>

                {/* Member Roster List */}
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
                    Who has access ({workspaceMembers.length})
                  </div>
                  <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {workspaceMembers.map((m) => (
                      <div
                        key={m.email}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 8px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--bg-primary)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <img
                            src={m.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.email)}`}
                            alt={m.name}
                            style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }}
                          />
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>{m.name}</div>
                            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{m.email}</div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "10px",
                            backgroundColor: "var(--bg-surface)",
                            color: "var(--text-secondary)",
                            textTransform: "capitalize",
                          }}
                        >
                          {m.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Publish to Web */}
            {shareTab === "publish" && (
              <div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: 1.5 }}>
                  Publishing generates an edge-native, read-only public URL hosted on Cloudflare Workers. Anyone with the link can view this document without requiring an account.
                </div>

                {/* Toggle Switch */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {isPublic ? "Document is Live" : "Private Document"}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {isPublic ? "Public edge link is active" : "Only workspace members can view"}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleShare(!isPublic)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      backgroundColor: isPublic ? "var(--accent)" : "var(--bg-surface)",
                      color: isPublic ? "#FFF" : "var(--text-primary)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {isPublic ? "Enabled" : "Enable"}
                  </button>
                </div>

                {isPublic && publicToken && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Public Web Link
                    </label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/?p=${publicToken}`}
                        style={{
                          flex: 1,
                          padding: "8px 10px",
                          fontSize: "12px",
                          backgroundColor: "var(--bg-primary)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/?p=${publicToken}`);
                          setCopiedShare(true);
                          setTimeout(() => setCopiedShare(false), 2000);
                        }}
                        className="btn-primary"
                        style={{ padding: "8px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        {copiedShare ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedShare ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    backgroundColor: "var(--bg-nav-active)",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Shield size={12} color="var(--accent)" />
                  <span>Discussion comments and internal workspace files are never exposed.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revision History Drawer */}
      {isHistoryOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "360px",
            backgroundColor: "var(--bg-surface)",
            borderLeft: "1px solid var(--border-subtle)",
            boxShadow: "-10px 0 30px rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            padding: "20px",
          }}
          className="animate-fade-in"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <History size={16} color="var(--accent)" />
              <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                Version History
              </h3>
            </div>
            <button onClick={() => setIsHistoryOpen(false)} className="btn-icon">
              <X size={15} />
            </button>
          </div>

          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
            Revisions are automatically captured to Cloudflare R2 on significant document updates.
          </div>

          {isLoadingRevisions ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "13px" }}>
              Loading revisions...
            </div>
          ) : revisions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "13px" }}>
              No previous revisions captured yet. Edit document to create snapshots.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", flex: 1 }}>
              {revisions.map((rev) => (
                <div
                  key={rev.id}
                  style={{
                    padding: "12px",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {new Date(rev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                      {new Date(rev.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>By {rev.author.name}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.3 }}>
                    "{rev.snippet || "Empty document"}"
                  </div>
                  <button
                    onClick={() => handleRestoreRevision(rev.id)}
                    className="btn-secondary"
                    style={{ fontSize: "11px", padding: "4px 8px", marginTop: "4px", alignSelf: "flex-start", gap: "4px" }}
                  >
                    <RotateCcw size={11} /> Restore this version
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Starter Templates Modal */}
      {isTemplatePickerOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsTemplatePickerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="modal-content animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "600px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={18} color="var(--accent)" />
                <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                  Starter Templates
                </h3>
              </div>
              <button onClick={() => setIsTemplatePickerOpen(false)} className="btn-icon">
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {STARTER_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  style={{
                    padding: "14px 16px",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "24px" }}>{tmpl.icon}</span>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{tmpl.title}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tmpl.tags.join(" ")}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="btn-primary"
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
