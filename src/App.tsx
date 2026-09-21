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
import {
  ViewMode,
  TreeNode,
  TaskItem,
  PhotoItem,
  ActivityItem,
  UserProfile,
  DocAttachment,
} from "./types.ts";

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

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<TreeNode | DocAttachment | null>(null);

  // Sync theme with DOM document attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load initial data from Worker API (backed by Cloudflare R2)
  const refreshData = async () => {
    try {
      const [treeRes, tasksRes, photosRes, actRes, userRes] = await Promise.all([
        fetch("/api/tree").then((r) => r.json() as Promise<{ nodes?: TreeNode[] }>),
        fetch("/api/tasks").then((r) => r.json() as Promise<TaskItem[]>),
        fetch("/api/photos").then((r) => r.json() as Promise<PhotoItem[]>),
        fetch("/api/activity").then((r) => r.json() as Promise<ActivityItem[]>),
        fetch(`/api/me?user=${currentUser.email.split("@")[0]}`).then((r) => r.json() as Promise<UserProfile>),
      ]);

      if (treeRes?.nodes) setTree(treeRes.nodes);
      if (Array.isArray(tasksRes)) setTasks(tasksRes);
      if (Array.isArray(photosRes)) setPhotos(photosRes);
      if (Array.isArray(actRes)) setActivities(actRes);
      if (userRes?.email) setCurrentUser(userRes);
    } catch (err) {
      console.error("Failed to load workspace data:", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentUser.email]);

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
      body: formData,
    });

    if (!res.ok) throw new Error("Upload failed");
    await refreshData();
  };

  const handleDeleteFile = async (fileId: string) => {
    await fetch(`/api/tree/node/${fileId}`, { method: "DELETE" });
    setTree((prev) => prev.filter((n) => n.id !== fileId));
  };

  const handleUpdateTasks = async (newTasks: TaskItem[]) => {
    setTasks(newTasks);
    await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
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

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
};
