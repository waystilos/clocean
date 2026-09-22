import React, { useState } from "react";
import {
  X,
  Sparkles,
  FolderPlus,
  Layers,
  Briefcase,
  Cpu,
  Globe,
  Terminal,
  Shield,
  Zap,
  Box,
  Compass,
  Layout,
  Tag,
  Code,
} from "lucide-react";
import { UserWorkspaceReference, UserProfile } from "../types.ts";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newWorkspace: UserWorkspaceReference) => void;
  currentUser: UserProfile;
  sessionToken?: string | null;
}

interface PresetIconItem {
  id: string;
  icon: React.ReactNode;
}

const PRESET_ICONS: PresetIconItem[] = [
  { id: "layers", icon: <Layers size={18} /> },
  { id: "briefcase", icon: <Briefcase size={18} /> },
  { id: "cpu", icon: <Cpu size={18} /> },
  { id: "globe", icon: <Globe size={18} /> },
  { id: "terminal", icon: <Terminal size={18} /> },
  { id: "shield", icon: <Shield size={18} /> },
  { id: "zap", icon: <Zap size={18} /> },
  { id: "box", icon: <Box size={18} /> },
  { id: "compass", icon: <Compass size={18} /> },
  { id: "layout", icon: <Layout size={18} /> },
  { id: "tag", icon: <Tag size={18} /> },
  { id: "code", icon: <Code size={18} /> },
];

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  currentUser,
  sessionToken,
}) => {
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("layers");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a workspace name");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces?user=${encodeURIComponent(currentUser.email)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          icon: selectedIcon,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as any;
        throw new Error(data.error || "Failed to create workspace");
      }

      const created: UserWorkspaceReference = await res.json();
      onCreated(created);
      setName("");
      setSelectedIcon("layers");
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create workspace");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
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
      onClick={onClose}
    >
      <div
        className="animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-nav-active)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <FolderPlus size={20} />
            </div>
            <div>
              <h2
                className="font-serif"
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                Create Team Workspace
              </h2>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  margin: "2px 0 0 0",
                }}
              >
                Isolated documents, notes, tasks, & R2 storage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          {error && (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#ef4444",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          {/* Icon Selector */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Workspace Icon
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: "8px",
              }}
            >
              {PRESET_ICONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedIcon(item.id)}
                  style={{
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color:
                      selectedIcon === item.id
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                    backgroundColor:
                      selectedIcon === item.id
                        ? "var(--bg-nav-active)"
                        : "var(--bg-primary)",
                    border:
                      selectedIcon === item.id
                        ? "2px solid var(--accent)"
                        : "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Workspace Name Input */}
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Workspace Name
            </label>
            <input
              type="text"
              placeholder="e.g. Design Studio, Product Launch, Alpha Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.15s ease",
              }}
            />
          </div>

          {/* Cloudflare R2 Info Callout */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "12px 14px",
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              marginBottom: "24px",
              fontSize: "12px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            <Sparkles size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }} />
            <span>
              Your new workspace is partitioned with its own root tree and R2 storage bucket prefix.
              No database configuration or billing needed.
            </span>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
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
              style={{
                padding: "8px 18px",
                fontSize: "13px",
                opacity: isSubmitting || !name.trim() ? 0.6 : 1,
                cursor: isSubmitting || !name.trim() ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? "Creating..." : "Create Workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
