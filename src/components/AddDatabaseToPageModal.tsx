import React, { useState, useEffect } from "react";
import {
  X,
  Table2,
  CheckCircle2,
  Plus,
  Trash2,
  Tag,
  Calendar,
  Hash,
  Type,
  Layers,
  Database,
} from "lucide-react";
import { DatabaseProperty, DatabaseSchema } from "../types.ts";

interface AddDatabaseToPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>;
  onInsertDatabase: (databaseId: string, databaseName: string) => void;
}

interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  properties: DatabaseProperty[];
}

const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "projects",
    name: "Project Tracker",
    description: "Track tasks, statuses, priorities, and deadlines.",
    icon: "🚀",
    properties: [
      { id: "status", name: "Status", type: "select", options: ["Not started", "In progress", "In review", "Done"] },
      { id: "priority", name: "Priority", type: "select", options: ["Low", "Medium", "High", "Urgent"] },
      { id: "due_date", name: "Due date", type: "date" },
    ],
  },
  {
    id: "tasks",
    name: "Task Checklist",
    description: "Simple task tracker with status and due date.",
    icon: "✅",
    properties: [
      { id: "status", name: "Status", type: "select", options: ["To do", "Doing", "Done"] },
      { id: "due_date", name: "Due date", type: "date" },
    ],
  },
  {
    id: "content",
    name: "Content Calendar",
    description: "Schedule articles, newsletters, and social releases.",
    icon: "📅",
    properties: [
      { id: "status", name: "Status", type: "select", options: ["Idea", "Drafting", "In review", "Published"] },
      { id: "channel", name: "Channel", type: "select", options: ["Blog", "Newsletter", "Twitter/X", "YouTube", "Docs"] },
      { id: "due_date", name: "Publish Date", type: "date" },
    ],
  },
  {
    id: "bugs",
    name: "Bug & Issue Tracker",
    description: "Log bugs, severity, and resolution stages.",
    icon: "🐞",
    properties: [
      { id: "status", name: "Status", type: "select", options: ["Open", "Investigating", "Fixed", "Verified"] },
      { id: "severity", name: "Severity", type: "select", options: ["Low", "Medium", "High", "Critical"] },
      { id: "due_date", name: "Target Fix", type: "date" },
    ],
  },
  {
    id: "custom",
    name: "Custom Table",
    description: "Start clean and define your own columns.",
    icon: "⚙️",
    properties: [
      { id: "status", name: "Status", type: "select", options: ["Not started", "In progress", "Done"] },
      { id: "notes", name: "Notes", type: "text" },
    ],
  },
];

