import React from "react";
import { Search, Settings, Cloud, RefreshCw } from "lucide-react";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: { label: string; onClick?: () => void }[];
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  collaborators?: { id: string; name: string; avatar: string; color: string }[];
  isSaving?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  onOpenSearch,
  onOpenSettings,
  collaborators = [],
  isSaving = false,
}) => {
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
                style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{subtitle}</p>
            )}
          </div>
        )}
      </div>

      {/* Right: Collaborators, Sync Status, Search & Settings */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* R2 Sync Indicator */}
        <div
          title="Synced to Cloudflare R2"
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
          <span style={{ fontSize: "11px" }}>{isSaving ? "Saving..." : "R2 Synced"}</span>
        </div>

        {/* Live Multiplayer Collaborator Avatars */}
        {collaborators.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", marginRight: "8px" }}>
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
