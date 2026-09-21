import React, { useState } from "react";
import { Plus, Check, Clock, ChevronRight } from "lucide-react";
import { TaskItem, UserProfile } from "../types.ts";

interface TasksViewProps {
  tasks: TaskItem[];
  currentUser: UserProfile;
  onUpdateTasks: (tasks: TaskItem[]) => Promise<void>;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  currentUser,
  onUpdateTasks,
}) => {
  const [filter, setFilter] = useState<"all" | "mine" | "due">("all");
  const [isAddingIn, setIsAddingIn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const filteredTasks = tasks.filter((t) => {
    if (filter === "mine") return t.assignee.email === currentUser.email;
    if (filter === "due") return t.dueDate.toLowerCase().includes("due");
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

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      status,
      dueDate: "Due soon",
      assignee: {
        name: currentUser.name,
        email: currentUser.email,
        avatar: currentUser.avatar,
      },
    };

    const updated = [...tasks, newTask];
    await onUpdateTasks(updated);
    setNewTaskTitle("");
    setIsAddingIn(null);
  };

  const handleMoveTask = async (taskId: string, nextStatus: "todo" | "inprogress" | "done") => {
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t));
    await onUpdateTasks(updated);
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
            Task Board
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Sprint execution & backlog persisted in R2
          </p>
        </div>

        {/* Filters (Matching Figma: All, My Tasks, Due Soon) */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => setFilter("all")}
            className="btn-secondary"
            style={{
              backgroundColor: filter === "all" ? "var(--accent-light)" : "transparent",
              color: filter === "all" ? "var(--accent-text)" : "var(--text-secondary)",
              borderColor: filter === "all" ? "var(--accent)" : "var(--border-subtle)",
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilter("mine")}
            className="btn-secondary"
            style={{
              backgroundColor: filter === "mine" ? "var(--accent-light)" : "transparent",
              color: filter === "mine" ? "var(--accent-text)" : "var(--text-secondary)",
              borderColor: filter === "mine" ? "var(--accent)" : "var(--border-subtle)",
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
            }}
          >
            Due Soon
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "24px",
        }}
      >
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "8px",
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
              </div>

              {/* Task Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-lg)",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      transition: "all 0.15s ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-focus)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <h4
                        style={{
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          lineHeight: 1.4,
                        }}
                      >
                        {task.title}
                      </h4>

                      {/* Move Column Shortcut */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next =
                            col.id === "todo"
                              ? "inprogress"
                              : col.id === "inprogress"
                              ? "done"
                              : "todo";
                          handleMoveTask(task.id, next);
                        }}
                        className="btn-icon"
                        style={{ width: "20px", height: "20px" }}
                        title={`Move to next status`}
                      >
                        <ChevronRight size={12} />
                      </button>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "4px",
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
                        title={task.assignee.name}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          overflow: "hidden",
                          border: "1px solid var(--border-subtle)",
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
                ))}

                {/* Add Task Input Form */}
                {isAddingIn === col.id ? (
                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-focus)",
                      borderRadius: "var(--radius-lg)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="Task description..."
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
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                      >
                        Add
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
    </div>
  );
};