export const AddDatabaseToPageModal: React.FC<AddDatabaseToPageModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  getAuthHeaders,
  onInsertDatabase,
}) => {
  const [tab, setTab] = useState<"new" | "existing">("new");
  const [name, setName] = useState("Project Tracker");
  const [selectedTemplate, setSelectedTemplate] = useState("projects");
  const [properties, setProperties] = useState<DatabaseProperty[]>(TEMPLATE_PRESETS[0].properties);
  const [existingDatabases, setExistingDatabases] = useState<DatabaseSchema[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);

  // Column builder state
  const [newPropName, setNewPropName] = useState("");
  const [newPropType, setNewPropType] = useState<"text" | "number" | "select" | "date">("select");
  const [newPropOptions, setNewPropOptions] = useState("Option 1, Option 2, Option 3");
  const [isAddingColumn, setIsAddingColumn] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing databases when modal opens or tab changes
  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingExisting(true);
    fetch("/api/databases", {
      headers: getAuthHeaders({ "x-workspace-id": workspaceId }),
    })
      .then((res) => (res.ok ? res.json() : { databases: [] }))
      .then((data: any) => {
        const dbs = Array.isArray(data?.databases) ? data.databases : [];
        setExistingDatabases(dbs);
        if (dbs.length > 0) {
          setSelectedExistingId(dbs[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingExisting(false));
  }, [isOpen, workspaceId]);

  if (!isOpen) return null;

  const handleSelectTemplate = (preset: TemplatePreset) => {
    setSelectedTemplate(preset.id);
    setName(preset.name);
    setProperties([...preset.properties]);
  };

  const handleAddProperty = () => {
    if (!newPropName.trim()) return;
    const propId = newPropName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30) || `col_${Date.now()}`;

    // Check for duplicate ID
    if (properties.some((p) => p.id === propId)) {
      setError(`A column with identifier "${propId}" already exists`);
      return;
    }

    const newProp: DatabaseProperty = {
      id: propId,
      name: newPropName.trim(),
      type: newPropType,
      ...(newPropType === "select"
        ? {
            options: newPropOptions
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean),
          }
        : {}),
    };

    setProperties([...properties, newProp]);
    setNewPropName("");
    setIsAddingColumn(false);
    setError(null);
  };

  const handleRemoveProperty = (propId: string) => {
    setProperties(properties.filter((p) => p.id !== propId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (tab === "existing") {
      if (!selectedExistingId) {
        setError("Please select an existing database to embed.");
        return;
      }
      const existing = existingDatabases.find((d) => d.id === selectedExistingId);
      onInsertDatabase(selectedExistingId, existing?.name || "Database");
      onClose();
      return;
    }

    // Creating new database
    if (!name.trim()) {
      setError("Please provide a database name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/databases", {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        }),
        body: JSON.stringify({
          name: name.trim(),
          properties,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as DatabaseSchema & { error?: string };
      if (!res.ok) throw new Error(data.error || `Could not create database (${res.status})`);

      onInsertDatabase(data.id, data.name);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create database");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPropTypeIcon = (type: string) => {
    switch (type) {
      case "select":
        return <Tag size={13} color="var(--accent)" />;
      case "date":
        return <Calendar size={13} color="#0284C7" />;
      case "number":
        return <Hash size={13} color="#D97706" />;
      default:
        return <Type size={13} color="var(--text-muted)" />;
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
        zIndex: 1100,
        padding: "20px",
      }}
    >
      <div
        className="modal-dialog animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "560px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--accent-light)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Table2 size={18} />
            </div>
            <div>
              <h2 className="font-serif" style={{ fontSize: "17px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                Add Database to Page
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "1px 0 0 0" }}>
                Interactive table with custom columns, filters, and R2 persistence
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: "28px", height: "28px" }} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-subtle)",
            padding: "0 20px",
          }}
        >
          <button
            type="button"
            onClick={() => setTab("new")}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: tab === "new" ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              color: tab === "new" ? "var(--accent)" : "var(--text-secondary)",
              fontWeight: tab === "new" ? 600 : 400,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Plus size={14} /> Create New Database
          </button>
          <button
            type="button"
            onClick={() => setTab("existing")}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: tab === "existing" ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              color: tab === "existing" ? "var(--accent)" : "var(--text-secondary)",
              fontWeight: tab === "existing" ? 600 : 400,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Database size={14} /> Link Existing Database ({existingDatabases.length})
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
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

          {tab === "new" ? (
            <>
              {/* Presets */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>
                  1. Choose Starter Template
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {TEMPLATE_PRESETS.map((preset) => {
                    const isSelected = selectedTemplate === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectTemplate(preset)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "var(--radius-md)",
                          border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border-subtle)",
                          backgroundColor: isSelected ? "var(--bg-nav-active)" : "var(--bg-surface)",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "3px",
                          transition: "all 0.12s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                            {preset.icon} {preset.name}
                          </span>
                          {isSelected && <CheckCircle2 size={14} color="var(--accent)" />}
                        </div>
                        <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.3 }}>
                          {preset.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Database Name */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                  2. Database Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sprint Deliverables, Feature Tracker"
                  maxLength={100}
                  className="form-control"
                  style={{ width: "100%", fontSize: "13px" }}
                />
              </div>

              {/* Configured Columns Preview & Customizer */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>
                    3. Columns ({properties.length + 1})
                  </label>
                  {!isAddingColumn && (
                    <button
                      type="button"
                      onClick={() => setIsAddingColumn(true)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent)",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: 500,
                        padding: "2px 4px",
                      }}
                    >
                      <Plus size={13} /> Add column
                    </button>
                  )}
                </div>

                <div
                  style={{
                    backgroundColor: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {/* Primary Name column (always present) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      backgroundColor: "var(--bg-surface)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Type size={13} color="var(--text-muted)" />
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Name / Title</span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", backgroundColor: "var(--bg-subtle)", padding: "1px 4px", borderRadius: "3px" }}>
                        Primary
                      </span>
                    </div>
                  </div>

                  {/* Configured Properties */}
                  {properties.map((prop) => (
                    <div
                      key={prop.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        backgroundColor: "var(--bg-surface)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {getPropTypeIcon(prop.type)}
                        <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{prop.name}</span>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "var(--text-secondary)",
                            textTransform: "uppercase",
                            backgroundColor: "var(--bg-subtle)",
                            padding: "1px 5px",
                            borderRadius: "3px",
                          }}
                        >
                          {prop.type}
                        </span>
                        {prop.options && prop.options.length > 0 && (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            ({prop.options.slice(0, 3).join(", ")}{prop.options.length > 3 ? "…" : ""})
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveProperty(prop.id)}
                        className="btn-icon"
                        style={{ width: "22px", height: "22px", color: "var(--danger)" }}
                        title="Remove column"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}

                  {/* Quick Add Column Form */}
                  {isAddingColumn && (
                    <div
                      style={{
                        padding: "10px",
                        backgroundColor: "var(--bg-surface)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px dashed var(--accent)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="text"
                          value={newPropName}
                          onChange={(e) => setNewPropName(e.target.value)}
                          placeholder="Column name (e.g. Owner, Stage)"
                          className="form-control"
                          style={{ flex: 1, fontSize: "12px", padding: "4px 8px" }}
                          autoFocus
                        />
                        <select
                          value={newPropType}
                          onChange={(e: any) => setNewPropType(e.target.value)}
                          className="form-control"
                          style={{ width: "110px", fontSize: "12px", padding: "4px 8px" }}
                        >
                          <option value="select">Select / Status</option>
                          <option value="text">Text</option>
                          <option value="date">Date</option>
                          <option value="number">Number</option>
                        </select>
                      </div>

                      {newPropType === "select" && (
                        <div>
                          <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "3px" }}>
                            Options (comma-separated):
                          </label>
                          <input
                            type="text"
                            value={newPropOptions}
                            onChange={(e) => setNewPropOptions(e.target.value)}
                            placeholder="To do, In progress, Done"
                            className="form-control"
                            style={{ width: "100%", fontSize: "12px", padding: "4px 8px" }}
                          />
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => setIsAddingColumn(false)}
                          className="btn-secondary"
                          style={{ padding: "3px 8px", fontSize: "11px" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddProperty}
                          disabled={!newPropName.trim()}
                          className="btn-primary"
                          style={{ padding: "3px 10px", fontSize: "11px" }}
                        >
                          Add Column
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Link Existing Database Tab */
            <div>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: 0 }}>
                Embed a live view of an existing database from this workspace:
              </p>
              {isLoadingExisting ? (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  Loading databases…
                </div>
              ) : existingDatabases.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  No databases found in this workspace. Switch to "Create New Database" to create one.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {existingDatabases.map((db) => {
                    const isSelected = selectedExistingId === db.id;
                    return (
                      <div
                        key={db.id}
                        onClick={() => setSelectedExistingId(db.id)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "var(--radius-md)",
                          border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border-subtle)",
                          backgroundColor: isSelected ? "var(--bg-nav-active)" : "var(--bg-surface)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "all 0.12s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <Table2 size={16} color={isSelected ? "var(--accent)" : "var(--text-muted)"} />
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                              {db.name}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              {db.properties.length} columns: {db.properties.map((p) => p.name).join(", ")}
                            </div>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 size={15} color="var(--accent)" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border-subtle)",
              marginTop: "4px",
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
              disabled={isSubmitting || (tab === "new" ? !name.trim() : !selectedExistingId)}
              className="btn-primary"
              style={{ padding: "8px 20px", fontSize: "13px" }}
            >
              {isSubmitting ? "Adding…" : "Add to Page"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
