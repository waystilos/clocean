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
} from "lucide-react";
import { DocContent, DocAttachment, UserProfile } from "../types.ts";

interface EditorViewProps {
  docId: string;
  currentUser: UserProfile;
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

  const socketRef = useRef<WebSocket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load initial document from API
  useEffect(() => {
    fetch(`/api/docs/${docId}`)
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
  }, [docId]);

  // Connect to Cloudflare Durable Object WebSocket for real-time multiplayer editing
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/collab/${docId}?email=${encodeURIComponent(
      currentUser.email
    )}&name=${encodeURIComponent(currentUser.name)}&avatar=${encodeURIComponent(
      currentUser.avatar
    )}`;

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
  }, [docId, currentUser]);

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
      fetch(`/api/docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: newContent, tags, attachments }),
      }).then(() => setIsSaving(false));
    }, 1500);

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
            onChange={(e) => handleContentChange(e.target.value)}
            onSelect={handleCursorMove}
            onKeyUp={handleCursorMove}
            placeholder="Type '/' for commands or start writing your manifesto..."
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
            title="Insert Link"
          >
            <LinkIcon size={15} />
          </button>
          <button
            onClick={() => {
              const imgUrl = prompt("Enter Image URL:");
              if (imgUrl) applyFormat(`\n![Image](${imgUrl})\n`);
            }}
            className="btn-icon"
            title="Embed Image"
          >
            <ImageIcon size={15} />
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
        </div>
      </div>

      {/* Right Sidebar: Attachments (Matching Figma v2-editor) */}
      <aside
        style={{
          width: "260px",
          minWidth: "260px",
          borderLeft: "1px solid var(--border-subtle)",
          padding: "32px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          backgroundColor: "var(--bg-primary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3
            className="font-serif"
            style={{ fontSize: "16px", fontWeight: 500, color: "var(--text-primary)" }}
          >
            Attachments
          </h3>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {attachments.length} files
          </span>
        </div>

        {/* Attachment Card Pills */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {attachments.map((att) => (
            <div
              key={att.id}
              onClick={() => onOpenFilePreview && onOpenFilePreview(att)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, content, tags, attachments: updated }),
              });
            }
          }}
          className="btn-secondary"
          style={{ width: "100%", justifyContent: "center" }}
        >
          <Paperclip size={14} /> Attach from Drive
        </button>
      </aside>
    </div>
  );
};
