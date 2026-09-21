import React, { useState } from "react";
import { X, User, Shield, HardDrive, Palette, Check } from "lucide-react";
import { UserProfile } from "../types.ts";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  theme,
  onToggleTheme,
  onUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<"profile" | "storage" | "access" | "appearance">(
    "profile"
  );
  const [name, setName] = useState(currentUser.name);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setName(currentUser.name);
  }, [currentUser.name]);

  if (!isOpen) return null;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch(`/api/user/avatar?user=${encodeURIComponent(currentUser.email)}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to upload avatar");
      const updatedProfile: UserProfile = await res.json();
      onUpdateProfile(updatedProfile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error(err);
      alert("Failed to upload photo to Cloudflare R2.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/user/profile?user=${encodeURIComponent(currentUser.email)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      const updatedProfile: UserProfile = await res.json();
      onUpdateProfile(updatedProfile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error(err);
      alert("Failed to save profile changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "680px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <h2 className="font-serif" style={{ fontSize: "18px", fontWeight: 600 }}>
            Workspace Settings
          </h2>
          <button onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ display: "flex", minHeight: "360px" }}>
          {/* Left Tabs */}
          <div
            style={{
              width: "180px",
              borderRight: "1px solid var(--border-subtle)",
              padding: "16px 8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <button
              onClick={() => setActiveTab("profile")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: activeTab === "profile" ? "var(--bg-nav-active)" : "transparent",
                color: activeTab === "profile" ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: activeTab === "profile" ? 600 : 400,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <User size={15} /> Profile
            </button>
            <button
              onClick={() => setActiveTab("storage")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: activeTab === "storage" ? "var(--bg-nav-active)" : "transparent",
                color: activeTab === "storage" ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: activeTab === "storage" ? 600 : 400,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <HardDrive size={15} /> Cloudflare R2
            </button>
            <button
              onClick={() => setActiveTab("access")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: activeTab === "access" ? "var(--bg-nav-active)" : "transparent",
                color: activeTab === "access" ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: activeTab === "access" ? 600 : 400,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Shield size={15} /> Zero Trust Auth
            </button>
            <button
              onClick={() => setActiveTab("appearance")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: activeTab === "appearance" ? "var(--bg-nav-active)" : "transparent",
                color: activeTab === "appearance" ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: activeTab === "appearance" ? 600 : 400,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Palette size={15} /> Appearance
            </button>
          </div>

          {/* Right Content */}
          <div style={{ flex: 1, padding: "24px 32px" }}>
            {activeTab === "profile" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                {/* Avatar Section */}
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                  <div style={{ position: "relative" }}>
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      style={{
                        width: "72px",
                        height: "72px",
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid var(--accent)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleAvatarFileChange}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="btn-primary"
                      style={{ fontSize: "12px", padding: "6px 14px", alignSelf: "flex-start" }}
                    >
                      {isUploading ? "Uploading to R2..." : "Upload Profile Photo"}
                    </button>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      JPG, PNG, or WebP stored directly in Cloudflare R2
                    </span>
                  </div>
                </div>

                {/* Display Name Input */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Full Name"
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-primary)",
                      color: "var(--text-primary)",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Email Account */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Email Account (Cloudflare Access)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.email}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-surface)",
                      color: "var(--text-muted)",
                      fontSize: "14px",
                      cursor: "not-allowed",
                    }}
                  />
                </div>

                {/* Save Button */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="btn-primary"
                    style={{ padding: "8px 18px" }}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                  {saveSuccess && (
                    <span style={{ fontSize: "12px", color: "var(--accent-text)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Check size={14} /> Profile updated in R2!
                    </span>
                  )}
                </div>
              </div>
            )}

            {activeTab === "storage" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <h3 className="font-serif" style={{ fontSize: "16px", fontWeight: 600 }}>
                  Cloudflare R2 Object Storage
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Clocean operates with zero database costs by storing all document blocks,
                  workspaces, indexes, and binary files directly inside Cloudflare R2.
                </p>

                {/* Progress bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                    <span>Used: 4.2 GB</span>
                    <span style={{ color: "var(--text-muted)" }}>Free Limit: 10.0 GB</span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      backgroundColor: "var(--bg-primary)",
                      borderRadius: "9999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: "42%",
                        height: "100%",
                        backgroundColor: "var(--accent)",
                        borderRadius: "9999px",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "var(--bg-primary)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--accent-text)" }}>
                    <Check size={14} /> Egress Fees: $0.00 / month (Unlimited)
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--accent-text)" }}>
                    <Check size={14} /> Class A (Write) Operations: 1,000,000 / month free
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--accent-text)" }}>
                    <Check size={14} /> Class B (Read) Operations: 10,000,000 / month free
                  </span>
                </div>
              </div>
            )}

            {activeTab === "access" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 className="font-serif" style={{ fontSize: "16px", fontWeight: 600 }}>
                  Cloudflare Zero Trust Access
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Cloudflare Access protects this workspace for up to 50 active team members on the
                  free tier. No separate authentication database, passwords, or user tables required.
                </p>

                <div
                  style={{
                    padding: "14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                    Headers Validated:
                  </div>
                  <code>Cf-Access-Authenticated-User-Email</code>
                  <br />
                  <code>Cf-Access-Jwt-Assertion</code>
                </div>
              </div>
            )}

            {activeTab === "appearance" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 className="font-serif" style={{ fontSize: "16px", fontWeight: 600 }}>
                  Theme & Typography
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Select the visual tone inspired by the Figma design system.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div
                    onClick={onToggleTheme}
                    style={{
                      padding: "16px",
                      borderRadius: "var(--radius-md)",
                      border: `2px solid ${theme === "dark" ? "var(--accent)" : "var(--border-subtle)"}`,
                      backgroundColor: "#1C1C1A",
                      color: "#E8E5E0",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                      Obsidian (Dark)
                    </div>
                    <div style={{ fontSize: "11px", color: "#8E8B84" }}>
                      Figma Dark Mode
                    </div>
                  </div>

                  <div
                    onClick={onToggleTheme}
                    style={{
                      padding: "16px",
                      borderRadius: "var(--radius-md)",
                      border: `2px solid ${theme === "light" ? "var(--accent)" : "var(--border-subtle)"}`,
                      backgroundColor: "#FAF8F5",
                      color: "#1C1C1A",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                      Warm Parchment (Light)
                    </div>
                    <div style={{ fontSize: "11px", color: "#75736E" }}>
                      Figma Light Mode
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
