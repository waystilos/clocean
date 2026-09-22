import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Check,
  Clock,
  ChevronRight,
  ChevronLeft,
  X,
  CheckSquare,
  Square,
  Trash2,
  AlertCircle,
  AtSign,
  User,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  Calendar,
  Bug,
  Lightbulb,
  MessageSquare,
} from "lucide-react";
import { TaskBoard, TaskComment, TaskItem, TaskSubtask, TaskType, UserProfile, WorkspaceMember } from "../types.ts";

export function getTaskDeadlineInfo(dueDate?: string): {
  display: string;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean;
  color: string;
  bg: string;
} {
  if (!dueDate || !dueDate.trim()) {
    return {
      display: "No deadline",
      isOverdue: false,
      isDueToday: false,
      isDueSoon: false,
      color: "var(--text-muted)",
      bg: "transparent",
    };
  }

  const parsed = Date.parse(dueDate);
  if (isNaN(parsed)) {
    return {
      display: dueDate,
      isOverdue: false,
      isDueToday: false,
      isDueSoon: dueDate.toLowerCase().includes("soon") || dueDate.toLowerCase().includes("due"),
      color: "var(--accent-text)",
      bg: "var(--accent-light)",
    };
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const due = new Date(parsed);
  const dueStr = due.toISOString().split("T")[0];

  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (due.getFullYear() !== now.getFullYear()) {
    options.year = "numeric";
  }
  const formatted = due.toLocaleDateString("en-US", options);

  if (dueStr < todayStr) {
    const daysAgo = Math.max(1, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
    return {
      display: `Overdue (${daysAgo}d ago: ${formatted})`,
      isOverdue: true,
      isDueToday: false,
      isDueSoon: false,
      color: "#DC2626",
      bg: "rgba(239, 68, 68, 0.12)",
    };
  }

  if (dueStr === todayStr) {
    return {
      display: `Due Today (${formatted})`,
      isOverdue: false,
      isDueToday: true,
      isDueSoon: true,
      color: "#D97706",
      bg: "rgba(245, 158, 11, 0.12)",
    };
  }

  if (diffDays <= 2) {
    return {
      display: diffDays === 1 ? `Due Tomorrow (${formatted})` : `Due in 2 days (${formatted})`,
      isOverdue: false,
      isDueToday: false,
      isDueSoon: true,
      color: "#2563EB",
      bg: "rgba(37, 99, 235, 0.12)",
    };
  }

  return {
    display: formatted,
    isOverdue: false,
    isDueToday: false,
    isDueSoon: false,
    color: "var(--text-secondary)",
    bg: "var(--surface)",
  };
}

interface TasksViewProps {
  tasks: TaskItem[];
  currentUser: UserProfile;
  workspaceId?: string;
  onUpdateTasks: (tasks: TaskItem[], boardId?: string) => Promise<void>;
  onLoadTasks?: (tasks: TaskItem[], boardId?: string) => void;
  sessionToken?: string | null;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  currentUser,
  workspaceId = "default",
  onUpdateTasks,
  onLoadTasks,
  sessionToken,
}) => {
  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = sessionToken || localStorage.getItem("clocean_session_token");
    return { "x-workspace-id": workspaceId, ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [filter, setFilter] = useState<"all" | "mine" | "due" | "high">("all");
  const [viewType, setViewType] = useState<"board" | "table">("board");
  const [isAddingIn, setIsAddingIn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskType, setNewTaskType] = useState<TaskType>("task");
  const [newTaskPriority, setNewTaskPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [newTaskAssigneeEmail, setNewTaskAssigneeEmail] = useState<string>(currentUser.email);
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>(tomorrowStr);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  // Drag and Drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Task Detail Modal state
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newCommentText, setNewCommentText] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [boards, setBoards] = useState<TaskBoard[]>([]);
  const [activeBoardId, setActiveBoardId] = useState("default");
  const [loadedBoardId, setLoadedBoardId] = useState<string | null>(null);
  const [isBoardLoading, setIsBoardLoading] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [boardToDelete, setBoardToDelete] = useState<TaskBoard | null>(null);
  const [isDeletingBoard, setIsDeletingBoard] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);

  useEffect(() => {
    setBoards([]);
    setActiveBoardId("default");
    setBoardError(null);
    fetch("/api/task-boards", { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load task boards");
        return res.json();
      })
      .then((data) => {
        const loadedBoards = data as TaskBoard[];
        setBoards(loadedBoards);
        if (!loadedBoards.some((board) => board.id === "default")) setActiveBoardId(loadedBoards[0]?.id || "default");
      })
      .catch((error: unknown) => setBoardError(error instanceof Error ? error.message : "Could not load task boards"));
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    setIsBoardLoading(true);
    setLoadedBoardId(null);
    fetch(`/api/tasks?boardId=${encodeURIComponent(activeBoardId)}`, { headers: getAuthHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load tasks");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        onLoadTasks?.(data as TaskItem[], activeBoardId);
        setLoadedBoardId(activeBoardId);
        setBoardError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setBoardError(error instanceof Error ? error.message : "Could not load tasks");
      })
      .finally(() => {
        if (!cancelled) setIsBoardLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeBoardId, workspaceId, onLoadTasks]);

  const createBoard = async () => {
    if (!newBoardName.trim()) {
      setBoardError("Enter a name for the new board.");
      return;
    }
    try {
      const response = await fetch("/api/task-boards", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name: newBoardName.trim() }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not create task board");
      const board = data as TaskBoard;
      setBoards((current) => [...current, board]);
      setNewBoardName("");
      setBoardError(null);
      setActiveBoardId(board.id);
    } catch (error: unknown) {
      setBoardError(error instanceof Error ? error.message : "Could not create task board");
    }
  };

  const handleDeleteBoard = async () => {
    if (!boardToDelete || boardToDelete.id === "default") return;
    setIsDeletingBoard(true);
    try {
      const response = await fetch(`/api/task-boards/${encodeURIComponent(boardToDelete.id)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not remove task board");
      const remaining = boards.filter((board) => board.id !== boardToDelete.id);
      setBoards(remaining);
      setBoardToDelete(null);
      setActiveBoardId(remaining.find((board) => board.id === "default")?.id || remaining[0]?.id || "default");
      setBoardError(null);
    } catch (error: unknown) {
      setBoardError(error instanceof Error ? error.message : "Could not remove task board");
    } finally {
      setIsDeletingBoard(false);
    }
  };

  // Fetch workspace members for assignee selection
  useEffect(() => {
    fetch(`/api/workspaces/${workspaceId}/members?user=${encodeURIComponent(currentUser.email)}`, { headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.members || [];
        setMembers(list);
      })
      .catch(() => {});
  }, [workspaceId, currentUser.email]);

  const filteredTasks = tasks.filter((t) => {
    if (filter === "mine") return t.assignee.email.toLowerCase() === currentUser.email.toLowerCase();
    if (filter === "due") {
      const info = getTaskDeadlineInfo(t.dueDate);
      return info.isOverdue || info.isDueToday || info.isDueSoon;
    }
    if (filter === "high") return t.priority === "urgent" || t.priority === "high";
    return true;
  });

  const columns: { id: "todo" | "inprogress" | "done"; title: string }[] = [
    { id: "todo", title: "To Do" },
    { id: "inprogress", title: "In Progress" },
    { id: "done", title: "Done" },
  ];

  const handleAddTask = async (status: "todo" | "inprogress" | "done") => {
    if (!newTaskTitle.trim()) {
      setIsAddingIn(null);
      return;
    }

    const assignedMember = members.find((m) => m.email.toLowerCase() === newTaskAssigneeEmail.toLowerCase()) || {
      name: currentUser.name,
      email: currentUser.email,
      avatar: currentUser.avatar,
    };

    const finalDueDate = newTaskDueDate || new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      type: newTaskType,
      description: newTaskDescription.trim() || undefined,
      status,
      priority: newTaskPriority,
      dueDate: finalDueDate,
      assignee: {
        name: assignedMember.name,
        email: assignedMember.email,
        avatar: assignedMember.avatar,
      },
      subtasks: [],
    };

    const updated = [...tasks, newTask];
    await onUpdateTasks(updated, activeBoardId);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskType("task");
    setNewTaskPriority("medium");
    setNewTaskAssigneeEmail(currentUser.email);
    setNewTaskDueDate(tomorrowStr);
    setIsAddingIn(null);
  };

  const handleMoveTask = async (taskId: string, nextStatus: "todo" | "inprogress" | "done") => {
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t));
    await onUpdateTasks(updated, activeBoardId);
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, status: nextStatus });
    }
  };

  const requestDeleteTask = (task: TaskItem) => {
    setDeleteTarget(task);
  };

  const handleDeleteTask = async (taskId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}?boardId=${encodeURIComponent(activeBoardId)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete work item");
      onLoadTasks?.(tasks.filter((task) => task.id !== taskId), activeBoardId);
      setSelectedTask(null);
      setDeleteTarget(null);
    } catch (error: unknown) {
      setBoardError(error instanceof Error ? error.message : "Could not delete work item");
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePostComment = async () => {
    if (!selectedTask || !newCommentText.trim() || isPostingComment) return;
    setIsPostingComment(true);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(selectedTask.id)}/comments?boardId=${encodeURIComponent(activeBoardId)}`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ text: newCommentText.trim() }),
      });
      const data = await response.json().catch(() => ({})) as TaskComment & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not add comment");
      setSelectedTask({ ...selectedTask, comments: [...(selectedTask.comments || []), data] });
      setNewCommentText("");
    } catch (error: unknown) {
      setBoardError(error instanceof Error ? error.message : "Could not add comment");
    } finally {
      setIsPostingComment(false);
    }
  };

  const getTaskTypeLabel = (type?: TaskType) => ({ task: "Task", bug: "Bug", feature: "Feature", improvement: "Improvement", question: "Question" }[type || "task"]);
  const getTaskTypeIcon = (type?: TaskType) => type === "bug" ? <Bug size={12} /> : type === "feature" || type === "improvement" ? <Lightbulb size={12} /> : type === "question" ? <MessageSquare size={12} /> : <CheckSquare size={12} />;

  const handleSaveSelectedTask = async () => {
    if (!selectedTask) return;
    const updated = tasks.map((t) => (t.id === selectedTask.id ? selectedTask : t));
    await onUpdateTasks(updated, activeBoardId);
    setSelectedTask(null);
  };

  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    const updated = tasks.map((t) => {
      if (t.id !== taskId) return t;
      const subtasks = (t.subtasks || []).map((s) =>
        s.id === subtaskId ? { ...s, completed: !s.completed } : s
      );
      return { ...t, subtasks };
    });
    await onUpdateTasks(updated, activeBoardId);
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({
        ...selectedTask,
        subtasks: (selectedTask.subtasks || []).map((s) =>
          s.id === subtaskId ? { ...s, completed: !s.completed } : s
        ),
      });
    }
  };

  const handleAddSubtask = () => {
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    const newSub: TaskSubtask = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    const updatedSubtasks = [...(selectedTask.subtasks || []), newSub];
    setSelectedTask({ ...selectedTask, subtasks: updatedSubtasks });
    setNewSubtaskTitle("");
  };

  const handleDeleteSubtask = (subId: string) => {
    if (!selectedTask) return;
    const updatedSubtasks = (selectedTask.subtasks || []).filter((s) => s.id !== subId);
    setSelectedTask({ ...selectedTask, subtasks: updatedSubtasks });
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case "urgent":
        return {
          label: "Urgent",
          bg: "rgba(239, 68, 68, 0.15)",
          color: "#ef4444",
          border: "1px solid rgba(239, 68, 68, 0.3)",
        };
      case "high":
        return {
          label: "High",
          bg: "rgba(245, 158, 11, 0.15)",
          color: "#f59e0b",
          border: "1px solid rgba(245, 158, 11, 0.3)",
        };
      case "medium":
        return {
          label: "Medium",
          bg: "rgba(30, 125, 107, 0.15)",
          color: "var(--accent-text)",
          border: "1px solid rgba(30, 125, 107, 0.3)",
        };
      case "low":
      default:
        return {
          label: "Low",
          bg: "var(--bg-surface-hover)",
          color: "var(--text-muted)",
          border: "1px solid var(--border-subtle)",
        };
    }
  };

  return (
    <div
      className="animate-fade-in tasks-view"
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "48px 32px",
      }}
    >
      {/* Header Row */}
      <div
        className="tasks-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "36px",
        }}
      >
        <div>
          <h1
            className="font-serif"
            style={{
              fontSize: "28px",
              fontWeight: 500,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            Sprint Task Board
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Choose a board and keep each project’s work organized in its own Kanban view.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-secondary)" }}>
              Board
              <select value={activeBoardId} onChange={(e) => setActiveBoardId(e.target.value)} aria-label="Switch task board">
              {(boards.length ? boards : [{ id: "default", name: "Sprint board" } as TaskBoard]).map((board) => (
                <option key={board.id} value={board.id}>{board.name}</option>
              ))}
              </select>
            </label>
            {isBoardLoading && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading board…</span>}
            {activeBoardId !== "default" && (
              <button className="btn-secondary" onClick={() => setBoardToDelete(boards.find((board) => board.id === activeBoardId) || null)} style={{ color: "#dc2626", borderColor: "rgba(239, 68, 68, 0.35)" }}>
                <Trash2 size={14} /> Remove board
              </button>
            )}
            <input value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} placeholder="New board name" aria-label="New board name" maxLength={100} />
            <button className="btn-secondary" onClick={createBoard}><Plus size={14} /> Add board</button>
          </div>
          {boardError && <div role="alert" style={{ color: "var(--danger, #b42318)", fontSize: 12, marginTop: 8 }}>{boardError}</div>}
        </div>

        {/* Filters */}
        <div className="tasks-filters" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => setFilter("all")}
            className="btn-secondary"
            style={{
              backgroundColor: filter === "all" ? "var(--accent-light)" : "transparent",
              color: filter === "all" ? "var(--accent-text)" : "var(--text-secondary)",
              borderColor: filter === "all" ? "var(--accent)" : "var(--border-subtle)",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            All ({tasks.length})
          </button>
          <button
            onClick={() => setFilter("mine")}
            className="btn-secondary"
            style={{
              backgroundColor: filter === "mine" ? "var(--accent-light)" : "transparent",
              color: filter === "mine" ? "var(--accent-text)" : "var(--text-secondary)",
              borderColor: filter === "mine" ? "var(--accent)" : "var(--border-subtle)",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            My Tasks
          </button>
          <button
            onClick={() => setFilter("due")}
            className="btn-secondary"
            style={{
              backgroundColor: filter === "due" ? "var(--accent-light)" : "transparent",
              color: filter === "due" ? "var(--accent-text)" : "var(--text-secondary)",
              borderColor: filter === "due" ? "var(--accent)" : "var(--border-subtle)",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            Due Soon
          </button>
          <button
            onClick={() => setFilter("high")}
            className="btn-secondary"
            style={{
              backgroundColor: filter === "high" ? "rgba(239, 68, 68, 0.15)" : "transparent",
              color: filter === "high" ? "#ef4444" : "var(--text-secondary)",
              borderColor: filter === "high" ? "#ef4444" : "var(--border-subtle)",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            High Priority
          </button>

          <div style={{ width: "1px", height: "20px", backgroundColor: "var(--border-subtle)", margin: "0 4px" }} />

          {/* Board vs Table Toggle */}
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
              onClick={() => setViewType("board")}
              style={{
                padding: "5px 10px",
                fontSize: "12px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                backgroundColor: viewType === "board" ? "var(--bg-nav-active)" : "transparent",
                color: viewType === "board" ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: viewType === "board" ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <LayoutGrid size={13} /> Board
            </button>
            <button
              onClick={() => setViewType("table")}
              style={{
                padding: "5px 10px",
                fontSize: "12px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                backgroundColor: viewType === "table" ? "var(--bg-nav-active)" : "transparent",
                color: viewType === "table" ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: viewType === "table" ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <TableIcon size={13} /> Table
            </button>
          </div>

          <div style={{ width: "1px", height: "20px", backgroundColor: "var(--border-subtle)", margin: "0 4px" }} />

        </div>
      </div>

      {loadedBoardId !== activeBoardId ? (
        <div style={{ minHeight: 300, display: "grid", placeItems: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {isBoardLoading ? "Loading board…" : "This board could not be loaded."}
        </div>
      ) : viewType === "table" ? (
        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--bg-nav-active)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)" }}>Task Name</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)", width: "140px" }}>Status</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)", width: "110px" }}>Priority</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)", width: "180px" }}>Assignee</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)", width: "120px" }}>Due Date</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)", width: "100px" }}>Subtasks</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)", width: "80px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                    No tasks match the active filter.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const pri = getPriorityBadge(t.priority);
                  const completedSub = (t.subtasks || []).filter((s) => s.completed).length;
                  const totalSub = (t.subtasks || []).length;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTask(t)}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        transition: "background 0.1s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--text-primary)" }}>
                        {t.title}
                      </td>
                      <td style={{ padding: "12px 16px" }} onClick={(e) => e.stopPropagation()}>
                        <select
                          value={t.status}
                          onChange={(e) => handleMoveTask(t.id, e.target.value as any)}
                          style={{
                            fontSize: "12px",
                            fontWeight: 500,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid var(--border-subtle)",
                            backgroundColor:
                              t.status === "done"
                                ? "rgba(30, 125, 107, 0.15)"
                                : t.status === "inprogress"
                                ? "rgba(245, 158, 11, 0.15)"
                                : "var(--bg-primary)",
                            color:
                              t.status === "done"
                                ? "var(--accent-text)"
                                : t.status === "inprogress"
                                ? "#f59e0b"
                                : "var(--text-primary)",
                            cursor: "pointer",
                          }}
                        >
                          <option value="todo">To Do</option>
                          <option value="inprogress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            backgroundColor: pri.bg,
                            color: pri.color,
                            border: pri.border,
                          }}
                        >
                          {pri.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <img
                            src={
                              t.assignee.avatar ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(t.assignee.email)}`
                            }
                            alt={t.assignee.name}
                            style={{ width: "22px", height: "22px", borderRadius: "50%", objectFit: "cover" }}
                          />
                          <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>{t.assignee.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "12px" }}>
                        {(() => {
                          const info = getTaskDeadlineInfo(t.dueDate);
                          return (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 500,
                                padding: "2px 8px",
                                borderRadius: "4px",
                                backgroundColor: info.bg,
                                color: info.color,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Clock size={11} />
                              {info.display}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "var(--text-muted)" }}>
                        {totalSub > 0 ? `${completedSub}/${totalSub}` : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => requestDeleteTask(t)}
                          className="btn-icon"
                          style={{ width: "30px", height: "30px", color: "var(--text-muted)" }}
                          title="Delete work item"
                          aria-label={`Delete ${t.title}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-primary)" }}>
            <button
              onClick={() => {
                setIsAddingIn("todo");
                setViewType("board");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "transparent",
                border: "none",
                color: "var(--accent)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Plus size={14} /> Add new task
            </button>
          </div>
        </div>
      ) : (
        <div
          className="task-board-columns"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "24px",
            alignItems: "flex-start",
          }}
        >
        {columns.map((col, colIdx) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          const isOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              onDragEnter={(e) => {
                if (!draggedTaskId) return;
                e.preventDefault();
                setDragOverColumn(col.id);
              }}
              onDragOver={(e) => {
                if (!draggedTaskId) return;
                e.preventDefault();
                setDragOverColumn(col.id);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverColumn === col.id) setDragOverColumn(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedTaskId) {
                  handleMoveTask(draggedTaskId, col.id);
                }
                setDraggedTaskId(null);
                setDragOverColumn(null);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                backgroundColor: isOver ? "var(--accent)" : "transparent",
                border: isOver ? "2px dashed var(--accent-hover)" : "2px solid transparent",
                borderRadius: "var(--radius-lg)",
                padding: "8px",
                boxShadow: isOver ? "0 0 0 3px var(--accent-light)" : "none",
                transition: "background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                minHeight: "450px",
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "8px",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <h3
                  className="font-serif"
                  style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}
                >
                  {col.title}{" "}
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 400 }}>
                    ({colTasks.length})
                  </span>
                </h3>

                <button
                  onClick={() => {
                    setIsAddingIn(col.id);
                    setNewTaskTitle("");
                  }}
                  className="btn-icon"
                  style={{ width: "24px", height: "24px" }}
                  title="Add Task"
                >
                  <Plus size={14} />
                </button>
              </div>

              {isOver && <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, textAlign: "center", padding: "4px 0" }}>Drop task in {col.title}</div>}

              {/* Task Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {colTasks.map((task) => {
                  const pBadge = getPriorityBadge(task.priority);
                  const subtasks = task.subtasks || [];
                  const completedSubs = subtasks.filter((s) => s.completed).length;

                  return (
                    <div
                      key={task.id}
                      draggable={true}
                      onDragStart={() => setDraggedTaskId(task.id)}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setDragOverColumn(null);
                      }}
                      onClick={() => setSelectedTask(task)}
                      style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-lg)",
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        transition: "all 0.15s ease",
                        cursor: "grab",
                        boxShadow: "var(--shadow-sm)",
                        opacity: draggedTaskId === task.id ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-focus)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-subtle)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      {/* Priority Tag & Quick Status Transition */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 7px", borderRadius: "10px", background: "var(--bg-nav-active)", color: "var(--text-secondary)" }}>
                            {getTaskTypeIcon(task.type)} {getTaskTypeLabel(task.type)}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              padding: "2px 8px",
                              borderRadius: "10px",
                              backgroundColor: pBadge.bg,
                              color: pBadge.color,
                              border: pBadge.border,
                            }}
                          >
                            {pBadge.label}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                          {colIdx > 0 && (
                            <button
                              onClick={() => {
                                const prev = columns[colIdx - 1].id;
                                handleMoveTask(task.id, prev);
                              }}
                              className="btn-icon"
                              style={{ width: "22px", height: "22px" }}
                              title="Move Left"
                            >
                              <ChevronLeft size={13} />
                            </button>
                          )}
                          {colIdx < columns.length - 1 && (
                            <button
                              onClick={() => {
                                const next = columns[colIdx + 1].id;
                                handleMoveTask(task.id, next);
                              }}
                              className="btn-icon"
                              style={{ width: "22px", height: "22px" }}
                              title="Move Right"
                            >
                              <ChevronRight size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Task Title with @ Mention Highlighting */}
                      <h4
                        style={{
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          lineHeight: 1.45,
                          margin: 0,
                        }}
                      >
                        {task.title.split(" ").map((word, wIdx) => {
                          if (word.startsWith("@")) {
                            return (
                              <span key={wIdx} style={{ color: "var(--accent)", fontWeight: 600 }}>
                                {word}{" "}
                              </span>
                            );
                          }
                          return word + " ";
                        })}
                      </h4>

                      {/* Subtask Progress indicator (if exists) */}
                      {subtasks.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "11px",
                            color: completedSubs === subtasks.length ? "var(--accent-text)" : "var(--text-muted)",
                          }}
                        >
                          <CheckSquare size={12} />
                          <span>
                            {completedSubs}/{subtasks.length} subtasks
                          </span>
                        </div>
                      )}

                      {/* Footer: Due Date & Assignee Avatar */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingTop: "6px",
                          borderTop: "1px solid var(--border-subtle)",
                        }}
                      >
                        {(() => {
                          const info = getTaskDeadlineInfo(task.dueDate);
                          return (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 500,
                                color: info.color,
                                backgroundColor: info.bg,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Clock size={11} />
                              {info.display}
                            </span>
                          );
                        })()}

                        {/* Assignee Avatar */}
                        <div
                          title={`Assigned to ${task.assignee.name}`}
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            overflow: "hidden",
                            border: "1px solid var(--border-subtle)",
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={
                              task.assignee.avatar ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                task.assignee.email
                              )}`
                            }
                            alt={task.assignee.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      </div>

                      <div
                        className="task-card-actions"
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: "28px" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedTask(task)}
                          className="btn-secondary"
                          style={{ padding: "5px 9px", fontSize: "11px" }}
                        >
                          Open details
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteTask(task)}
                          className="btn-icon"
                          style={{ width: "28px", height: "28px", color: "var(--text-muted)" }}
                          title="Delete work item"
                          aria-label={`Delete ${task.title}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add Task Input Form */}
                {isAddingIn === col.id ? (
                  <div
                    style={{
                      padding: "14px",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-focus)",
                      borderRadius: "var(--radius-lg)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="Title..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddTask(col.id);
                        if (e.key === "Escape") setIsAddingIn(null);
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    />

                    <textarea
                      value={newTaskDescription}
                      onChange={(e) => setNewTaskDescription(e.target.value)}
                      placeholder="Add notes or acceptance criteria (optional)"
                      rows={2}
                      style={{ background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", outline: "none", color: "var(--text-primary)", fontSize: "12px", padding: "7px 8px", resize: "vertical" }}
                    />

                    {/* Quick selectors for Priority and Assignee */}
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <select
                        value={newTaskType}
                        onChange={(e) => setNewTaskType(e.target.value as TaskType)}
                        aria-label="Work item type"
                        style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "11px", padding: "3px 6px", outline: "none" }}
                      >
                        <option value="task">Task</option>
                        <option value="bug">Bug</option>
                        <option value="feature">Feature</option>
                        <option value="improvement">Improvement</option>
                        <option value="question">Question</option>
                      </select>
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as any)}
                        style={{
                          backgroundColor: "var(--bg-primary)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          fontSize: "11px",
                          padding: "3px 6px",
                          outline: "none",
                        }}
                      >
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>

                      {members.length > 0 && (
                        <select
                          value={newTaskAssigneeEmail}
                          onChange={(e) => setNewTaskAssigneeEmail(e.target.value)}
                          style={{
                            backgroundColor: "var(--bg-primary)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--text-primary)",
                            fontSize: "11px",
                            padding: "3px 6px",
                            outline: "none",
                            maxWidth: "140px",
                          }}
                        >
                          {members.map((m) => (
                            <option key={m.email} value={m.email}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      )}

                      <input
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        style={{
                          backgroundColor: "var(--bg-primary)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          fontSize: "11px",
                          padding: "3px 6px",
                          outline: "none",
                        }}
                        title="Due Date"
                      />
                    </div>

                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => setIsAddingIn(null)}
                        className="btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleAddTask(col.id)}
                        className="btn-primary"
                        style={{ padding: "4px 10px", fontSize: "11px" }}
                      >
                        Add Task
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setIsAddingIn(col.id);
                      setNewTaskTitle("");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 12px",
                      background: "transparent",
                      border: "none",
                      color: "var(--accent)",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      borderRadius: "var(--radius-md)",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-light)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <Plus size={14} /> Add task
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Task Detail & Edit Modal */}
      {selectedTask && (
        <div
          onClick={() => setSelectedTask(null)}
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
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    ...getPriorityBadge(selectedTask.priority),
                  }}
                >
                  {selectedTask.priority || "Medium"}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {selectedTask.status.toUpperCase()}
                </span>
              </div>
              <button onClick={() => setSelectedTask(null)} className="btn-icon">
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Task Title */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                  Title
                </label>
                <input
                  type="text"
                  value={selectedTask.title}
                  onChange={(e) => setSelectedTask({ ...selectedTask, title: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                  Work item type
                </label>
                <select
                  value={selectedTask.type || "task"}
                  onChange={(e) => setSelectedTask({ ...selectedTask, type: e.target.value as TaskType })}
                  style={{ width: "100%", padding: "8px 12px", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "13px", outline: "none" }}
                >
                  <option value="task">Task</option>
                  <option value="bug">Bug</option>
                  <option value="feature">Feature</option>
                  <option value="improvement">Improvement</option>
                  <option value="question">Question</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                  Notes and acceptance criteria
                </label>
                <textarea
                  value={selectedTask.description || ""}
                  onChange={(e) => setSelectedTask({ ...selectedTask, description: e.target.value })}
                  rows={4}
                  placeholder="Describe the work, context, or definition of done..."
                  style={{ width: "100%", padding: "8px 12px", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "13px", outline: "none", resize: "vertical" }}
                />
              </div>

              {/* Status & Priority Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                    Status
                  </label>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => setSelectedTask({ ...selectedTask, status: e.target.value as any })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  >
                    <option value="todo">To Do</option>
                    <option value="inprogress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                    Priority
                  </label>
                  <select
                    value={selectedTask.priority || "medium"}
                    onChange={(e) => setSelectedTask({ ...selectedTask, priority: e.target.value as any })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Assignee & Due Date Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                    Assignee
                  </label>
                  <select
                    value={selectedTask.assignee.email}
                    onChange={(e) => {
                      const found = members.find((m) => m.email.toLowerCase() === e.target.value.toLowerCase());
                      if (found) {
                        setSelectedTask({
                          ...selectedTask,
                          assignee: {
                            name: found.name,
                            email: found.email,
                            avatar: found.avatar,
                          },
                        });
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  >
                    <option value={selectedTask.assignee.email}>
                      {selectedTask.assignee.name} ({selectedTask.assignee.email})
                    </option>
                    {members
                      .filter((m) => m.email.toLowerCase() !== selectedTask.assignee.email.toLowerCase())
                      .map((m) => (
                        <option key={m.email} value={m.email}>
                          {m.name} ({m.email})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Due Date (Calendar)
                    </label>
                    {selectedTask.dueDate && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          backgroundColor: getTaskDeadlineInfo(selectedTask.dueDate).bg,
                          color: getTaskDeadlineInfo(selectedTask.dueDate).color,
                        }}
                      >
                        {getTaskDeadlineInfo(selectedTask.dueDate).display}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={
                      !isNaN(Date.parse(selectedTask.dueDate))
                        ? new Date(selectedTask.dueDate).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) => setSelectedTask({ ...selectedTask, dueDate: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                  {/* Quick Preset Date Buttons */}
                  <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split("T")[0];
                        setSelectedTask({ ...selectedTask, dueDate: today });
                      }}
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
                        setSelectedTask({ ...selectedTask, dueDate: tomorrow });
                      }}
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const in3Days = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
                        setSelectedTask({ ...selectedTask, dueDate: in3Days });
                      }}
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      +3 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
                        setSelectedTask({ ...selectedTask, dueDate: nextWeek });
                      }}
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      Next Week
                    </button>
                    {selectedTask.dueDate && (
                      <button
                        type="button"
                        onClick={() => setSelectedTask({ ...selectedTask, dueDate: "" })}
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          backgroundColor: "transparent",
                          border: "1px dashed var(--border-subtle)",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Discussion */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                  <MessageSquare size={13} /> Discussion ({selectedTask.comments?.length || 0})
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto", marginBottom: "8px" }}>
                  {(selectedTask.comments || []).map((comment) => (
                    <div key={comment.id} style={{ padding: "8px 10px", background: "var(--bg-primary)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "3px" }}>
                        <strong style={{ fontSize: "11px", color: "var(--text-primary)" }}>{comment.user.name}</strong>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{new Date(comment.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.4 }}>{comment.text}</div>
                    </div>
                  ))}
                  {(selectedTask.comments || []).length === 0 && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No discussion yet.</span>}
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handlePostComment(); } }}
                    placeholder="Write a comment..."
                    aria-label="Write a comment"
                    maxLength={5000}
                    style={{ flex: 1, minWidth: 0, padding: "7px 9px", background: "var(--bg-primary)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "12px", outline: "none" }}
                  />
                  <button onClick={() => void handlePostComment()} className="btn-secondary" disabled={isPostingComment || !newCommentText.trim()} style={{ padding: "6px 10px", fontSize: "12px" }}>{isPostingComment ? "Posting…" : "Comment"}</button>
                </div>
              </div>

              {/* Subtasks Checklist */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                  Subtasks Checklist
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
                  {(selectedTask.subtasks || []).map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        backgroundColor: "var(--bg-primary)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div
                        onClick={() => {
                          const updated = (selectedTask.subtasks || []).map((s) =>
                            s.id === sub.id ? { ...s, completed: !s.completed } : s
                          );
                          setSelectedTask({ ...selectedTask, subtasks: updated });
                        }}
                        style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                      >
                        {sub.completed ? (
                          <CheckSquare size={14} color="var(--accent)" />
                        ) : (
                          <Square size={14} color="var(--text-muted)" />
                        )}
                        <span
                          style={{
                            fontSize: "13px",
                            color: sub.completed ? "var(--text-muted)" : "var(--text-primary)",
                            textDecoration: sub.completed ? "line-through" : "none",
                          }}
                        >
                          {sub.title}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteSubtask(sub.id)}
                        className="btn-icon"
                        style={{ width: "20px", height: "20px", color: "var(--text-muted)" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    placeholder="Add a subtask..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddSubtask();
                    }}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      fontSize: "12px",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleAddSubtask}
                    className="btn-secondary"
                    style={{ padding: "6px 10px", fontSize: "12px" }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderTop: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-primary)",
              }}
            >
              <button
                onClick={() => requestDeleteTask(selectedTask)}
                className="btn-secondary"
                style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.35)", gap: "6px", fontSize: "12px", padding: "7px 10px" }}
              >
                <Trash2 size={14} /> Delete work item
              </button>

              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setSelectedTask(null)} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSaveSelectedTask} className="btn-primary">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          role="presentation"
          onClick={() => !isDeleting && setDeleteTarget(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            backgroundColor: "rgba(0, 0, 0, 0.55)",
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-task-title"
            aria-describedby="delete-task-description"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "420px",
              padding: "22px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ display: "grid", placeItems: "center", width: "34px", height: "34px", flexShrink: 0, borderRadius: "50%", color: "#dc2626", backgroundColor: "rgba(239, 68, 68, 0.12)" }}>
                <Trash2 size={17} />
              </div>
              <div>
                <h2 id="delete-task-title" style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Delete work item?</h2>
                <p id="delete-task-description" style={{ margin: "7px 0 0", fontSize: "13px", lineHeight: 1.5, color: "var(--text-secondary)" }}>
                  “{deleteTarget.title}” and its discussion will be permanently removed.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "22px" }}>
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary" disabled={isDeleting}>Cancel</button>
              <button type="button" onClick={() => void handleDeleteTask(deleteTarget.id)} className="btn-primary" disabled={isDeleting} style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}>
                {isDeleting ? "Deleting…" : "Delete work item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {boardToDelete && (
        <div
          role="presentation"
          onClick={() => !isDeletingBoard && setBoardToDelete(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(0, 0, 0, 0.55)" }}
        >
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-board-title" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, padding: 22, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)" }}>
            <h2 id="delete-board-title" style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>Remove “{boardToDelete.name}”?</h2>
            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>The board and all work items on it will be permanently removed.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
              <button type="button" className="btn-secondary" onClick={() => setBoardToDelete(null)} disabled={isDeletingBoard}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => void handleDeleteBoard()} disabled={isDeletingBoard} style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}>{isDeletingBoard ? "Removing…" : "Remove board"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
