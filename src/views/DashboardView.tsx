import React from "react";
import {
  FileText,
  FileCode,
  ListCheck,
  Image as ImageIcon,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { ActivityItem, UserProfile, TaskItem, TreeNode, PhotoItem } from "../types.ts";

interface DashboardViewProps {
  currentUser: UserProfile;
  activities: ActivityItem[];
  tasks?: TaskItem[];
  tree?: TreeNode[];
  photos?: PhotoItem[];
  onNavigateDoc: (docId: string) => void;
  onNavigateView: (view: "tasks" | "notes" | "documents") => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  activities,
  tasks = [],
  tree = [],
  photos = [],
  onNavigateDoc,
  onNavigateView,
}) => {
  const currentDateFormatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = currentUser.name?.trim().split(" ")[0] || "there";

  const activeTasksCount = tasks.filter((t) => t.status !== "done").length;
  const notesCount = tree.filter((n) => n.type === "doc").length;
  const filesCount = tree.filter((n) => n.type === "file").length;
  const totalBytes =
    tree.reduce((acc, n) => acc + (n.size || 0), 0) +
    photos.reduce((acc, p) => acc + (p.size || 0), 0);

  const formatStorage = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes > 0) return `${Math.round(bytes / 1024)} KB`;
    return "0 KB";
  };

  const firstDoc = tree.find((n) => n.type === "doc");

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "doc":
        return <FileText size={16} color="var(--text-secondary)" />;
      case "file":
        return <FileCode size={16} color="var(--text-secondary)" />;
      case "task":
        return <ListCheck size={16} color="var(--text-secondary)" />;
      case "photo":
        return <ImageIcon size={16} color="var(--text-secondary)" />;
    }
  };

  return (
    <div
      className="animate-fade-in dashboard-view"
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "48px 32px",
        display: "flex",
        flexDirection: "column",
        gap: "40px",
      }}
    >
      {/* Greeting Header */}
      <div>
        <h1
          className="font-serif"
          style={{
            fontSize: "28px",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
            marginBottom: "4px",
          }}
        >
          {greeting}, {firstName}
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            marginBottom: "24px",
          }}
        >
          {currentDateFormatted}
        </p>

        <p
          style={{
            fontSize: "14px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          You have{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {activeTasksCount} active {activeTasksCount === 1 ? "task" : "tasks"}
          </strong>
          ,{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {notesCount} {notesCount === 1 ? "document" : "documents"}
          </strong>
          , and{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {formatStorage(totalBytes)}
          </strong>{" "}
          stored in Cloudflare R2 edge storage.
        </p>
      </div>

      {/* Quick Launch Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          onClick={() => {
            if (firstDoc) {
              onNavigateDoc(firstDoc.id);
            } else {
              onNavigateView("notes");
            }
          }}
          style={{
            padding: "20px",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-focus)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ color: "var(--accent)" }}>
              <Sparkles size={20} />
            </span>
            <ArrowRight size={16} color="var(--text-muted)" />
          </div>
          <h3 className="font-serif" style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>
            {firstDoc ? firstDoc.name : "New Document"}
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {firstDoc ? "Collaborative workspace document" : "Create your first document"}
          </p>
        </div>

        <div
          onClick={() => onNavigateView("documents")}
          style={{
            padding: "20px",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-focus)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ color: "var(--accent)" }}>
              <FileCode size={20} />
            </span>
            <ArrowRight size={16} color="var(--text-muted)" />
          </div>
          <h3 className="font-serif" style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>
            Files & Storage
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            Manage R2 files & uploads
          </p>
        </div>

        <div
          onClick={() => onNavigateView("tasks")}
          style={{
            padding: "20px",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-focus)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ color: "var(--accent)" }}>
              <ListCheck size={20} />
            </span>
            <ArrowRight size={16} color="var(--text-muted)" />
          </div>
          <h3 className="font-serif" style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>
            Task Board
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            Kanban sprint tracking
          </p>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div>
        <h2
          className="font-serif"
          style={{
            fontSize: "18px",
            fontWeight: 500,
            color: "var(--text-primary)",
            marginBottom: "16px",
          }}
        >
          Recent activity
        </h2>

        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}
        >
          {activities.map((item, idx) => (
            <div
              className="dashboard-activity-row"
              key={item.id || idx}
              onClick={() => {
                if (item.type === "doc") onNavigateDoc("doc-manifesto");
                else if (item.type === "file") onNavigateView("documents");
                else if (item.type === "task") onNavigateView("tasks");
                else if (item.type === "photo") onNavigateView("documents");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom:
                  idx < activities.length - 1 ? "1px solid var(--border-subtle)" : "none",
                cursor: "pointer",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  {getActivityIcon(item.type)}
                </div>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 400,
                    color: "var(--text-primary)",
                  }}
                >
                  {item.title}
                </span>
              </div>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                }}
              >
                {item.timestamp}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
