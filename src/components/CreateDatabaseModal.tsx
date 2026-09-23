import React, { useState } from "react";
import { X, Table2, CheckCircle2 } from "lucide-react";

interface CreateDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, templateId: string) => Promise<void>;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  fields: string[];
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "projects",
    name: "Project Tracker",
    description: "Track tasks, statuses, priorities, and deadlines.",
    fields: ["Name", "Status", "Priority", "Due date"],
  },
  {
    id: "content",
    name: "Content Calendar",
    description: "Schedule articles, newsletters, and social releases.",
    fields: ["Name", "Status", "Channel", "Due date"],
  },
  {
    id: "bugs",
    name: "Bug & Issue Tracker",
    description: "Log bugs, severity, and resolution stages.",
    fields: ["Name", "Status", "Severity", "Due date"],
  },
  {
    id: "simple",
    name: "Simple Table",
    description: "Clean tabular tracker with status and due date.",
    fields: ["Name", "Status", "Due date"],
  },
];

export const CreateDatabaseModal: React.FC<CreateDatabaseModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("projects");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a database name");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onCreate(name.trim(), selectedTemplate);
      setName("");
      setSelectedTemplate("projects");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create database");
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
          maxWidth: "520px",
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
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--accent-light)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Table2 size={20} />
            </div>
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
                Create New Database
              </h2>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  margin: "2px 0 0 0",
                }}
              >
                Structured tabular data stored directly in Cloudflare R2
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
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "18px" }}>
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

          {/* Database Name */}
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
              Database Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 Growth Roadmap, Client CRM, Inventory"
              maxLength={100}
              autoFocus
              className="form-control"
              style={{ width: "100%", fontSize: "13px" }}
            />
          </div>

          {/* Starter Template */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "8px",
              }}
            >
              Select Template
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    style={{
                      padding: "12px",
                      borderRadius: "var(--radius-md)",
                      border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border-subtle)",
                      backgroundColor: isSelected ? "var(--bg-nav-active)" : "var(--bg-surface)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      transition: "all 0.12s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {tmpl.name}
                      </span>
                      {isSelected && <CheckCircle2 size={15} color="var(--accent)" />}
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                      {tmpl.description}
                    </p>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                      {tmpl.fields.map((f) => (
                        <span
                          key={f}
                          style={{
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: "var(--bg-subtle)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
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
              style={{ padding: "8px 20px", fontSize: "13px" }}
            >
              {isSubmitting ? "Creating…" : "Create Database"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
