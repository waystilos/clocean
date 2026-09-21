import React from "react";
import {
  Home,
  ListCheck,
  FileText,
  Folder,
  Image as ImageIcon,
  Layout,
  Download,
  Trash2,
  Sun,
  Moon,
  Users,
} from "lucide-react";
import { ViewMode, UserProfile } from "../types.ts";

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  currentUser: UserProfile;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onSwitchUser: (email: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  currentUser,
  theme,
  onToggleTheme,
  onSwitchUser,
}) => {
  const navItems: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <Home size={18} /> },
    { id: "tasks", label: "Tasks", icon: <ListCheck size={18} /> },
    { id: "notes", label: "Notes", icon: <FileText size={18} /> },
    { id: "documents", label: "Documents", icon: <Folder size={18} /> },
    { id: "photos", label: "Photos", icon: <ImageIcon size={18} /> },
  ];

  const secondaryNavItems: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: "templates", label: "Templates", icon: <Layout size={18} /> },
    { id: "import", label: "Import", icon: <Download size={18} /> },
    { id: "trash", label: "Trash", icon: <Trash2 size={18} /> },
  ];

  return (
    <aside
      style={{
        width: "var(--sidebar-width)",
        minWidth: "var(--sidebar-width)",
        height: "100vh",
        backgroundColor: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "24px 16px",
        userSelect: "none",
      }}
    >
      {/* Top Section */}
      <div>
        {/* Brand */}
        <div
          onClick={() => onSelectView("home")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "0 8px 24px 8px",
            cursor: "pointer",
          }}
        >
          <span
            className="font-serif"
            style={{
              fontSize: "22px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            clocean
          </span>
        </div>

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

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="btn-icon"
            title={`Switch to ${theme === "dark" ? "Light (Parchment)" : "Dark (Obsidian)"} mode`}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {/* Multiplayer Persona Switcher (For local testing) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "var(--text-muted)",
            padding: "4px 6px",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Users size={12} /> Test User:
          </span>
          <select
            value={currentUser.email}
            onChange={(e) => onSwitchUser(e.target.value)}
            style={{
              background: "transparent",
              color: "var(--text-primary)",
              border: "none",
              fontSize: "11px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="alex@clocean.co">Alex (Default)</option>
            <option value="marcus@clocean.co">Marcus</option>
            <option value="elena@clocean.co">Elena</option>
            <option value="sofia@clocean.co">Sofia</option>
          </select>
        </div>
      </div>
    </aside>
  );
};
