import React, { useState, useRef, useEffect } from "react";
import {
  Home,
  ListCheck,
  FileText,
  Folder,
  Layout,
  Layers,
  Download,
  Trash2,
  Sun,
  Moon,
  Users,
  ChevronsUpDown,
  Plus,
  Check,
  UserPlus,
  Star,
  LogOut,
  Table2,
  Image as ImageIcon,
  Bug,
} from "lucide-react";
import { ViewMode, UserProfile, UserWorkspaceReference, TreeNode } from "../types.ts";

interface SidebarProps {
  className?: string;
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  currentUser: UserProfile;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  workspaces?: UserWorkspaceReference[];
  currentWorkspace?: UserWorkspaceReference;
  onSelectWorkspace?: (workspace: UserWorkspaceReference) => void;
  onOpenCreateWorkspace?: () => void;
  onOpenTeamMembers?: () => void;
  tree?: TreeNode[];
  activeDocId?: string;
  onSelectDoc?: (docId: string) => void;
  onCreateDoc?: () => void;
  onAddSnap?: () => void;
  onSignOut?: () => void;
  sessionToken?: string | null;
  onDeleteDoc?: (docId: string) => Promise<void> | void;
}

const getDocEmoji = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes("task") || lower.includes("todo")) return "👩";
  if (lower.includes("deadline") || lower.includes("time") || lower.includes("schedule")) return "⏱";
  if (lower.includes("music") || lower.includes("audio")) return "🎵";
  if (lower.includes("question") || lower.includes("faq") || lower.includes("help")) return "❓";
  if (lower.includes("dev") || lower.includes("code") || lower.includes("eng")) return "💻";
  if (lower.includes("swift") || lower.includes("mobile") || lower.includes("ios") || lower.includes("app")) return "📱";
  if (lower.includes("acme") || lower.includes("target") || lower.includes("goal")) return "🎯";
  if (lower.includes("note") || lower.includes("quick")) return "📝";
  if (lower.includes("spec") || lower.includes("prd")) return "📄";
  if (lower.includes("design") || lower.includes("brand")) return "🎨";
  return "📄";
};

