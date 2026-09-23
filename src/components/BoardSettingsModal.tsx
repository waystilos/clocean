import React, { useState, useEffect } from "react";
import {
  X,
  Settings2,
  Columns,
  AlertTriangle,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Check,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { TaskBoard, TaskBoardColumn, TaskItem } from "../types.ts";

export const DEFAULT_BOARD_COLUMNS: TaskBoardColumn[] = [
  { id: "todo", title: "To Do", color: "#64748B" },
  { id: "inprogress", title: "In Progress", color: "#2563EB", wipLimit: 10 },
  { id: "done", title: "Done", color: "#16A34A" },
];

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

interface BoardSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: TaskBoard;
  tasks: TaskItem[];
  onUpdateBoard: (updatedBoard: TaskBoard) => Promise<void>;
  onDeleteBoard?: (boardId: string) => Promise<void>;
  onTasksUpdated?: (tasks: TaskItem[]) => void;
  sessionToken?: string | null;
  workspaceId?: string;
}

export const BoardSettingsModal: React.FC<BoardSettingsModalProps> = ({
  isOpen,
  onClose,
  board,
  tasks,
  onUpdateBoard,
  onDeleteBoard,
  onTasksUpdated,
  sessionToken,
  workspaceId = "default",
}) => {
  const [activeTab, setActiveTab] = useState<"general" | "columns" | "danger">("general");

  // General Tab State
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || "");
  const [icon, setIcon] = useState(board.icon || "📋");
  const [color, setColor] = useState(board.color || "#1E7D6B");
  const [defaultView, setDefaultView] = useState<"board" | "table">(board.defaultView || "board");
  const [defaultPriority, setDefaultPriority] = useState<"urgent" | "high" | "medium" | "low">(
    board.defaultPriority || "medium"
  );

  // Columns Tab State
  const [columns, setColumns] = useState<TaskBoardColumn[]>(() =>
    Array.isArray(board.columns) && board.columns.length > 0 ? board.columns : DEFAULT_BOARD_COLUMNS
  );
  const [newColTitle, setNewColTitle] = useState("");
  const [newColColor, setNewColColor] = useState("#0284C7");
  const [colToDelete, setColToDelete] = useState<TaskBoardColumn | null>(null);

  // Status & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Danger actions
  const [isDeletingBoard, setIsDeletingBoard] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isClearingDone, setIsClearingDone] = useState(false);

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = sessionToken || localStorage.getItem("clocean_session_token");
    return { "x-workspace-id": workspaceId, ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  useEffect(() => {
    if (isOpen) {
      setName(board.name);
      setDescription(board.description || "");
      setIcon(board.icon || "📋");
      setColor(board.color || "#1E7D6B");
      setDefaultView(board.defaultView || "board");
      setDefaultPriority(board.defaultPriority || "medium");
      setColumns(Array.isArray(board.columns) && board.columns.length > 0 ? board.columns : DEFAULT_BOARD_COLUMNS);
      setSuccessMsg(null);
      setErrorMsg(null);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, board]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSaving && !isDeletingBoard) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, isDeletingBoard, onClose]);

  if (!isOpen) return null;

  const handleSaveGeneral = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Board name cannot be empty.");
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updated: TaskBoard = {
        ...board,
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        color,
        columns,
        defaultView,
        defaultPriority,
        updatedAt: new Date().toISOString(),
      };
      await onUpdateBoard(updated);
      setSuccessMsg("Board settings updated successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update board settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Column management handlers
  const handleAddColumn = () => {
    if (!newColTitle.trim()) return;
    const newId = `col-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newCol: TaskBoardColumn = {
      id: newId,
      title: newColTitle.trim(),
      color: newColColor,
    };
    setColumns((prev) => [...prev, newCol]);
    setNewColTitle("");
  };

  const handleMoveColumn = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;
    const next = [...columns];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setColumns(next);
  };

  const handleUpdateColumnTitle = (id: string, newTitle: string) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));
  };

  const handleUpdateColumnWip = (id: string, wipStr: string) => {
    const val = parseInt(wipStr, 10);
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, wipLimit: isNaN(val) || val <= 0 ? undefined : val } : c))
    );
  };

  const handleUpdateColumnColor = (id: string, newColor: string) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, color: newColor } : c)));
  };

  const handleConfirmDeleteColumn = (col: TaskBoardColumn) => {
    if (columns.length <= 1) {
      setErrorMsg("A board must have at least one column.");
      return;
    }
    // Migrate any tasks on this column to first remaining column
    const remaining = columns.filter((c) => c.id !== col.id);
    const fallbackCol = remaining[0];
    const tasksToMigrate = tasks.filter((t) => t.status === col.id);
    if (tasksToMigrate.length > 0 && onTasksUpdated) {
      const updatedTasks = tasks.map((t) => (t.status === col.id ? { ...t, status: fallbackCol.id } : t));
      onTasksUpdated(updatedTasks);
    }
    setColumns(remaining);
    setColToDelete(null);
  };

  const handleResetColumns = () => {
    setColumns(DEFAULT_BOARD_COLUMNS);
  };

  // Clear completed tasks
  const handleClearCompleted = async () => {
    setIsClearingDone(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/task-boards/${encodeURIComponent(board.id)}/clear-completed`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || "Failed to clear completed tasks");
      }
      const data = await res.json() as { removedCount: number };
      const remainingTasks = tasks.filter((t) => t.status !== "done");
      onTasksUpdated?.(remainingTasks);
      setSuccessMsg(`Cleared ${data.removedCount} completed work items from this board.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Could not clear completed tasks");
    } finally {
      setIsClearingDone(false);
    }
  };

  // Export board data
  const handleExportBoard = () => {
    const data = {
      board,
      exportedAt: new Date().toISOString(),
      tasks,
    };
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(jsonBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clocean-board-${board.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Delete Board
  const handleDeleteBoard = async () => {
    if (board.id === "default") {
      setErrorMsg("The default board cannot be removed.");
      return;
    }
    if (!onDeleteBoard) return;
    setIsDeletingBoard(true);
    setErrorMsg(null);
    try {
      await onDeleteBoard(board.id);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete board");
      setIsDeletingBoard(false);
    }
  };

  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
        padding: "20px",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-settings-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "640px",
          maxHeight: "90vh",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: `${color}20`,
                border: `1.5px solid ${color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              {icon}
            </div>
            <div>
              <h2
                id="board-settings-title"
                className="font-serif"
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Board Settings
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                {board.name} {board.id === "default" && <span style={{ opacity: 0.7 }}>(Default Workspace Board)</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close board settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "0 24px",
            backgroundColor: "var(--bg-primary)",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            style={{
              padding: "12px 14px",
              fontSize: "13px",
              fontWeight: 500,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: activeTab === "general" ? "var(--accent-text)" : "var(--text-secondary)",
              borderBottom: activeTab === "general" ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 0.15s ease",
            }}
          >
            <Settings2 size={15} /> General
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("columns")}
            style={{
              padding: "12px 14px",
              fontSize: "13px",
              fontWeight: 500,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: activeTab === "columns" ? "var(--accent-text)" : "var(--text-secondary)",
              borderBottom: activeTab === "columns" ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 0.15s ease",
            }}
          >
            <Columns size={15} /> Columns & Workflow ({columns.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("danger")}
            style={{
              padding: "12px 14px",
              fontSize: "13px",
              fontWeight: 500,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: activeTab === "danger" ? "var(--danger)" : "var(--text-secondary)",
              borderBottom: activeTab === "danger" ? "2px solid var(--danger)" : "2px solid transparent",
              transition: "all 0.15s ease",
            }}
          >
            <AlertTriangle size={15} /> Actions & Danger
          </button>
        </div>

        {/* Feedback banners */}
        {errorMsg && (
          <div
            style={{
              margin: "16px 24px 0",
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#DC2626",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div
            style={{
              margin: "16px 24px 0",
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(30, 125, 107, 0.12)",
              border: "1px solid rgba(30, 125, 107, 0.3)",
              color: "var(--accent-text)",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {/* GENERAL TAB */}
          {activeTab === "general" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Board Name */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                  Board Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Sprint 24, Product Roadmap"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Board Description */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                  Description & Purpose
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                  placeholder="What is this board used for? Describe sprint goals, team workflows, or milestones."
                  rows={3}
                  style={{ width: "100%", minHeight: "75px" }}
                />
              </div>

              {/* Icon & Theme Color */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                    Board Icon
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "110px", overflowY: "auto", padding: "4px" }}>
                    {BOARD_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setIcon(emoji)}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "var(--radius-sm)",
                          border: icon === emoji ? `2px solid var(--accent)` : "1px solid var(--border-subtle)",
                          backgroundColor: icon === emoji ? "var(--accent-light)" : "var(--bg-surface)",
                          cursor: "pointer",
                          fontSize: "16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                    Accent Color
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "4px" }}>
                    {ACCENT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setColor(c.value)}
                        title={c.name}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          backgroundColor: c.value,
                          border: color === c.value ? "2.5px solid var(--text-primary)" : "1px solid var(--border-subtle)",
                          boxShadow: color === c.value ? "0 0 0 2px var(--accent)" : "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {color === c.value && <Check size={14} color="#FFFFFF" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Default View & Default Priority */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", paddingTop: "8px", borderTop: "1px solid var(--border-subtle)" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                    Default View
                  </label>
                  <select
                    value={defaultView}
                    onChange={(e) => setDefaultView(e.target.value as "board" | "table")}
                    style={{ width: "100%" }}
                  >
                    <option value="board">Kanban Board</option>
                    <option value="table">Table / List View</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                    Default Task Priority
                  </label>
                  <select
                    value={defaultPriority}
                    onChange={(e) => setDefaultPriority(e.target.value as "urgent" | "high" | "medium" | "low")}
                    style={{ width: "100%" }}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* COLUMNS & WORKFLOW TAB */}
          {activeTab === "columns" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                    Board Columns & Lanes
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Customize columns, order, and WIP limits.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetColumns}
                  className="btn-secondary"
                  style={{ padding: "5px 10px", fontSize: "11px", gap: "4px" }}
                  title="Reset to default columns (To Do, In Progress, Done)"
                >
                  <RotateCcw size={12} /> Reset to Defaults
                </button>
              </div>

              {/* Column list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {columns.map((col, index) => {
                  const count = tasks.filter((t) => t.status === col.id).length;
                  const isOverWip = col.wipLimit && count > col.wipLimit;
                  return (
                    <div
                      key={col.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-primary)",
                      }}
                    >
                      {/* Column color dot */}
                      <input
                        type="color"
                        value={col.color || "#0284C7"}
                        onChange={(e) => handleUpdateColumnColor(col.id, e.target.value)}
                        title="Change column color"
                        style={{
                          width: "22px",
                          height: "22px",
                          padding: 0,
                          borderRadius: "4px",
                          border: "none",
                          cursor: "pointer",
                          backgroundColor: "transparent",
                        }}
                      />

                      {/* Column Title */}
                      <input
                        type="text"
                        value={col.title}
                        onChange={(e) => handleUpdateColumnTitle(col.id, e.target.value)}
                        maxLength={50}
                        placeholder="Column name"
                        style={{ flex: 1, minHeight: "32px", fontSize: "12px", padding: "4px 8px" }}
                      />

                      {/* WIP Limit */}
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          WIP Limit:
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={col.wipLimit || ""}
                          placeholder="None"
                          onChange={(e) => handleUpdateColumnWip(col.id, e.target.value)}
                          style={{ width: "54px", minHeight: "32px", fontSize: "12px", padding: "4px 6px", textAlign: "center" }}
                        />
                      </div>

                      {/* Task Count badge */}
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "10px",
                          backgroundColor: isOverWip ? "rgba(239, 68, 68, 0.15)" : "var(--badge-bg)",
                          color: isOverWip ? "#EF4444" : "var(--text-secondary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {count} {col.wipLimit ? `/ ${col.wipLimit}` : "items"}
                      </span>

                      {/* Move Up/Down Controls */}
                      <div style={{ display: "flex", gap: "2px" }}>
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ width: "26px", height: "26px" }}
                          disabled={index === 0}
                          onClick={() => handleMoveColumn(index, "up")}
                          title="Move column up / left"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ width: "26px", height: "26px" }}
                          disabled={index === columns.length - 1}
                          onClick={() => handleMoveColumn(index, "down")}
                          title="Move column down / right"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>

                      {/* Delete Column button */}
                      <button
                        type="button"
                        className="btn-icon"
                        style={{ width: "26px", height: "26px", color: "var(--danger)" }}
                        disabled={columns.length <= 1}
                        onClick={() => setColToDelete(col)}
                        title="Remove column"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add Column Row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "6px",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1px dashed var(--border-subtle)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <input
                  type="color"
                  value={newColColor}
                  onChange={(e) => setNewColColor(e.target.value)}
                  style={{
                    width: "22px",
                    height: "22px",
                    padding: 0,
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: "transparent",
                  }}
                  title="Choose new column color"
                />
                <input
                  type="text"
                  value={newColTitle}
                  onChange={(e) => setNewColTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddColumn();
                    }
                  }}
                  placeholder="New column title (e.g. In Review, QA, Blocked)..."
                  maxLength={50}
                  style={{ flex: 1, minHeight: "32px", fontSize: "12px", padding: "4px 8px" }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!newColTitle.trim()}
                  onClick={handleAddColumn}
                  style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                >
                  <Plus size={13} /> Add Column
                </button>
              </div>

              {/* Delete Column Confirmation Modal */}
              {colToDelete && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#DC2626" }}>
                    Remove column “{colToDelete.title}”?
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Any existing tasks in this column will be moved to the primary column (
                    <strong>{columns.find((c) => c.id !== colToDelete.id)?.title || "first column"}</strong>) so no work items are lost.
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setColToDelete(null)}
                      style={{ padding: "5px 10px", fontSize: "12px" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => handleConfirmDeleteColumn(colToDelete)}
                      style={{ padding: "5px 12px", fontSize: "12px" }}
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DANGER / ACTIONS TAB */}
          {activeTab === "danger" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Clear Completed Tasks */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-primary)",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                    Clear Completed Tasks
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    Remove finished items marked as “Done” to clean up your active workspace.
                    {doneCount > 0 ? ` (${doneCount} tasks currently completed)` : " (No completed tasks)"}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={doneCount === 0 || isClearingDone}
                  onClick={handleClearCompleted}
                  style={{ whiteSpace: "nowrap", padding: "7px 14px", fontSize: "12px" }}
                >
                  {isClearingDone ? "Clearing…" : `Clear ${doneCount} Done Items`}
                </button>
              </div>

              {/* Export Board JSON */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-primary)",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                    Export Board Data
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    Download a full JSON backup of this board’s settings, custom columns, and work items.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleExportBoard}
                  style={{ whiteSpace: "nowrap", padding: "7px 14px", fontSize: "12px", gap: "6px" }}
                >
                  <Download size={14} /> Export JSON
                </button>
              </div>

              {/* Delete Board Section */}
              <div
                style={{
                  padding: "18px",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  backgroundColor: "rgba(239, 68, 68, 0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(239, 68, 68, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#DC2626",
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                      Delete this Board
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px", lineHeight: 1.4 }}>
                      {board.id === "default" ? (
                        <span>The <strong>Sprint board</strong> is the primary workspace board and cannot be removed. You can rename it or customize its columns.</span>
                      ) : (
                        <span>Permanently remove <strong>“{board.name}”</strong> and all tasks associated with it from Cloudflare R2 storage. This action cannot be undone.</span>
                      )}
                    </div>
                  </div>
                </div>

                {board.id !== "default" && (
                  <>
                    {!showDeleteConfirm ? (
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => setShowDeleteConfirm(true)}
                          style={{ padding: "7px 14px", fontSize: "12px" }}
                        >
                          <Trash2 size={13} /> Delete Board…
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: "12px",
                          borderRadius: "var(--radius-md)",
                          backgroundColor: "var(--bg-surface)",
                          border: "1px solid rgba(239, 68, 68, 0.5)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#DC2626" }}>
                          Are you sure you want to permanently delete “{board.name}”?
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={isDeletingBoard}
                            onClick={() => setShowDeleteConfirm(false)}
                            style={{ padding: "6px 12px", fontSize: "12px" }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            disabled={isDeletingBoard}
                            onClick={handleDeleteBoard}
                            style={{ padding: "6px 14px", fontSize: "12px" }}
                          >
                            {isDeletingBoard ? "Deleting…" : "Yes, Delete Board"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleSaveGeneral()}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
