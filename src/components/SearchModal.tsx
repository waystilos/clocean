import React, { useState, useEffect } from "react";
import { Search, X, FileText, Folder, ListCheck, Image as ImageIcon } from "lucide-react";
import { TreeNode, TaskItem } from "../types.ts";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: TreeNode[];
  tasks: TaskItem[];
  onSelectDoc: (id: string) => void;
  onSelectView: (view: "documents" | "tasks" | "photos") => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  files,
  tasks,
  onSelectDoc,
  onSelectView,
}) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery("");
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredDocs = files.filter(
    (f) =>
      f.type === "doc" &&
      (f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.tags?.some((t) => t.toLowerCase().includes(query.toLowerCase())))
  );

  const filteredFiles = files.filter(
    (f) => f.type === "file" && f.name.toLowerCase().includes(query.toLowerCase())
  );

  const filteredTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "560px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        {/* Search Input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            gap: "12px",
          }}
        >
          <Search size={18} color="var(--text-secondary)" />
          <input
            type="text"
            autoFocus
            placeholder="Search documents, files, tasks, tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "15px",
              fontFamily: "var(--font-sans)",
            }}
          />
          <button onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: "360px", overflowY: "auto", padding: "12px 8px" }}>
          {/* Docs section */}
          {filteredDocs.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  padding: "4px 12px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Documents
              </div>
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => {
                    onSelectDoc(doc.id);
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: "13px",
                    color: "var(--text-primary)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <FileText size={15} color="var(--accent)" />
                  <span style={{ flex: 1 }}>{doc.name}</span>
                  {doc.tags && doc.tags[0] && (
                    <span style={{ fontSize: "11px", color: "var(--accent-text)" }}>{doc.tags[0]}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Files section */}
          {filteredFiles.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  padding: "4px 12px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Files in R2
              </div>
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => {
                    onSelectView("documents");
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: "13px",
                    color: "var(--text-primary)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Folder size={15} color="var(--text-secondary)" />
                  <span style={{ flex: 1 }}>{file.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tasks section */}
          {filteredTasks.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  padding: "4px 12px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Tasks
              </div>
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => {
                    onSelectView("tasks");
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: "13px",
                    color: "var(--text-primary)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <ListCheck size={15} color="var(--text-secondary)" />
                  <span style={{ flex: 1 }}>{task.title}</span>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {filteredDocs.length === 0 && filteredFiles.length === 0 && filteredTasks.length === 0 && (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
              No matches found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
