import React, { useState, useEffect } from "react";
import { X, Users, UserPlus, Shield, ShieldCheck, Mail, Check, AlertCircle, Layers, Link2, Copy } from "lucide-react";
import { UserWorkspaceReference, WorkspaceMember, UserProfile } from "../types.ts";

interface TeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: UserWorkspaceReference;
  currentUser: UserProfile;
  sessionToken?: string | null;
}

export const TeamMembersModal: React.FC<TeamMembersModalProps> = ({
  isOpen,
  onClose,
  workspace,
  currentUser,
  sessionToken,
}) => {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [isInviting, setIsInviting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [updatingMemberEmail, setUpdatingMemberEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = sessionToken || localStorage.getItem("clocean_session_token");
    const headers: Record<string, string> = { ...extra };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (currentUser?.email) headers["x-user-email"] = currentUser.email;
    return headers;
  };

  // Fetch members when modal is opened or workspace changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/workspaces/${workspace.id}/members?user=${encodeURIComponent(currentUser.email)}`, {
      headers: getAuthHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load workspace members");
        return res.json();
      })
      .then((data: any) => {
        if (isMounted) {
          setMembers(Array.isArray(data) ? data : data?.members || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load members");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, workspace.id, currentUser.email]);

  if (!isOpen) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }

    setIsInviting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspace.id}/members?user=${encodeURIComponent(currentUser.email)}`,
        {
          method: "POST",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            email: inviteEmail.trim(),
            role: inviteRole,
          }),
        }
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as any;
        throw new Error(data.error || "Failed to invite member");
      }

      const updatedMembers: any = await res.json();
      setMembers(Array.isArray(updatedMembers) ? updatedMembers : updatedMembers?.members || []);
      setSuccessMsg(`Invited ${inviteEmail} to ${workspace.name}! An invitation email has been dispatched.`);
      setInviteEmail("");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to invite member");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (memberEmail: string, newRole: "admin" | "member") => {
    setUpdatingMemberEmail(memberEmail);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspace.id}/members/${encodeURIComponent(memberEmail)}/role?user=${encodeURIComponent(currentUser.email)}`,
        {
          method: "PUT",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as any;
        throw new Error(data.error || "Failed to update member role");
      }

      const updatedMembers: any = await res.json();
      setMembers(Array.isArray(updatedMembers) ? updatedMembers : updatedMembers?.members || []);
      setSuccessMsg(
        `Updated ${memberEmail}'s role to ${newRole === "admin" ? "Admin" : "Member (Non-admin)"}!`
      );
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err.message || "Failed to update member role");
    } finally {
      setUpdatingMemberEmail(null);
    }
  };

  const isPrivileged = workspace.role === "owner" || workspace.role === "admin";

  return (
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
      onClick={onClose}
    >
      <div
        className="animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "600px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "var(--bg-surface-hover)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={20} color="var(--accent)" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2
                  className="font-serif"
                  style={{
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: 0,
                  }}
                >
                  {workspace.name}
                </h2>
                <span
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    backgroundColor: "var(--bg-nav-active)",
                    color: "var(--accent)",
                    fontWeight: 600,
                  }}
                >
                  {workspace.role}
                </span>
              </div>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  margin: "2px 0 0 0",
                }}
              >
                Team access & collaboration roster
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", maxHeight: "70vh", overflowY: "auto" }}>
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#ef4444",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "rgba(30, 125, 107, 0.15)",
                border: "1px solid rgba(30, 125, 107, 0.3)",
                color: "var(--accent)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              <Check size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Notion-style Workspace Invite Link */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-surface-hover)",
              border: "1px solid var(--border-subtle)",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Link2 size={16} color="var(--accent)" />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                  Workspace Invite Link
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Anyone with link can join as a member
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                readOnly
                value={`${window.location.origin}?join=${workspace.id}`}
                style={{
                  flex: 1,
                  fontSize: "12px",
                  padding: "7px 10px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}?join=${workspace.id}`);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2500);
                }}
                className="btn-primary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                  padding: "6px 14px",
                }}
              >
                {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
              </button>
            </div>
          </div>

          {/* Invite form (only for Owner and Admin) */}
          {isPrivileged ? (
            <form onSubmit={handleInvite} style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Invite Team Member
                </label>
                <span style={{ fontSize: "11px", color: "var(--accent)" }}>
                  Admin privileges enabled • Invitation email will be sent
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Mail
                    size={16}
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }}
                  />
                  <input
                    type="email"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px 8px 36px",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    padding: "0 12px",
                    outline: "none",
                  }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>

                <button
                  type="submit"
                  disabled={isInviting || !inviteEmail.trim()}
                  className="btn-primary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    fontSize: "13px",
                    opacity: isInviting || !inviteEmail.trim() ? 0.6 : 1,
                  }}
                >
                  <UserPlus size={15} />
                  <span>{isInviting ? "Adding..." : "Invite"}</span>
                </button>
              </div>
            </form>
          ) : (
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                backgroundColor: "var(--bg-primary)",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                marginBottom: "20px",
              }}
            >
              Only workspace Owners and Admins can invite new teammates.
            </div>
          )}

          {/* Members List */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Members ({members.length})
              </span>
            </div>

            {isLoading ? (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                Loading team roster...
              </div>
            ) : members.length === 0 ? (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                No members found in this workspace.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {members.map((member) => (
                  <div
                    key={member.email}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <img
                        src={member.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.email)}`}
                        alt={member.name || member.email}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "1px solid var(--border-subtle)",
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          {member.name || member.email.split("@")[0]}
                          {member.email === currentUser.email && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "var(--text-muted)",
                                marginLeft: "6px",
                                fontWeight: 400,
                              }}
                            >
                              (You)
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {member.email}
                        </div>
                      </div>
                    </div>

                    {/* Member Role Display & Management */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {member.role === "owner" ? (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: "10px",
                            backgroundColor: "rgba(30, 125, 107, 0.15)",
                            color: "var(--accent)",
                            fontWeight: 600,
                          }}
                        >
                          <ShieldCheck size={12} />
                          Owner
                        </span>
                      ) : isPrivileged && member.email !== currentUser.email ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <select
                            value={member.role}
                            disabled={updatingMemberEmail === member.email}
                            onChange={(e) =>
                              handleRoleChange(member.email, e.target.value as "admin" | "member")
                            }
                            style={{
                              backgroundColor:
                                member.role === "admin"
                                  ? "var(--bg-nav-active)"
                                  : "var(--bg-surface)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "var(--radius-sm)",
                              color:
                                member.role === "admin"
                                  ? "var(--accent)"
                                  : "var(--text-secondary)",
                              fontSize: "12px",
                              fontWeight: 500,
                              padding: "4px 8px",
                              cursor: "pointer",
                              outline: "none",
                              transition: "all 0.15s ease",
                            }}
                            aria-label={`Role for ${member.email}`}
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member (Non-admin)</option>
                          </select>
                          {updatingMemberEmail === member.email && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              Saving...
                            </span>
                          )}
                        </div>
                      ) : (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: "10px",
                            backgroundColor:
                              member.role === "admin"
                                ? "var(--bg-nav-active)"
                                : "var(--bg-surface)",
                            color:
                              member.role === "admin"
                                ? "var(--accent)"
                                : "var(--text-secondary)",
                            fontWeight: member.role === "admin" ? 600 : 400,
                          }}
                        >
                          {member.role === "admin" ? <Shield size={12} /> : null}
                          {member.role === "admin" ? "Admin" : "Member"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: "8px 16px", fontSize: "13px" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
