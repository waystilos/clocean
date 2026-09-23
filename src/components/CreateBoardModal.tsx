import React, { useState } from "react";
import { X, Plus, Sparkles } from "lucide-react";

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBoard: (data: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
  }) => Promise<void>;
}

const BOARD_ICONS = ["📋", "🚀", "🎯", "⚡", "🐛", "📦", "🛠️", "💡", "🔥", "✅", "📊", "📌", "🌐", "🎨", "🔬", "📈"];
const ACCENT_COLORS = [
  { name: "Emerald", value: "#1E7D6B" },
  { name: "Ocean", value: "#0284C7" },
  { name: "Violet", value: "#7C3AED" },
  { name: "Amber", value: "#D97706" },
  { name: "Rose", value: "#E11D48" },
  { name: "Slate", value: "#475569" },
  { name: "Indigo", value: "#4F46E5" },
  { name: "Teal", value: "#0D9488" },
];

export const CreateBoardModal: React.FC<CreateBoardModalProps> = ({
  isOpen,
  onClose,
  onCreateBoard,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📋");
  const [color, setColor] = useState("#1E7D6B");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a board name");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onCreateBoard({
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        color,
      });
      setName("");
      setDescription("");
      setIcon("📋");
      setColor("#1E7D6B");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create board");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        className="modal-dialog animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "20px",
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-nav-active)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {icon}
            </span>
            <div>
              <h2
                className="font-serif"
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  margin: 0,
                  color: "var(--text-primary)",
                }}
              >
                Create New Board
              </h2>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  margin: "2px 0 0 0",
                }}
              >
                Add a new project or sprint Kanban board
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ width: "32px", height: "32px" }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div
              style={{
                padding: "8px 12px",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "var(--radius-sm)",
                color: "var(--danger, #ef4444)",
                fontSize: "12px",
              }}
            >
              {error}
            </div>
          )}

          {/* Board Name */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Board Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 Growth Sprints, Mobile App, Bug Triage"
              maxLength={100}
              autoFocus
              className="form-control"
              style={{ width: "100%", fontSize: "13px" }}
            />
          </div>

          {/* Description */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the work tracked on this board..."
              rows={2}
              maxLength={300}
              className="form-control"
              style={{ width: "100%", fontSize: "13px", resize: "none" }}
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Board Icon
            </label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {BOARD_ICONS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "var(--radius-sm)",
                    border: icon === emoji ? "2px solid var(--accent)" : "1px solid var(--border-subtle)",
                    backgroundColor: icon === emoji ? "var(--bg-nav-active)" : "var(--bg-surface)",
                    fontSize: "16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.12s ease",
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color Theme */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Accent Color
            </label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {ACCENT_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  title={c.name}
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    backgroundColor: c.value,
                    border: color === c.value ? "2px solid var(--text-primary)" : "2px solid transparent",
                    cursor: "pointer",
                    outline: color === c.value ? "2px solid var(--accent)" : "none",
                    outlineOffset: "1px",
                    transition: "transform 0.1s ease",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              marginTop: "8px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary"
              style={{ padding: "8px 16px", fontSize: "13px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="btn-primary"
              style={{ padding: "8px 18px", fontSize: "13px", gap: "6px" }}
            >
              <Plus size={14} />
              <span>{isSubmitting ? "Creating…" : "Create Board"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
