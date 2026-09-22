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
  onSelectDoc?: (docId: string) => void;
  onSignOut?: () => void;
  sessionToken?: string | null;
}

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
  onSelectDoc,
  onSignOut,
  sessionToken,
}) => {
  const [isWsDropdownOpen, setIsWsDropdownOpen] = useState(false);
  const [favoriteDocIds, setFavoriteDocIds] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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
    { id: "notes", label: "Notes", icon: <FileText size={18} /> },
    { id: "documents", label: "Documents", icon: <Folder size={18} /> },
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
                Workspaces
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
                >
                  <Plus size={14} />
                  <span>Create Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>

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
                  onClick={() => onSelectDoc?.(fDoc.id)}
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
                  <FileText size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {fDoc.name}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ height: "1px", backgroundColor: "var(--border-subtle)", margin: "14px 8px" }} />
          </div>
        )}

        {/* Primary Navigation */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
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
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: isActive ? "var(--bg-nav-active)" : "transparent",
                  color: isActive
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                  fontSize: "14px",
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
        <div
          style={{
            height: "1px",
            backgroundColor: "var(--border-subtle)",
            margin: "18px 8px",
          }}
        />

        {/* Secondary Navigation */}
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
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: isActive ? "var(--bg-nav-active)" : "transparent",
                  color: isActive
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                  fontSize: "14px",
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
    </aside>
  );
};
