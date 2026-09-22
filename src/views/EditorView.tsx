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
} from "lucide-react";
import { DocContent, DocAttachment, UserProfile, WorkspaceMember, DocComment } from "../types.ts";

interface EditorViewProps {
  docId: string;
  currentUser: UserProfile;
  workspaceId?: string;
  onUpdateAttachments?: () => void;
  onOpenFilePreview?: (attachment: DocAttachment) => void;
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

export const EditorView: React.FC<EditorViewProps> = ({
  docId,
  currentUser,
  workspaceId = "default",
  onOpenFilePreview,
}) => {
  const [doc, setDoc] = useState<DocContent | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<DocAttachment[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Discussion & Mentions State
  const [activeTab, setActiveTab] = useState<"attachments" | "discussion">("attachments");
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

  // Load initial document from API
  useEffect(() => {
    fetch(`/api/docs/${docId}`, {
      headers: { "x-workspace-id": workspaceId },
    })
      .then((res) => res.json())
      .then((raw) => {
        const data = raw as DocContent;
        setDoc(data);
        setTitle(data.title || "Untitled");
        setTags(data.tags || ["#notes"]);
        setContent(data.content || "");
        setAttachments(data.attachments || []);
      })
      .catch((err) => console.error("Error loading document:", err));
  }, [docId, workspaceId]);

  // Load workspace members for @ mention autocompletion
  useEffect(() => {
    fetch(`/api/workspaces/${workspaceId}/members?user=${encodeURIComponent(currentUser.email)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any) => {
        setMembers(Array.isArray(data) ? data : data?.members || []);
      })
      .catch(() => {});
  }, [workspaceId, currentUser.email]);

  // Load comments
  const loadComments = () => {
    fetch(`/api/docs/${docId}/comments`, {
      headers: { "x-workspace-id": workspaceId },
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
    const wsUrl = `${protocol}//${window.location.host}/api/collab/${docId}?email=${encodeURIComponent(
      currentUser.email
    )}&name=${encodeURIComponent(currentUser.name)}&avatar=${encodeURIComponent(
      currentUser.avatar
    )}&ws=${encodeURIComponent(workspaceId)}`;

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

  // Close mention popup on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionPopupRef.current && !mentionPopupRef.current.contains(e.target as Node)) {
        setMentionPopup((prev) => ({ ...prev, visible: false }));
      }
    };
    if (mentionPopup.visible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mentionPopup.visible]);

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

    // Save fallback to REST API
    const timeout = setTimeout(() => {
      fetch(`/api/docs/${docId}?user=${encodeURIComponent(currentUser.email)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({ title, content: newContent, tags, attachments }),
      }).then(() => setIsSaving(false));
    }, 1500);

    return () => clearTimeout(timeout);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    handleContentChange(val);

    // Detect @ symbol for autocompletion
    const pos = e.target.selectionStart;
    const textBefore = val.slice(0, pos);
    const atMatch = textBefore.match(/@([a-zA-Z0-9._ ]*)$/);
    if (atMatch) {
      setMentionPopup({
        visible: true,
        query: atMatch[1].toLowerCase(),
        target: "content",
      });
    } else {
      setMentionPopup((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    }
  };

  const handleSelectMention = (member: WorkspaceMember) => {
    if (mentionPopup.target === "content" && textareaRef.current) {
      const pos = textareaRef.current.selectionStart;
      const textBefore = content.slice(0, pos);
      const textAfter = content.slice(pos);
      const atIndex = textBefore.lastIndexOf("@");
      if (atIndex !== -1) {
        const newText = textBefore.slice(0, atIndex) + `@${member.name} ` + textAfter;
        handleContentChange(newText);
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
  };

  // Broadcast cursor movements to peers
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

  // Formatting actions
  const applyFormat = (prefix: string, suffix: string = "") => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd, value } = textareaRef.current;
    const selectedText = value.substring(selectionStart, selectionEnd) || "text";
    const replacement = `${prefix}${selectedText}${suffix}`;
    const newContent =
      value.substring(0, selectionStart) + replacement + value.substring(selectionEnd);
    handleContentChange(newContent);
  };

  // Checkbox toggle logic
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

  // Submit comment
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
          headers: {
            "Content-Type": "application/json",
            "x-workspace-id": workspaceId,
          },
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
      className="animate-fade-in"
      style={{
        display: "flex",
        width: "100%",
        minHeight: "calc(100vh - 64px)",
      }}
    >
      {/* Main Document Content Area */}
      <div
        style={{
          flex: 1,
          padding: "48px 64px 120px 64px",
          maxWidth: "860px",
          margin: "0 auto",
          position: "relative",
        }}
      >
        {/* Document Tags */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
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
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Document Title (Matching Figma: Spectral 600 40px) */}
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
            marginBottom: "28px",
            letterSpacing: "-0.02em",
          }}
        />

        {/* Interactive Checkbox Items Rendered Above Editor (if available) */}
        <div style={{ marginBottom: "24px" }}>
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

        {/* Document Body Textarea with Live Multiplayer Remote Carets */}
        <div style={{ position: "relative" }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onSelect={handleCursorMove}
            onKeyUp={handleCursorMove}
            placeholder="Type '/' for commands, '@' to mention a teammate, or start typing..."
            rows={18}
            style={{
              width: "100%",
              minHeight: "450px",
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "vertical",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.75,
              letterSpacing: "-0.01em",
            }}
          />

          {/* Active Collaborators Cursor Overlay Indicator */}
          {Object.values(remoteCursors).map((rc) => (
            <div
              key={rc.user.id}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                padding: "2px 8px",
                borderRadius: "9999px",
                backgroundColor: rc.user.color,
                color: "#FFFFFF",
                fontSize: "11px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <span>●</span> {rc.user.name} typing
            </div>
          ))}

          {/* Mention Autocomplete Dropdown Popup */}
          {mentionPopup.visible && filteredMembers.length > 0 && (
            <div
              ref={mentionPopupRef}
              className="animate-fade-in"
              style={{
                position: "absolute",
                top: "60px",
                left: "20px",
                width: "280px",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35)",
                zIndex: 50,
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
        </div>

        {/* Floating Formatting Toolbar (Matching Figma Editor) */}
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
          <div
            style={{ width: "1px", height: "18px", backgroundColor: "var(--border-subtle)" }}
          />
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
          <div
            style={{ width: "1px", height: "18px", backgroundColor: "var(--border-subtle)" }}
          />
          {/* Mention Teammate Action */}
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
      <aside
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      overflow: "hidden",
                    }}
                  >
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

            {/* Attach File Button */}
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
                    headers: {
                      "Content-Type": "application/json",
                      "x-workspace-id": workspaceId,
                    },
                    body: JSON.stringify({ title, content, tags, attachments: updated }),
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

            {/* Comments Stream */}
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
      </aside>
    </div>
  );
};
