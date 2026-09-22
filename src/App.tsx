import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar.tsx";
import { Header } from "./components/Header.tsx";
import { DashboardView } from "./views/DashboardView.tsx";
import { EditorView } from "./views/EditorView.tsx";
import { DocumentsView } from "./views/DocumentsView.tsx";
import { TasksView } from "./views/TasksView.tsx";
import { PhotosView } from "./views/PhotosView.tsx";
import { SearchModal } from "./components/SearchModal.tsx";
import { SettingsModal } from "./components/SettingsModal.tsx";
import { FilePreviewModal } from "./components/FilePreviewModal.tsx";
import { CreateWorkspaceModal } from "./components/CreateWorkspaceModal.tsx";
import { TeamMembersModal } from "./components/TeamMembersModal.tsx";
import {
  ViewMode,
  TreeNode,
  TaskItem,
  PhotoItem,
  ActivityItem,
  UserProfile,
  DocAttachment,
  UserWorkspaceReference,
  MentionNotification,
} from "./types.ts";
import { MarkdownRenderer } from "./components/MarkdownRenderer.tsx";

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>("home");
  const [activeDocId, setActiveDocId] = useState<string>("doc-manifesto");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    name: "Alex Sterling",
    email: "alex@clocean.co",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  });

  // Workspaces / Organizations state
  const [workspaces, setWorkspaces] = useState<UserWorkspaceReference[]>([
    { id: "default", name: "Clocean Main", icon: "🌊", role: "owner" },
  ]);
  const [currentWorkspace, setCurrentWorkspace] = useState<UserWorkspaceReference>({
    id: "default",
    name: "Clocean Main",
    icon: "🌊",
    role: "owner",
  });
  const [isCreateWsOpen, setIsCreateWsOpen] = useState(false);
  const [isTeamMembersOpen, setIsTeamMembersOpen] = useState(false);
  const [notifications, setNotifications] = useState<MentionNotification[]>([]);

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<TreeNode | DocAttachment | null>(null);

  // Public document share link handling (?p=pub-xxx)
  const [publicToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("p");
  });
  const [publicDoc, setPublicDoc] = useState<any>(null);
  const [publicLoading, setPublicLoading] = useState<boolean>(!!publicToken);
  const [publicError, setPublicError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicToken) return;
    fetch(`/api/public/docs/${publicToken}`)
      .then((res) => {
        if (!res.ok) throw new Error("Public document not found or sharing has been revoked.");
        return res.json();
      })
      .then((data) => {
        setPublicDoc(data);
        setPublicLoading(false);
      })
      .catch((err) => {
        setPublicError(err.message);
        setPublicLoading(false);
      });
  }, [publicToken]);

  // Sync theme with DOM document attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load user's workspaces
  const loadWorkspaces = async () => {
    try {
      const res = await fetch(`/api/workspaces?user=${encodeURIComponent(currentUser.email)}`);
      if (res.ok) {
        const data: UserWorkspaceReference[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setWorkspaces(data);
          const found = data.find((w) => w.id === currentWorkspace.id);
          if (found) {
            setCurrentWorkspace(found);
          } else {
            setCurrentWorkspace(data[0]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load workspaces:", err);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [currentUser.email]);

  // Load initial data from Worker API (backed by Cloudflare R2 for the active workspace)
  const refreshData = async () => {
    try {
      const headers = { "x-workspace-id": currentWorkspace.id };
      const [treeRes, tasksRes, photosRes, actRes, userRes, notifRes] = await Promise.all([
        fetch("/api/tree", { headers }).then((r) => r.json() as Promise<{ nodes?: TreeNode[] }>),
        fetch("/api/tasks", { headers }).then((r) => r.json() as Promise<TaskItem[]>),
        fetch("/api/photos", { headers }).then((r) => r.json() as Promise<PhotoItem[]>),
        fetch("/api/activity", { headers }).then((r) => r.json() as Promise<ActivityItem[]>),
        fetch(`/api/me?user=${currentUser.email.split("@")[0]}`).then((r) => r.json() as Promise<UserProfile>),
        fetch(`/api/notifications?user=${encodeURIComponent(currentUser.email)}`)
          .then((r) => r.json() as Promise<MentionNotification[]>)
          .catch(() => []),
      ]);

      if (treeRes?.nodes) setTree(treeRes.nodes);
      if (Array.isArray(tasksRes)) setTasks(tasksRes);
      if (Array.isArray(photosRes)) setPhotos(photosRes);
      if (Array.isArray(actRes)) setActivities(actRes);
      if (userRes?.email) setCurrentUser(userRes);
      if (Array.isArray(notifRes)) setNotifications(notifRes);
    } catch (err) {
      console.error("Failed to load workspace data:", err);
    }
  };

  const handleMarkNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch(`/api/notifications/read?user=${encodeURIComponent(currentUser.email)}`, {
      method: "PUT",
    }).catch(() => {});
  };

  useEffect(() => {
    refreshData();
  }, [currentUser.email, currentWorkspace.id]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleSwitchUser = (email: string) => {
    const nameMap: Record<string, string> = {
      "alex@clocean.co": "Alex Sterling",
      "marcus@clocean.co": "Marcus Vance",
      "elena@clocean.co": "Elena Rostova",
      "sofia@clocean.co": "Sofia Chen",
    };
    setCurrentUser({
      email,
      name: nameMap[email] || email.split("@")[0],
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`,
    });
  };

  const handleUploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "x-workspace-id": currentWorkspace.id },
      body: formData,
    });

    if (!res.ok) throw new Error("Upload failed");
    await refreshData();
  };

  const handleDeleteFile = async (fileId: string) => {
    await fetch(`/api/tree/node/${fileId}`, {
      method: "DELETE",
      headers: { "x-workspace-id": currentWorkspace.id },
    });
    setTree((prev) => prev.filter((n) => n.id !== fileId));
  };

  const handleUpdateTasks = async (newTasks: TaskItem[]) => {
    setTasks(newTasks);
    await fetch("/api/tasks", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": currentWorkspace.id,
      },
      body: JSON.stringify(newTasks),
    });
  };

  const handleNavigateDoc = (docId: string) => {
    setActiveDocId(docId);
    setCurrentView("notes");
  };

  // Breadcrumbs determination
  const getBreadcrumbs = () => {
    if (currentView === "notes") {
      const activeDoc = tree.find((t) => t.id === activeDocId);
      return [
        { label: "Notes", onClick: () => setCurrentView("notes") },
        { label: activeDoc ? activeDoc.name : "Ocean Launch" },
      ];
    }
    return undefined;
  };

  if (publicToken) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-primary)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            padding: "16px 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
            <span style={{ fontSize: "20px" }}>🌊</span>
            <span style={{ color: "var(--text-primary)", fontSize: "15px" }}>Clocean Public Web</span>
          </div>
          <button
            onClick={handleToggleTheme}
            className="btn-icon"
            style={{ width: "32px", height: "32px", fontSize: "14px" }}
            title="Toggle Theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </header>

        <main style={{ flex: 1, maxWidth: "800px", width: "100%", margin: "0 auto", padding: "48px 24px" }}>
          {publicLoading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
              Loading document from Cloudflare edge...
            </div>
          ) : publicError ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <h2 style={{ color: "#ef4444", marginBottom: "8px" }}>404 Not Found</h2>
              <p style={{ color: "var(--text-muted)" }}>{publicError}</p>
            </div>
          ) : publicDoc ? (
            <div>
              {publicDoc.cover && (
                <div
                  style={{
                    height: "180px",
                    background: publicDoc.cover,
                    borderRadius: "var(--radius-lg)",
                    marginBottom: "28px",
                  }}
                />
              )}
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>{publicDoc.icon || "📄"}</div>
              <h1 className="font-serif" style={{ fontSize: "36px", fontWeight: 600, marginBottom: "12px", color: "var(--text-primary)" }}>
                {publicDoc.title}
              </h1>
              <div style={{ display: "flex", gap: "6px", marginBottom: "28px" }}>
                {(publicDoc.tags || []).map((t: string, idx: number) => (
                  <span key={idx} style={{ fontSize: "12px", color: "var(--accent-text)", fontWeight: 500 }}>
                    {t}
                  </span>
                ))}
              </div>
              <MarkdownRenderer content={publicDoc.content} />
            </div>
          ) : null}
        </main>

        <footer
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "20px",
            textAlign: "center",
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          Published with <strong>Clocean</strong> — Zero-cost serverless document workspace
        </footer>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Figma Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
        currentUser={currentUser}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onSwitchUser={handleSwitchUser}
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={(ws) => setCurrentWorkspace(ws)}
        onOpenCreateWorkspace={() => setIsCreateWsOpen(true)}
        onOpenTeamMembers={() => setIsTeamMembersOpen(true)}
        tree={tree}
        onSelectDoc={handleNavigateDoc}
      />

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflowY: "auto",
          backgroundColor: "var(--bg-primary)",
        }}
      >
        {/* Top Header */}
        <Header
          breadcrumbs={getBreadcrumbs()}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          notifications={notifications}
          onSelectDoc={(docId) => handleNavigateDoc(docId)}
          onMarkNotificationsRead={handleMarkNotificationsRead}
        />

        {/* View Routing */}
        <main style={{ flex: 1 }}>
          {currentView === "home" && (
            <DashboardView
              currentUser={currentUser}
              activities={activities}
              onNavigateDoc={handleNavigateDoc}
              onNavigateView={(v) => setCurrentView(v)}
            />
          )}

          {currentView === "notes" && (
            <EditorView
              docId={activeDocId}
              currentUser={currentUser}
              workspaceId={currentWorkspace.id}
              onOpenFilePreview={(att) => setPreviewFile(att)}
            />
          )}

          {currentView === "documents" && (
            <DocumentsView
              files={tree}
              onUploadFile={handleUploadFile}
              onDeleteFile={handleDeleteFile}
              onPreviewFile={(f) => setPreviewFile(f)}
            />
          )}

          {currentView === "tasks" && (
            <TasksView
              tasks={tasks}
              currentUser={currentUser}
              workspaceId={currentWorkspace.id}
              onUpdateTasks={handleUpdateTasks}
            />
          )}

          {currentView === "photos" && (
            <PhotosView
              photos={photos}
              onUploadPhoto={(file) => handleUploadFile(file)}
            />
          )}

          {(currentView === "templates" || currentView === "import" || currentView === "trash") && (
            <div
              className="animate-fade-in"
              style={{
                padding: "80px 32px",
                maxWidth: "600px",
                margin: "0 auto",
                textAlign: "center",
                color: "var(--text-secondary)",
              }}
            >
              <h2 className="font-serif" style={{ fontSize: "24px", color: "var(--text-primary)", marginBottom: "12px" }}>
                {currentView.charAt(0).toUpperCase() + currentView.slice(1)}
              </h2>
              <p style={{ fontSize: "14px", lineHeight: 1.6 }}>
                All document templates, imported packages, and recycled assets are indexed and
                persisted inside Cloudflare R2 bucket storage.
              </p>
              <button
                onClick={() => setCurrentView("home")}
                className="btn-primary"
                style={{ marginTop: "24px" }}
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Global Modals */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        files={tree}
        tasks={tasks}
        onSelectDoc={handleNavigateDoc}
        onSelectView={(v) => setCurrentView(v)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onUpdateProfile={(profile) => setCurrentUser(profile)}
      />

      <CreateWorkspaceModal
        isOpen={isCreateWsOpen}
        onClose={() => setIsCreateWsOpen(false)}
        onCreated={(newWs) => {
          setWorkspaces((prev) => [...prev, newWs]);
          setCurrentWorkspace(newWs);
        }}
        currentUser={currentUser}
      />

      <TeamMembersModal
        isOpen={isTeamMembersOpen}
        onClose={() => setIsTeamMembersOpen(false)}
        workspace={currentWorkspace}
        currentUser={currentUser}
      />

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
};
