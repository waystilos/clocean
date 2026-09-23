import React, { useState, useRef, useEffect } from "react";
import { Search, Settings, Cloud, RefreshCw, Bell, Mail, CheckCheck, UserPlus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { MentionNotification } from "../types.ts";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: { label: string; onClick?: () => void }[];
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenTeamMembers?: () => void;
  collaborators?: { id: string; name: string; avatar: string; color: string }[];
  isSaving?: boolean;
  notifications?: MentionNotification[];
  onSelectDoc?: (docId: string) => void;
  onMarkNotificationsRead?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  onOpenSearch,
  onOpenSettings,
  onOpenTeamMembers,
  collaborators = [],
  isSaving,
  notifications = [],
  onSelectDoc,
  onMarkNotificationsRead,
  sidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Click outside to close notifications dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNotifOpen]);

  return (
    <header
      style={{
        height: "64px",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--border-subtle)",
        backgroundColor: "var(--bg-primary)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Left: Breadcrumbs or Title */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {onToggleSidebar && <button className="btn-icon" onClick={onToggleSidebar} title={sidebarCollapsed ? "Show navigation sidebar" : "Hide navigation sidebar"} aria-label={sidebarCollapsed ? "Show navigation sidebar" : "Hide navigation sidebar"}>
          {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>}
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: "var(--text-muted)" }}>/</span>}
                <span
                  onClick={b.onClick}
                  style={{
                    color: i === breadcrumbs.length - 1 ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: i === breadcrumbs.length - 1 ? 500 : 400,
                    cursor: b.onClick ? "pointer" : "default",
                  }}
                >
                  {b.label}
                </span>
              </React.Fragment>
            ))}
          </nav>
        ) : (
          <div>
            {title && (
              <h1
                className="font-serif"
                style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right: Collaborators, Sync Status, Notifications, Search & Settings */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* R2 Sync Indicator */}
        {isSaving !== undefined && <div
          title={isSaving ? "Saving changes" : "Changes saved"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: isSaving ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          {isSaving ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Cloud size={14} />
          )}
          <span style={{ fontSize: "11px" }}>{isSaving ? "Saving…" : "Saved"}</span>
        </div>}

        {/* Live Multiplayer Collaborator Avatars */}
        {collaborators.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", marginRight: "4px" }}>
            {collaborators.map((c, idx) => (
              <div
                key={c.id || idx}
                title={`${c.name} is currently editing`}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  border: `2px solid ${c.color || "var(--accent)"}`,
                  overflow: "hidden",
                  marginLeft: idx === 0 ? 0 : "-8px",
                  zIndex: collaborators.length - idx,
                  backgroundColor: "var(--bg-card)",
                }}
              >
                <img
                  src={c.avatar}
                  alt={c.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Email & Mention Notifications Bell */}
        <div style={{ position: "relative" }} ref={notifDropdownRef}>
          <button
            onClick={() => setIsNotifOpen((prev) => !prev)}
            className="btn-icon"
            style={{ position: "relative" }}
            title="Notifications & @mentions"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "4px",
                  right: "4px",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "var(--accent)",
                  boxShadow: "0 0 0 2px var(--bg-primary)",
                }}
              />
            )}
          </button>

          {/* Notifications Dropdown */}
          {isNotifOpen && (
            <div
              className="animate-fade-in"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: "340px",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 12px 30px rgba(0, 0, 0, 0.35)",
                zIndex: 100,
                overflow: "hidden",
              }}
            >
              {/* Dropdown Header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Bell size={14} style={{ color: "var(--accent)" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        fontSize: "10px",
                        backgroundColor: "var(--accent)",
                        color: "#FFFFFF",
                        padding: "1px 6px",
                        borderRadius: "10px",
                        fontWeight: 600,
                      }}
                    >
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {unreadCount > 0 && onMarkNotificationsRead && (
                  <button
                    onClick={onMarkNotificationsRead}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      fontSize: "11px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <CheckCheck size={12} /> Mark read
                  </button>
                )}
              </div>

              {/* Notification Items */}
              <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                {notifications.length === 0 ? (
                  <div
                    style={{
                      padding: "24px 16px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: "12px",
                      lineHeight: 1.5,
                    }}
                  >
                    No notifications yet.
                    <br />
                    When a teammate @mentions you, you'll receive an email notification.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setIsNotifOpen(false);
                        if (n.documentId) {
                          onSelectDoc?.(n.documentId);
                        }
                      }}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        backgroundColor: n.read ? "transparent" : "var(--bg-nav-active)",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <img
                          src={n.sender.avatar}
                          alt={n.sender.name}
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "1px solid var(--border-subtle)",
                            flexShrink: 0,
                            marginTop: "2px",
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.4 }}>
                            <strong>{n.sender.name}</strong>{" "}
                            {n.type === "invite" ? (
                              <span>invited you to join</span>
                            ) : n.type === "task" ? (
                              <span>mentioned you in task</span>
                            ) : n.type === "test" ? (
                              <span>sent you a test notification in</span>
                            ) : (
                              <span>mentioned you in</span>
                            )}{" "}
                            <span style={{ color: "var(--accent)", fontWeight: 500 }}>
                              {n.taskTitle || n.documentTitle || n.workspaceName}
                            </span>
                          </div>
                          {n.contextSnippet && (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "var(--text-secondary)",
                                margin: "4px 0",
                                fontStyle: "italic",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              "{n.contextSnippet}"
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginTop: "4px",
                              fontSize: "10px",
                              color: "var(--text-muted)",
                            }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: "3px", color: "var(--accent)" }}>
                              <Mail size={10} /> Email dispatched
                            </span>
                            <span>•</span>
                            <span>{n.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Invite Action Button */}
        {onOpenTeamMembers && (
          <button
            onClick={onOpenTeamMembers}
            className="btn-secondary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "var(--radius-sm)",
            }}
            title="Invite members to workspace"
          >
            <UserPlus size={14} />
            <span>Invite</span>
          </button>
        )}

        {/* Search Action */}
        <button
          onClick={onOpenSearch}
          className="btn-icon"
          title="Search workspace (Ctrl+K or ⌘K)"
        >
          <Search size={18} />
        </button>

        {/* Settings Action */}
        <button
          onClick={onOpenSettings}
          className="btn-icon"
          title="Workspace Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
