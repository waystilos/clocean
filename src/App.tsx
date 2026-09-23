import React, { useState, useEffect, useCallback, useRef } from "react";
import { Sidebar } from "./components/Sidebar.tsx";
import { Header } from "./components/Header.tsx";
import { DashboardView } from "./views/DashboardView.tsx";
import { EditorView } from "./views/EditorView.tsx";
import { DocumentsView } from "./views/DocumentsView.tsx";
import { TasksView } from "./views/TasksView.tsx";
import { NotesView } from "./views/NotesView.tsx";
import { WorkspaceToolsView } from "./views/WorkspaceToolsView.tsx";
import { DatabasesView } from "./views/DatabasesView.tsx";
import { SearchModal } from "./components/SearchModal.tsx";
import { SettingsModal } from "./components/SettingsModal.tsx";
import { FilePreviewModal } from "./components/FilePreviewModal.tsx";
import { CreateWorkspaceModal } from "./components/CreateWorkspaceModal.tsx";
import { TeamMembersModal } from "./components/TeamMembersModal.tsx";
import { AddSnapModal } from "./components/AddSnapModal.tsx";
import { AuthGate } from "./components/AuthGate.tsx";
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
import { Layers, Sun, Moon, FileText, Users, Home, ListCheck, Folder, PanelLeftOpen } from "lucide-react";

