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
} from "lucide-react";
import { TaskItem, TaskSubtask, UserProfile, WorkspaceMember } from "../types.ts";

interface TasksViewProps {
  tasks: TaskItem[];
  currentUser: UserProfile;
  workspaceId?: string;
  onUpdateTasks: (tasks: TaskItem[]) => Promise<void>;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  currentUser,
  workspaceId = "default",
  onUpdateTasks,
}) => {
  const [filter, setFilter] = useState<"all" | "mine" | "due" | "high">("all");
  const [viewType, setViewType] = useState<"board" | "table">("board");
  const [isAddingIn, setIsAddingIn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [newTaskAssigneeEmail, setNewTaskAssigneeEmail] = useState<string>(currentUser.email);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  // Drag and Drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Task Detail Modal state
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // Fetch workspace members for assignee selection
  useEffect(() => {
    fetch(`/api/workspaces/${workspaceId}/members?user=${encodeURIComponent(currentUser.email)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.members || [];
        setMembers(list);
      })
      .catch(() => {});
  }, [workspaceId, currentUser.email]);

  const filteredTasks = tasks.filter((t) => {
    if (filter === "mine") return t.assignee.email.toLowerCase() === currentUser.email.toLowerCase();
    if (filter === "due") return t.dueDate.toLowerCase().includes("due") || t.dueDate.toLowerCase().includes("soon");
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

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      status,
      priority: newTaskPriority,
      dueDate: "Due soon",
      assignee: {
        name: assignedMember.name,
        email: assignedMember.email,
        avatar: assignedMember.avatar,
      },
      subtasks: [],
    };

    const updated = [...tasks, newTask];
    await onUpdateTasks(updated);
    setNewTaskTitle("");
    setNewTaskPriority("medium");
    setNewTaskAssigneeEmail(currentUser.email);
    setIsAddingIn(null);
  };

  const handleMoveTask = async (taskId: string, nextStatus: "todo" | "inprogress" | "done") => {
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t));
    await onUpdateTasks(updated);
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, status: nextStatus });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const updated = tasks.filter((t) => t.id !== taskId);
    await onUpdateTasks(updated);
    setSelectedTask(null);
  };

  const handleSaveSelectedTask = async () => {
    if (!selectedTask) return;
    const updated = tasks.map((t) => (t.id === selectedTask.id ? selectedTask : t));
    await onUpdateTasks(updated);
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
    await onUpdateTasks(updated);
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
      className="animate-fade-in"
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "48px 32px",
      }}
    >
      {/* Header Row */}
      <div
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
            Drag-and-drop Kanban execution backed by zero-cost Cloudflare R2
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
        </div>
      </div>

      {viewType === "table" ? (
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
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "var(--text-secondary)" }}>
                        {t.dueDate}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "var(--text-muted)" }}>
                        {totalSub > 0 ? `${completedSub}/${totalSub}` : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          className="btn-icon"
                          style={{ width: "26px", height: "26px", color: "var(--text-muted)" }}
                          title="Delete Task"
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
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverColumn(col.id);
              }}
              onDragLeave={() => {
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
                backgroundColor: isOver ? "var(--bg-nav-active)" : "transparent",
                borderRadius: "var(--radius-lg)",
                padding: "8px",
                transition: "background 0.15s ease",
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
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--text-secondary)",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Clock size={12} />
                          {task.dueDate}
                        </span>

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
                      placeholder="Task title... (Type @ to mention)"
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

                    {/* Quick selectors for Priority and Assignee */}
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                    Due Date
                  </label>
                  <input
                    type="text"
                    value={selectedTask.dueDate}
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
                onClick={() => handleDeleteTask(selectedTask.id)}
                className="btn-icon"
                style={{ color: "#ef4444", gap: "4px", fontSize: "12px", width: "auto", padding: "4px 8px" }}
              >
                <Trash2 size={14} /> Delete
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
    </div>
  );
};
