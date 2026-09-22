import React, { useState, useEffect } from "react";
import { X, User, Shield, HardDrive, Palette, Check, Mail, Bell, Send, ExternalLink, LogOut, Camera, AlertTriangle, Trash2 } from "lucide-react";
import { UserProfile } from "../types.ts";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onSignOut?: () => void;
  onDeleteAccount?: () => void;
  sessionToken?: string | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  theme,
  onToggleTheme,
  onUpdateProfile,
  onSignOut,
  onDeleteAccount,
  sessionToken,
}) => {
  const [activeTab, setActiveTab] = useState<
    "profile" | "storage" | "access" | "notifications" | "appearance"
  >("profile");
  const [name, setName] = useState(currentUser.name);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState<string | null>(null);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (activeTab === "notifications" && isOpen) {
      fetch(`/api/notifications?user=${encodeURIComponent(currentUser.email)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setRecentNotifications(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [activeTab, isOpen, currentUser.email]);

  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true);
    setTestEmailMsg(null);
    try {
      const res = await fetch(
        `/api/notifications/test?user=${encodeURIComponent(currentUser.email)}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to send test email");
      const data = (await res.json()) as any;
      setTestEmailMsg(
        `Test notification dispatched via ${data.deliveryStatus || "R2 notification inbox"}! Check your notifications bell.`
      );
      // Reload notifications list
      const notifRes = await fetch(`/api/notifications?user=${encodeURIComponent(currentUser.email)}`);
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setRecentNotifications(Array.isArray(notifData) ? notifData : []);
      }
      setTimeout(() => setTestEmailMsg(null), 5000);
    } catch (err: any) {
      setTestEmailMsg(`Error: ${err.message || "Failed to dispatch test notification"}`);
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  React.useEffect(() => {
    setName(currentUser.name);
  }, [currentUser.name]);

  if (!isOpen) return null;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local image preview
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const token = sessionToken || localStorage.getItem("clocean_session_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      headers["x-user-email"] = currentUser.email;

      const res = await fetch(`/api/user/avatar?user=${encodeURIComponent(currentUser.email)}`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as any;
        throw new Error(errData.error || "Failed to upload avatar to Cloudflare R2");
      }
      const updatedProfile: UserProfile = await res.json();
      setAvatarPreview(updatedProfile.avatar);
      localStorage.setItem("clocean_user", JSON.stringify(updatedProfile));
      onUpdateProfile(updatedProfile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to upload photo to Cloudflare R2.");
      setAvatarPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const token = sessionToken || localStorage.getItem("clocean_session_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      headers["x-user-email"] = currentUser.email;

      const res = await fetch(`/api/user/profile?user=${encodeURIComponent(currentUser.email)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      const updatedProfile: UserProfile = await res.json();
      localStorage.setItem("clocean_user", JSON.stringify(updatedProfile));
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

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const token = sessionToken || localStorage.getItem("clocean_session_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      headers["x-user-email"] = currentUser.email;

      const res = await fetch(`/api/user/account?user=${encodeURIComponent(currentUser.email)}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as any;
        throw new Error(errData.error || "Failed to delete account");
      }

      setShowDeleteConfirm(false);
      onClose();
      if (onDeleteAccount) {
        onDeleteAccount();
      } else if (onSignOut) {
        onSignOut();
      }
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
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
              onClick={() => setActiveTab("notifications")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: activeTab === "notifications" ? "var(--bg-nav-active)" : "transparent",
                color: activeTab === "notifications" ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: activeTab === "notifications" ? 600 : 400,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Mail size={15} /> Notifications & Email
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

            {onSignOut && (
              <button
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                style={{
                  marginTop: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "transparent",
                  color: "#ef4444",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <LogOut size={15} /> Sign Out
              </button>
            )}
          </div>

          {/* Right Content */}
          <div style={{ flex: 1, padding: "24px 32px" }}>
            {activeTab === "profile" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                {/* Avatar Section */}
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{ position: "relative", cursor: "pointer" }}
                    title="Click to change profile photo"
                  >
                    <img
                      src={avatarPreview || currentUser.avatar}
                      alt={currentUser.name}
                      style={{
                        width: "76px",
                        height: "76px",
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2.5px solid var(--accent)",
                        boxShadow: "var(--shadow-sm)",
                        transition: "opacity 0.2s ease",
                        opacity: isUploading ? 0.6 : 1,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: "var(--accent)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                        border: "2px solid var(--bg-surface)",
                      }}
                    >
                      <Camera size={12} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      style={{ display: "none" }}
                      onChange={handleAvatarFileChange}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="btn-primary"
                      style={{ fontSize: "12px", padding: "6px 14px", alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Camera size={14} />
                      <span>{isUploading ? "Uploading to R2..." : "Upload Profile Photo"}</span>
                    </button>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      JPG, PNG, or WebP up to 5MB stored directly in Cloudflare R2
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

                {/* Danger Zone: Delete Account */}
                <div
                  style={{
                    marginTop: "16px",
                    paddingTop: "20px",
                    borderTop: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#ef4444" }}>
                    <AlertTriangle size={15} />
                    <span>Danger Zone</span>
                  </div>

                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "rgba(239, 68, 68, 0.05)",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                        Delete Account
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px", lineHeight: 1.4 }}>
                        Permanently delete your profile, personal data, and workspace access. This cannot be undone.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setDeleteConfirmText("");
                        setDeleteError(null);
                      }}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        color: "#ef4444",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Delete Account</span>
                    </button>
                  </div>
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

            {/* Notifications & Email Tab */}
            {activeTab === "notifications" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <h3
                    className="font-serif"
                    style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}
                  >
                    Email & Mention Notifications
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Automated email delivery whenever a teammate @mentions you or assigns you to a task
                  </p>
                </div>

                {/* Email Address & Channel Status */}
                <div
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Delivery Recipient
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", marginTop: "2px" }}>
                        {currentUser.email}
                      </div>
                    </div>

                    <button
                      onClick={handleSendTestEmail}
                      disabled={isSendingTestEmail}
                      className="btn-primary"
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        opacity: isSendingTestEmail ? 0.6 : 1,
                      }}
                    >
                      <Send size={12} />
                      <span>{isSendingTestEmail ? "Sending..." : "Send Test Email"}</span>
                    </button>
                  </div>

                  {testEmailMsg && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "11px",
                        color: testEmailMsg.startsWith("Error") ? "#ef4444" : "var(--accent-text)",
                        backgroundColor: testEmailMsg.startsWith("Error") ? "rgba(239, 68, 68, 0.15)" : "var(--accent-light)",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <Check size={12} /> {testEmailMsg}
                    </div>
                  )}
                </div>

                {/* Engine Info Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                      Cloudflare Email Routing
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Zero-cost edge delivery via Worker <code>send_email</code> binding.
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                      Transactional API / Resend
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Direct API fallback with instant verified inbox delivery.
                    </div>
                  </div>
                </div>

                {/* Recent Notifications Audit Stream */}
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                    Recent Notifications Log ({recentNotifications.length})
                  </div>
                  <div
                    style={{
                      maxHeight: "180px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {recentNotifications.length === 0 ? (
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "12px 0", textAlign: "center" }}>
                        No recent notifications logged.
                      </div>
                    ) : (
                      recentNotifications.slice(0, 5).map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: "8px 10px",
                            backgroundColor: "var(--bg-primary)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-sm)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>
                              {n.sender.name}: {n.taskTitle || n.documentTitle || n.workspaceName}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              "{n.contextSnippet}"
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              backgroundColor: "var(--accent-light)",
                              color: "var(--accent-text)",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              flexShrink: 0,
                              marginLeft: "8px",
                            }}
                          >
                            {n.emailStatus || "Sent"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delete Account Confirmation Dialog */}
        {showDeleteConfirm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 110,
              padding: "20px",
            }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div
              className="animate-fade-in"
              style={{
                width: "100%",
                maxWidth: "460px",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "var(--radius-lg)",
                padding: "24px",
                boxShadow: "var(--shadow-lg)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ef4444",
                  }}
                >
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="font-serif" style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                    Delete Account Permanently
                  </h3>
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 16px 0" }}>
                This action is <strong style={{ color: "#ef4444" }}>permanent and irreversible</strong>. Your user profile, avatar, notifications, and private workspaces will be permanently erased from Cloudflare R2.
              </p>

              {deleteError && (
                <div
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#ef4444",
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 12px",
                    fontSize: "12px",
                    marginBottom: "14px",
                  }}
                >
                  {deleteError}
                </div>
              )}

              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  To confirm, type <strong style={{ color: "var(--text-primary)" }}>DELETE</strong> or your email (<strong style={{ color: "var(--text-primary)" }}>{currentUser.email}</strong>):
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE or your email"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="btn-ghost"
                  style={{ fontSize: "13px", padding: "8px 14px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={
                    isDeleting ||
                    (deleteConfirmText.trim() !== "DELETE" &&
                      deleteConfirmText.trim().toLowerCase() !== currentUser.email.toLowerCase())
                  }
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "#ef4444",
                    border: "none",
                    color: "#FFFFFF",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor:
                      isDeleting ||
                      (deleteConfirmText.trim() !== "DELETE" &&
                        deleteConfirmText.trim().toLowerCase() !== currentUser.email.toLowerCase())
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      isDeleting ||
                      (deleteConfirmText.trim() !== "DELETE" &&
                        deleteConfirmText.trim().toLowerCase() !== currentUser.email.toLowerCase())
                        ? 0.5
                        : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Trash2 size={14} />
                  <span>{isDeleting ? "Deleting Account..." : "Permanently Delete Account"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