export const App: React.FC = () => {
  const [workspaceError, setWorkspaceError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchTaskId, setSearchTaskId] = useState<string | null>(null);
  const refreshGeneration = useRef(0);
  const loadedWorkspaceId = useRef<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>(() => {
    try {
      return new URLSearchParams(window.location.search).has("task") ? "tasks" : "home";
    } catch {
      return "home";
    }
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("clocean_sidebar_collapsed") === "true"; } catch { return false; }
  });
  const [activeDocId, setActiveDocId] = useState<string>("doc-manifesto");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      const saved = localStorage.getItem("clocean_theme");
      return saved === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  // Real user authentication session (cached in localStorage or resolved via Edge)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem("clocean_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem("clocean_session_token");
    } catch {
      return null;
    }
  });
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Workspaces / Organizations state
  const [workspaces, setWorkspaces] = useState<UserWorkspaceReference[]>(() => {
    try {
      const saved = localStorage.getItem("clocean_workspaces");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currentWorkspace, setCurrentWorkspace] = useState<UserWorkspaceReference>(() => {
    try {
      const saved = localStorage.getItem("clocean_workspace");
      return saved ? JSON.parse(saved) : { id: "default", name: "Clocean Main", icon: "layers", role: "owner" };
    } catch {
      return { id: "default", name: "Clocean Main", icon: "layers", role: "owner" };
    }
  });
  const [isCreateWsOpen, setIsCreateWsOpen] = useState(false);
  const [isTeamMembersOpen, setIsTeamMembersOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<{ id: string; name: string; icon: string; ownerName: string } | null>(null);
  const [notifications, setNotifications] = useState<MentionNotification[]>([]);
  const [accessRequired, setAccessRequired] = useState(false);

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddSnapOpen, setIsAddSnapOpen] = useState(false);
  const [openSnapsTrigger, setOpenSnapsTrigger] = useState(0);
  const [previewFile, setPreviewFile] = useState<TreeNode | DocAttachment | null>(null);

  // Authenticated headers helper attaching bearer session token & identity
  const getAuthHeaders = (extraHeaders: Record<string, string> = {}): Record<string, string> => {
    const headers: Record<string, string> = { ...extraHeaders };
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }
    if (currentUser?.email) {
      headers["x-user-email"] = currentUser.email;
    }
    return headers;
  };

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

  // On boot: verify session with Cloudflare edge (/api/me)
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const headers = getAuthHeaders();
        const res = await fetch("/api/me", { headers });
        if (res.ok) {
          const data: any = await res.json();
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
            localStorage.setItem("clocean_user", JSON.stringify(data.user));
            if (Array.isArray(data.workspaces) && data.workspaces.length > 0) {
              setWorkspaces(data.workspaces);
              localStorage.setItem("clocean_workspaces", JSON.stringify(data.workspaces));
              const match = data.workspaces.find((w: any) => w.id === currentWorkspace.id) || data.workspaces[0];
              setCurrentWorkspace(match);
              localStorage.setItem("clocean_workspace", JSON.stringify(match));
            }

            // Check if invited to a workspace via ?join=
            const params = new URLSearchParams(window.location.search);
            const joinId = params.get("join") || params.get("invite");
            const targetDoc = params.get("doc");
            if (joinId) {
              const alreadyMember = (data.workspaces || []).find((w: any) => w.id === joinId);
              if (alreadyMember) {
                setCurrentWorkspace(alreadyMember);
                if (targetDoc) handleNavigateDoc(targetDoc);
                window.history.replaceState({}, "", window.location.pathname);
              } else {
                fetch(`/api/workspaces/${joinId}/invite-info`)
                  .then((r) => (r.ok ? (r.json() as Promise<any>) : null))
                  .then((info: any) => {
                    if (info && !info.error) setPendingInvite(info);
                  })
                  .catch(() => {});
              }
            } else if (targetDoc) {
              handleNavigateDoc(targetDoc);
              window.history.replaceState({}, "", window.location.pathname);
            }
          } else {
            setAccessRequired(Boolean(data.accessRequired));
            if (data.accessRequired) {
              setCurrentUser(null);
              setWorkspaces([]);
              localStorage.removeItem("clocean_user");
              localStorage.removeItem("clocean_workspaces");
              localStorage.removeItem("clocean_session_token");
            }
            if (!currentUser) {
              setCurrentUser(null);
              localStorage.removeItem("clocean_user");
            }
          }
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setAuthChecking(false);
      }
    };
    verifyAuth();
  }, []);

  // Load user's workspaces
  const loadWorkspaces = async () => {
    if (!currentUser?.email) return;
    try {
      const res = await fetch(`/api/workspaces?user=${encodeURIComponent(currentUser.email)}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data: UserWorkspaceReference[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setWorkspaces(data);
          localStorage.setItem("clocean_workspaces", JSON.stringify(data));
          const found = data.find((w) => w.id === currentWorkspace.id);
          if (found) {
            setCurrentWorkspace(found);
            localStorage.setItem("clocean_workspace", JSON.stringify(found));
          } else {
            setCurrentWorkspace(data[0]);
            localStorage.setItem("clocean_workspace", JSON.stringify(data[0]));
          }
        }
      }
    } catch (err) {
      console.error("Failed to load workspaces:", err);
    }
  };

  useEffect(() => {
    if (currentUser?.email) {
      loadWorkspaces();
    }
  }, [currentUser?.email]);

  // Load initial data from Worker API (backed by Cloudflare R2 for the active workspace)
  const refreshData = async () => {
    if (!currentUser?.email) return;
    const generation = ++refreshGeneration.current;
    try {
      const headers = getAuthHeaders({
        "x-workspace-id": currentWorkspace.id,
      });
      const read = async <T,>(url: string): Promise<T> => {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error("Could not refresh workspace data. Displayed items may be out of date.");
        return response.json() as Promise<T>;
      };
      const [treeRes, tasksRes, photosRes, actRes, notifRes] = await Promise.all([
        read<{ nodes?: TreeNode[] }>("/api/tree"),
        read<TaskItem[]>("/api/tasks"),
        read<PhotoItem[]>("/api/photos"),
        read<ActivityItem[]>("/api/activity"),
        fetch(`/api/notifications?user=${encodeURIComponent(currentUser.email)}`, { headers })
          .then((r) => (r.ok ? r.json() : []) as Promise<MentionNotification[]>)
          .catch(() => []),
      ]);
      if (generation !== refreshGeneration.current) return;
      setWorkspaceError("");

      if (treeRes?.nodes) {
        setTree(treeRes.nodes);
        const firstDoc = treeRes.nodes.find((n) => n.type === "doc");
        if (firstDoc && (activeDocId === "doc-manifesto" || !treeRes.nodes.some((t) => t.id === activeDocId))) {
          setActiveDocId(firstDoc.id);
        } else if (!firstDoc) setActiveDocId("");
      }
      if (Array.isArray(tasksRes)) setTasks(tasksRes);
      if (Array.isArray(photosRes)) setPhotos(photosRes);
      if (Array.isArray(actRes)) setActivities(actRes);
      if (Array.isArray(notifRes)) setNotifications(notifRes);
    } catch (err) {
      if (generation === refreshGeneration.current) setWorkspaceError(err instanceof Error ? err.message : "Could not load workspace data.");
    }
  };

  const handleMarkNotificationsRead = async () => {
    if (!currentUser?.email) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch(`/api/notifications/read?user=${encodeURIComponent(currentUser.email)}`, {
      method: "PUT",
      headers: getAuthHeaders(),
    }).catch(() => {});
  };

  useEffect(() => {
    if (currentUser?.email && currentWorkspace?.id) {
      if (loadedWorkspaceId.current !== currentWorkspace.id) {
        loadedWorkspaceId.current = currentWorkspace.id;
        setTree([]);
        setActiveDocId("");
        setTasks([]);
        setPhotos([]);
        setActivities([]);
        setNotifications([]);
        setWorkspaceError("");
      }
      refreshData();
    }
  }, [currentUser?.email, currentWorkspace?.id]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleSignOut = () => {
    refreshGeneration.current++;
    loadedWorkspaceId.current = null;
    localStorage.removeItem("clocean_session_token");
    localStorage.removeItem("clocean_user");
    localStorage.removeItem("clocean_workspace");
    localStorage.removeItem("clocean_workspaces");
    setSessionToken(null);
    setCurrentUser(null);
    setWorkspaces([]);
    setTree([]);
    setTasks([]);
    setPhotos([]);
    setActivities([]);
  };

  const handleUploadFile = async (file: File, parentId?: string | null) => {
    if (!currentUser?.email) return;
    const formData = new FormData();
    formData.append("file", file);
    if (parentId) {
      formData.append("parentId", parentId);
    }

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: getAuthHeaders({
        "x-workspace-id": currentWorkspace.id,
      }),
      body: formData,
    });

    if (!res.ok) throw new Error("Upload failed");
    await refreshData();
  };

  const handleMoveNode = async (nodeId: string, parentId: string | null) => {
    if (!currentUser?.email) return;
    let res = await fetch(`/api/tree/node/${encodeURIComponent(nodeId)}`, {
      method: "PUT",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
        "x-workspace-id": currentWorkspace.id,
      }),
      body: JSON.stringify({ parentId }),
    });
    if (res.status === 409) {
      await refreshData();
      res = await fetch(`/api/tree/node/${encodeURIComponent(nodeId)}`, {
        method: "PUT",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
          "x-workspace-id": currentWorkspace.id,
        }),
        body: JSON.stringify({ parentId }),
      });
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || "Failed to move item");
    }
    const updated = (await res.json()) as TreeNode;
    setTree((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    await refreshData();
  };

  const handleAddSnapToDoc = async (docId: string, attachment: DocAttachment) => {
    try {
      const headers = getAuthHeaders({ "x-workspace-id": currentWorkspace.id });
      const docRes = await fetch(`/api/docs/${encodeURIComponent(docId)}`, { headers });
      let docData: any = {};
      if (docRes.ok) {
        docData = await docRes.json();
      }
      const currentAtts = docData.attachments || [];
      const updatedAtts = [...currentAtts, attachment];

      await fetch(`/api/docs/${encodeURIComponent(docId)}`, {
        method: "PUT",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
          "x-workspace-id": currentWorkspace.id,
        }),
        body: JSON.stringify({
          ...docData,
          attachments: updatedAtts,
        }),
      });

      setActiveDocId(docId);
      setCurrentView("notes");
      setOpenSnapsTrigger((prev) => prev + 1);
      await refreshData();
    } catch (err) {
      console.error("Failed to add snap:", err);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!currentUser?.email) return;
    const response = await fetch(`/api/tree/node/${fileId}`, {
      method: "DELETE",
      headers: getAuthHeaders({
        "x-workspace-id": currentWorkspace.id,
      }),
    });
    if (!response.ok) throw new Error("Could not move item to Trash. Please try again.");
    await refreshData();
  };

  const handleDeleteDoc = async (nodeId: string) => {
    if (!currentUser?.email) return;
      const res = await fetch(`/api/tree/node/${encodeURIComponent(nodeId)}`, {
        method: "DELETE",
        headers: getAuthHeaders({
          "x-workspace-id": currentWorkspace.id,
        }),
      });
      if (!res.ok) throw new Error("Could not move page to Trash. Please try again.");
      if (activeDocId === nodeId) setActiveDocId("");
        await refreshData();
  };

  const handleUpdateTasks = async (newTasks: TaskItem[], boardId = "default") => {
    if (!currentUser?.email) return;
    const previousTasks = tasks;
    setTasks(newTasks);
    const res = await fetch(`/api/tasks?boardId=${encodeURIComponent(boardId)}`, {
      method: "PUT",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
        "x-workspace-id": currentWorkspace.id,
      }),
      body: JSON.stringify(newTasks),
    });
    if (!res.ok) {
      setTasks(previousTasks);
      const data = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error || "Failed to save tasks");
    }
  };

  const handleLoadTasks = useCallback((loadedTasks: TaskItem[]) => {
    setTasks(loadedTasks);
  }, []);

  const handleNavigateDoc = (docId: string) => {
    setActiveDocId(docId);
    setCurrentView("notes");
  };

  const handleCreateTreeNode = async (type: "doc" | "folder", parentId: string | null, name: string) => {
    const res = await fetch("/api/tree/node", {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json", "x-workspace-id": currentWorkspace.id }),
      body: JSON.stringify({ type, parentId, name }),
    });
    if (!res.ok) throw new Error("Could not create item. Please try again.");
    const node = await res.json() as TreeNode;
    setTree((current) => [node, ...current]);
    return node;
  };

  const handleMoveTreeNode = async (nodeId: string, parentId: string | null) => {
    let res = await fetch(`/api/tree/node/${encodeURIComponent(nodeId)}`, {
      method: "PUT",
      headers: getAuthHeaders({ "Content-Type": "application/json", "x-workspace-id": currentWorkspace.id }),
      body: JSON.stringify({ parentId }),
    });
    if (res.status === 409) {
      await refreshData();
      res = await fetch(`/api/tree/node/${encodeURIComponent(nodeId)}`, {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json", "x-workspace-id": currentWorkspace.id }),
        body: JSON.stringify({ parentId }),
      });
    }
    if (!res.ok) return null;
    const moved = await res.json() as TreeNode;
    setTree((current) => current.map((node) => node.id === moved.id ? moved : node));
    await refreshData();
    return moved;
  };

  const handleAcceptInvite = async () => {
    if (!pendingInvite) return;
    try {
      const res = await fetch(`/api/workspaces/${pendingInvite.id}/join`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.workspaces) {
          setWorkspaces(data.workspaces);
          localStorage.setItem("clocean_workspaces", JSON.stringify(data.workspaces));
        }
        if (data.workspace) {
          setCurrentWorkspace(data.workspace);
          localStorage.setItem("clocean_workspace", JSON.stringify(data.workspace));
        }
        setPendingInvite(null);
        const params = new URLSearchParams(window.location.search);
        const targetDoc = params.get("doc");
        if (targetDoc) {
          handleNavigateDoc(targetDoc);
        }
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch (err) {
      console.error("Failed to join workspace:", err);
    }
  };

  // Breadcrumbs determination
  const getBreadcrumbs = () => {
    if (currentView === "notes") {
      const activeDoc = tree.find((t) => t.id === activeDocId);
      return [
        { label: "Docs", onClick: () => setCurrentView("notes") },
        { label: activeDoc ? activeDoc.name : "Document" },
      ];
    }
    if (currentView === "tasks") {
      return [
        { label: "Tasks", onClick: () => setCurrentView("tasks") },
        { label: "Sprint Board" },
      ];
    }
    if (currentView === "documents") {
      return [{ label: "Files", onClick: () => setCurrentView("documents") }];
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
            <Layers size={18} color="var(--accent)" />
            <span style={{ color: "var(--text-primary)", fontSize: "15px" }}>Clocean Public Web</span>
          </div>
          <button
            onClick={handleToggleTheme}
            className="btn-icon"
            style={{ width: "32px", height: "32px", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
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
              <div style={{ marginBottom: "12px" }}>
                <FileText size={32} color="var(--accent)" />
              </div>
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

  if (authChecking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100vw",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-secondary)",
        }}
      >
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            backgroundColor: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
          }}
        >
          <Layers size={22} />
        </div>
        <p style={{ fontSize: "14px", fontWeight: 500 }}>Connecting to Clocean edge...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthGate
        onAuthenticated={(user, workspace, token) => {
          setCurrentUser(user);
          setCurrentWorkspace(workspace);
          setWorkspaces([workspace]);
          if (token) {
            setSessionToken(token);
            localStorage.setItem("clocean_session_token", token);
          }
          localStorage.setItem("clocean_user", JSON.stringify(user));
          localStorage.setItem("clocean_workspace", JSON.stringify(workspace));
          localStorage.setItem("clocean_workspaces", JSON.stringify([workspace]));
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        accessRequired={accessRequired}
      />
    );
  }

  const toggleSidebar = () => {
    setIsSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try { localStorage.setItem("clocean_sidebar_collapsed", String(next)); } catch { /* best effort */ }
      return next;
    });
  };

  return (
    <div className="clocean-shell" style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      {isSidebarCollapsed && !mobileNavOpen ? (
        <button className="desktop-sidebar-toggle" onClick={toggleSidebar} title="Show navigation sidebar" aria-label="Show navigation sidebar">
          <PanelLeftOpen size={18} />
        </button>
      ) : (
        <Sidebar
          className={`clocean-sidebar${mobileNavOpen ? " mobile-open" : ""}`}
          currentView={currentView}
          onSelectView={(v) => { setCurrentView(v); setMobileNavOpen(false); }}
          currentUser={currentUser}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
          onSelectWorkspace={(ws) => { setCurrentWorkspace(ws); setMobileNavOpen(false); }}
          onOpenCreateWorkspace={() => setIsCreateWsOpen(true)}
          onOpenTeamMembers={() => setIsTeamMembersOpen(true)}
          tree={tree}
          activeDocId={activeDocId}
          onSelectDoc={(id) => { handleNavigateDoc(id); setMobileNavOpen(false); }}
          onCreateDoc={async () => {
            const newDoc = await handleCreateTreeNode("doc", null, "Untitled page");
            if (newDoc) {
              handleNavigateDoc(newDoc.id);
            }
          }}
          onAddSnap={() => {
            setIsAddSnapOpen(true);
          }}
          onSignOut={handleSignOut}
          sessionToken={sessionToken}
          onDeleteDoc={handleDeleteDoc}
        />
      )}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <button aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}><Layers size={18} /><span>{mobileNavOpen ? "Close" : "Workspace"}</span></button>
        <button className={currentView === "home" ? "active" : ""} onClick={() => setCurrentView("home")}><Home size={18} /><span>Home</span></button>
        <button className={currentView === "tasks" ? "active" : ""} onClick={() => setCurrentView("tasks")}><ListCheck size={18} /><span>Tasks</span></button>
        <button className={currentView === "notes" ? "active" : ""} onClick={() => setCurrentView("notes")}><FileText size={18} /><span>Docs</span></button>
        <button className={currentView === "documents" ? "active" : ""} onClick={() => setCurrentView("documents")}><Folder size={18} /><span>Files</span></button>
      </nav>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflowY: "auto",
          backgroundColor: "var(--bg-primary)",
          overflowX: "hidden",
        }}
      >
        {/* Top Header */}
        <Header
          breadcrumbs={getBreadcrumbs()}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenTeamMembers={() => setIsTeamMembersOpen(true)}
          notifications={notifications}
          onSelectDoc={(docId) => handleNavigateDoc(docId)}
          onMarkNotificationsRead={handleMarkNotificationsRead}
          sidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => window.matchMedia("(max-width: 720px)").matches ? setMobileNavOpen((open) => !open) : toggleSidebar()}
        />
        {workspaceError && <div role="alert" className="workspace-error">{workspaceError} <button className="btn-secondary" onClick={() => void refreshData()}>Retry</button></div>}

        {/* View Routing */}
        <main style={{ flex: 1 }}>
          {currentView === "home" && (
            <DashboardView
              currentUser={currentUser}
              activities={activities}
              tasks={tasks}
              tree={tree}
              photos={photos}
              onNavigateDoc={handleNavigateDoc}
              onNavigateView={(v) => setCurrentView(v)}
            />
          )}

          {currentView === "notes" && (
            <NotesView
              tree={tree}
              activeDocId={activeDocId}
              currentUser={currentUser}
              workspaceId={currentWorkspace.id}
              sessionToken={sessionToken}
              onSelectDoc={handleNavigateDoc}
              onCreateNode={handleCreateTreeNode}
              onMoveNode={handleMoveTreeNode}
              onOpenFilePreview={(att) => setPreviewFile(att)}
              openSnapsTrigger={openSnapsTrigger}
              onDeleteNode={handleDeleteDoc}
            />
          )}

          {currentView === "documents" && (
            <DocumentsView
              files={tree}
              onUploadFile={handleUploadFile}
              onDeleteFile={handleDeleteFile}
              onPreviewFile={(f) => setPreviewFile(f)}
              onCreateFolder={(name, parentId) => handleCreateTreeNode("folder", parentId || null, name)}
              onMoveNode={handleMoveNode}
            />
          )}

          {currentView === "tasks" && (
            <TasksView
              key={`${currentWorkspace.id}:${searchTaskId || "board"}`}
              tasks={tasks}
              currentUser={currentUser}
              workspaceId={currentWorkspace.id}
              onUpdateTasks={handleUpdateTasks}
              onLoadTasks={handleLoadTasks}
              sessionToken={sessionToken}
            />
          )}






          {currentView === "databases" && <DatabasesView key={currentWorkspace.id} workspaceId={currentWorkspace.id} currentUser={currentUser} getAuthHeaders={getAuthHeaders} />}
          {(currentView === "templates" || currentView === "import" || currentView === "trash") && <WorkspaceToolsView key={`${currentWorkspace.id}:${currentView}`} mode={currentView} workspaceId={currentWorkspace.id} headers={getAuthHeaders} onRefresh={refreshData} onOpenDoc={handleNavigateDoc} />}
        </main>
      </div>

      {/* Global Modals */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        files={tree}
        tasks={tasks}
        onSelectFile={(file) => setPreviewFile(file)}
        onSelectTask={(task) => { const url = new URL(window.location.href); url.searchParams.set("task", task.id); window.history.replaceState({}, "", url); setSearchTaskId(task.id); setCurrentView("tasks"); }}
        onSelectDoc={handleNavigateDoc}
        onSelectView={(v) => setCurrentView(v)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        sessionToken={sessionToken}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onUpdateProfile={(profile) => {
          setCurrentUser(profile);
          localStorage.setItem("clocean_user", JSON.stringify(profile));
        }}
        onSignOut={handleSignOut}
        onDeleteAccount={handleSignOut}
      />

      <CreateWorkspaceModal
        isOpen={isCreateWsOpen}
        onClose={() => setIsCreateWsOpen(false)}
        onCreated={(newWs) => {
          setWorkspaces((prev) => [...prev, newWs]);
          setCurrentWorkspace(newWs);
          setCurrentView("home");
        }}
        currentUser={currentUser}
        sessionToken={sessionToken}
      />

      <TeamMembersModal
        isOpen={isTeamMembersOpen}
        onClose={() => setIsTeamMembersOpen(false)}
        workspace={currentWorkspace}
        currentUser={currentUser}
        sessionToken={sessionToken}
      />

      <FilePreviewModal file={previewFile} sessionToken={sessionToken} userEmail={currentUser?.email} workspaceId={currentWorkspace.id} onClose={() => setPreviewFile(null)} />

      {/* Pending Workspace Invite Banner for Authenticated User */}
      {pendingInvite && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 1000,
            maxWidth: "380px",
            backgroundColor: "var(--bg-surface)",
            border: "1.5px solid var(--accent)",
            borderRadius: "var(--radius-lg)",
            padding: "18px 20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          }}
          className="animate-fade-in"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: "var(--bg-nav-active)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                Join {pendingInvite.name}?
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Invited by {pendingInvite.ownerName}
              </div>
            </div>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 14px 0", lineHeight: 1.4 }}>
            You're currently signed in as <strong>{currentUser.email}</strong>. Would you like to accept this invitation?
          </p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                setPendingInvite(null);
                window.history.replaceState({}, "", window.location.pathname);
              }}
              className="btn-secondary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              Decline
            </button>
            <button
              onClick={handleAcceptInvite}
              className="btn-primary"
              style={{ padding: "6px 16px", fontSize: "12px" }}
            >
              Join Workspace
            </button>
          </div>
        </div>
      )}
      {/* Add Snap Modal */}
      <AddSnapModal
        isOpen={isAddSnapOpen}
        onClose={() => setIsAddSnapOpen(false)}
        activeDocId={activeDocId}
        docs={tree}
        onAddSnapToDoc={handleAddSnapToDoc}
        workspaceId={currentWorkspace.id}
        sessionToken={sessionToken}
      />
    </div>
  );
};