export const Sidebar: React.FC<SidebarProps> = ({
  className,
  currentView,
  onSelectView,
  currentUser,
  theme,
  onToggleTheme,
  workspaces = [],
  currentWorkspace = { id: "default", name: "Clocean Main", icon: "layers", role: "owner" },
  onSelectWorkspace,
  onOpenCreateWorkspace,
  onOpenTeamMembers,
  tree = [],
  activeDocId,
  onSelectDoc,
  onCreateDoc,
  onAddSnap,
  onSignOut,
  sessionToken,
  onDeleteDoc,
}) => {
  const [isWsDropdownOpen, setIsWsDropdownOpen] = useState(false);
  const [favoriteDocIds, setFavoriteDocIds] = useState<string[]>([]);
  const [pageToDelete, setPageToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const workspaceDocs = tree.filter((n) => n.type === "doc");

  // Load favorites for current workspace
  useEffect(() => {
    if (!currentWorkspace?.id) return;
    fetch(`/api/workspaces/${currentWorkspace.id}/favorites`, {
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((favs: any) => {
        if (Array.isArray(favs)) {
          setFavoriteDocIds(favs);
        }
      })
      .catch(() => {});
  }, [currentWorkspace?.id]);

  const favoriteDocs = tree.filter((n) => n.type === "doc" && favoriteDocIds.includes(n.id));

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsWsDropdownOpen(false);
      }
    };
    if (isWsDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isWsDropdownOpen]);

  const navItems: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <Home size={18} /> },
    { id: "tasks", label: "Tasks", icon: <ListCheck size={18} /> },
    { id: "notes", label: "Docs", icon: <FileText size={18} /> },
    { id: "documents", label: "Files", icon: <Folder size={18} /> },
    { id: "databases", label: "Databases", icon: <Table2 size={18} /> },
  ];

  const secondaryNavItems: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: "templates", label: "Templates", icon: <Layout size={18} /> },
    { id: "import", label: "Import", icon: <Download size={18} /> },
    { id: "trash", label: "Trash", icon: <Trash2 size={18} /> },
  ];

  return (
    <aside
      className={className}
      style={{
        width: "var(--sidebar-width)",
        minWidth: "var(--sidebar-width)",
        height: "100vh",
        backgroundColor: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "20px 16px",
        userSelect: "none",
        position: "relative",
      }}
    >
      {/* Top Section */}
      <div>
        {/* Workspace Switcher */}
        <div style={{ position: "relative", marginBottom: "16px" }} ref={dropdownRef}>
          <button
            onClick={() => setIsWsDropdownOpen((prev) => !prev)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              border: "1px solid transparent",
              background: isWsDropdownOpen ? "var(--bg-nav-active)" : "transparent",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            className="workspace-switcher-btn"
            title={`Active organization: ${currentWorkspace.name} (${currentWorkspace.role})`}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Layers size={15} color="var(--accent)" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", textAlign: "left", minWidth: 0 }}>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {currentWorkspace.name}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    textTransform: "capitalize",
                  }}
                >
                  {currentWorkspace.role}
                </span>
              </div>
            </div>
            <ChevronsUpDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          </button>

          {/* Workspace Dropdown Menu */}
          {isWsDropdownOpen && (
            <div
              className="animate-fade-in"
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)",
                zIndex: 100,
                padding: "6px",
                minWidth: "220px",
              }}
            >
              <div
                style={{
                  padding: "6px 8px 8px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Switch Workspace
              </div>

              {/* Workspace List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "200px", overflowY: "auto" }}>
                {workspaces.map((ws) => {
                  const isSelected = ws.id === currentWorkspace.id;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => {
                        onSelectWorkspace?.(ws);
                        setIsWsDropdownOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        background: isSelected ? "var(--bg-nav-active)" : "transparent",
                        cursor: "pointer",
                        width: "100%",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <Layers size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: isSelected ? 600 : 400,
                              color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {ws.name}
                          </span>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "capitalize" }}>
                            {ws.role}
                          </span>
                        </div>
                      </div>
                      {isSelected && <Check size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              <div style={{ height: "1px", backgroundColor: "var(--border-subtle)", margin: "6px 0" }} />

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {(currentWorkspace.role === "owner" || currentWorkspace.role === "admin") && (
                  <button
                    onClick={() => {
                      setIsWsDropdownOpen(false);
                      onOpenTeamMembers?.();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 8px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: "transparent",
                      color: "var(--accent)",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: "pointer",
                      width: "100%",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-light)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <UserPlus size={14} />
                    <span>Invite Teammates</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsWsDropdownOpen(false);
                    onOpenTeamMembers?.();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  <Users size={14} />
                  <span>Team Roster</span>
                </button>

                <button
                  onClick={() => {
                    setIsWsDropdownOpen(false);
                    onOpenCreateWorkspace?.();
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "2px",
                    padding: "6px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "transparent",
                    color: "var(--accent)",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-light)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Plus size={14} />
                    <span>Create Workspace</span>
                  </div>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "22px" }}>
                    New organization / team account
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Primary Views Section (Home, Tasks, Docs, Files) */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "16px" }}>
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  width: "100%",
                  padding: "7px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: isActive ? "var(--bg-nav-active)" : "transparent",
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    color: isActive ? "var(--accent)" : "inherit",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div style={{ height: "1px", backgroundColor: "var(--border-subtle)", margin: "8px 8px 14px 8px" }} />

        {/* Favorites Section */}
        {favoriteDocs.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                padding: "0 10px 6px 10px",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Star size={11} fill="#F59E0B" color="#F59E0B" /> Favorites
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {favoriteDocs.map((fDoc) => (
                <button
                  key={fDoc.id}
                  onClick={() => {
                    onSelectDoc?.(fDoc.id);
                    onSelectView("notes");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-nav-active)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <span style={{ fontSize: "14px", lineHeight: 1 }}>{getDocEmoji(fDoc.name)}</span>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {fDoc.name}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ height: "1px", backgroundColor: "var(--border-subtle)", margin: "14px 8px" }} />
          </div>
        )}

        {/* Workspace Section */}
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              padding: "0 10px 8px 10px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span title="Collaborative pages and documents in this workspace">Workspace Pages</span>
            <button
              onClick={() => {
                if (onCreateDoc) {
                  onCreateDoc();
                } else {
                  onSelectView("notes");
                }
              }}
              title="Create page"
              aria-label="Create page"
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.borderColor = "var(--border-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
              }}
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Document list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "240px", overflowY: "auto" }}>
            {workspaceDocs.map((doc) => {
              const isDocActive = currentView === "notes" && activeDocId === doc.id;
              return (
                <div
                  key={doc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    borderRadius: "var(--radius-sm)",
                    background: isDocActive ? "var(--bg-nav-active)" : "transparent",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDocActive) e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)";
                    const btn = e.currentTarget.querySelector(".sidebar-delete-doc-btn") as HTMLElement;
                    if (btn) btn.style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                    if (!isDocActive) e.currentTarget.style.backgroundColor = "transparent";
                    const btn = e.currentTarget.querySelector(".sidebar-delete-doc-btn") as HTMLElement;
                    if (btn) btn.style.opacity = "0";
                  }}
                >
                  <button
                    onClick={() => {
                      onSelectDoc?.(doc.id);
                      onSelectView("notes");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "9px",
                      flex: 1,
                      minWidth: 0,
                      padding: "6px 8px 6px 10px",
                      border: "none",
                      background: "transparent",
                      color: isDocActive ? "var(--text-primary)" : "var(--text-secondary)",
                      fontSize: "13px",
                      fontWeight: isDocActive ? 600 : 400,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: "14px", lineHeight: 1, flexShrink: 0 }}>
                      {getDocEmoji(doc.name)}
                    </span>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {doc.name}
                    </span>
                  </button>

                  {onDeleteDoc && (
                    <button
                      className="sidebar-delete-doc-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPageToDelete({ id: doc.id, name: doc.name });
                      }}
                      title={`Delete page "${doc.name}"`}
                      aria-label={`Delete page "${doc.name}"`}
                      style={{
                        opacity: 0,
                        transition: "opacity 0.15s ease, color 0.15s ease",
                        width: "20px",
                        height: "20px",
                        marginRight: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        background: "transparent",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--danger, #ef4444)";
                        e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.12)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-muted)";
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            height: "1px",
            backgroundColor: "var(--border-subtle)",
            margin: "12px 8px",
          }}
        />

        {/* Quick Actions */}
        <div>
          <div
            style={{
              padding: "0 10px 8px 10px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Quick actions
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {secondaryNavItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectView(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: "7px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: isActive ? "var(--bg-nav-active)" : "transparent",
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    fontSize: "13px",
                    fontWeight: isActive ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      color: isActive ? "var(--accent)" : "inherit",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

      </div>

      {/* Bottom User Profile Section */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <a
          href="https://github.com/waystilos/clocean/issues/new/choose"
          target="_blank"
          rel="noopener noreferrer"
          className="sidebar-report-link"
        >
          <Bug size={16} aria-hidden="true" /> Report a bug
        </a>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              overflow: "hidden",
            }}
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid var(--border-subtle)",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {currentUser.name}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {currentUser.email}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {/* Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              className="btn-icon"
              title={`Switch to ${theme === "dark" ? "Light (Parchment)" : "Dark (Obsidian)"} mode`}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Sign Out Button */}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="btn-icon"
                title="Sign Out"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Page Delete Confirmation Modal */}
      {pageToDelete && (
        <div
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
          onClick={() => !isDeletingPage && setPageToDelete(null)}
        >
          <div
            className="animate-fade-in"
            style={{
              width: "100%",
              maxWidth: "400px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--danger, #ef4444)",
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3
                    className="font-serif"
                    style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}
                  >
                    Delete Page
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
                    Move to Trash
                  </p>
                </div>
              </div>

              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "20px" }}>
                Move <strong style={{ color: "var(--text-primary)" }}>{pageToDelete.name}</strong> to Trash? You can restore it later.
              </p>
              {deleteError && <p role="alert" className="feedback-error">{deleteError}</p>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setPageToDelete(null)}
                  disabled={isDeletingPage}
                  className="btn-secondary"
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!onDeleteDoc) return;
                    setDeleteError("");
                    setIsDeletingPage(true);
                    try {
                      await onDeleteDoc(pageToDelete.id);
                      setPageToDelete(null);
                    } catch (err) {
                      setDeleteError(err instanceof Error ? err.message : "Could not move page to Trash.");
                    } finally {
                      setIsDeletingPage(false);
                    }
                  }}
                  disabled={isDeletingPage}
                  style={{
                    padding: "8px 18px",
                    fontSize: "13px",
                    fontWeight: 500,
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--danger, #ef4444)",
                    color: "#ffffff",
                    border: "none",
                    cursor: isDeletingPage ? "not-allowed" : "pointer",
                    opacity: isDeletingPage ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Trash2 size={14} />
                  <span>{isDeletingPage ? "Moving..." : "Move to Trash"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
