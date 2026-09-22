import React, { useState, useEffect } from "react";
import { Layers, ArrowRight, Mail, KeyRound, ArrowLeft, RefreshCw, CheckCircle2 } from "lucide-react";
import { UserProfile, UserWorkspaceReference } from "../types.ts";

interface AuthGateProps {
  onAuthenticated: (user: UserProfile, workspace: UserWorkspaceReference, token?: string) => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const [step, setStep] = useState<"details" | "verify">("details");
  const [mode, setMode] = useState<"signin" | "setup" | "join">("setup");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [joinWorkspaceId, setJoinWorkspaceId] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{
    id: string;
    name: string;
    icon: string;
    memberCount: number;
    ownerName: string;
  } | null>(null);

  // Check for ?join= or ?invite= URL parameters on boot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get("join") || params.get("invite");
    if (joinId) {
      setJoinWorkspaceId(joinId);
      setMode("join");
      fetch(`/api/workspaces/${joinId}/invite-info`)
        .then((res) => (res.ok ? (res.json() as Promise<any>) : null))
        .then((data: any) => {
          if (data && !data.error) {
            setInviteInfo(data);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Cooldown countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-generate workspace name when user types their name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    const firstName = val.trim().split(" ")[0];
    if (firstName && (!workspaceName || workspaceName.endsWith("'s Workspace") || workspaceName === "My Workspace")) {
      setWorkspaceName(`${firstName}'s Workspace`);
    }
  };

  // Step 1: Send 6-digit OTP verification code
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDevCodeHint(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if ((mode === "setup" || mode === "join") && !name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    const finalWsName = workspaceName.trim() || `${name.trim().split(" ")[0] || "My"}'s Workspace`;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          purpose: mode,
          name: name.trim(),
          workspaceName: mode === "join" ? inviteInfo?.name : finalWsName,
          workspaceId: joinWorkspaceId || undefined,
        }),
      });

      const data: any = await res.json();
      if (!res.ok) {
        if (data.setupRequired) {
          setMode("setup");
          setError(data.error || "No existing workspace found. Please complete setup to get started.");
          setLoading(false);
          return;
        }
        if (data.accountExists) {
          setMode("signin");
          setError(data.error || "An account with this email already exists. Please sign in instead.");
          setLoading(false);
          return;
        }
        throw new Error(data.error || "Failed to send verification code.");
      }

      setStep("verify");
      setResendCooldown(30);
      if (data.devVerificationCode) {
        setDevCodeHint(data.devVerificationCode);
      }
    } catch (err: any) {
      setError(err.message || "Failed to send verification code. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify 6-digit OTP code & receive session token
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = otp.trim();
    if (cleanCode.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const finalWsName = workspaceName.trim() || `${name.trim().split(" ")[0] || "My"}'s Workspace`;

      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
          purpose: mode,
          name: name.trim(),
          workspaceName: mode === "join" ? inviteInfo?.name : finalWsName,
          workspaceId: joinWorkspaceId || undefined,
        }),
      });

      const data: any = await res.json();
      if (!res.ok) {
        if (data.accountExists) {
          setMode("signin");
          setStep("details");
          setError(data.error || "An account with this email already exists. Please sign in instead.");
          setLoading(false);
          return;
        }
        throw new Error(data.error || "Verification failed.");
      }

      if (data.authenticated && data.user && data.workspace) {
        if (data.token) {
          localStorage.setItem("clocean_session_token", data.token);
        }
        onAuthenticated(data.user, data.workspace, data.token);
      } else {
        throw new Error("Verification succeeded but workspace payload was incomplete.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "32px 20px",
        boxSizing: "border-box",
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            backgroundColor: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
            boxShadow: "0 2px 8px rgba(30, 125, 107, 0.25)",
          }}
        >
          <Layers size={20} />
        </div>
        <span
          className="font-serif"
          style={{
            fontSize: "22px",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          Clocean
        </span>
      </div>

      {/* Main Card */}
      <div
        className="animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: "36px 32px",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {step === "details" ? (
          <>
            {/* Mode Switcher Tabs */}
            {/* Notion-Style Mode Switcher or Invitation Header */}
            {mode === "join" ? (
              <div>
                {inviteInfo && (
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--bg-nav-active)",
                      border: "1.5px solid var(--accent)",
                      marginBottom: "20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "10px",
                        backgroundColor: "var(--bg-surface)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "var(--shadow-sm)",
                        color: "var(--accent)",
                      }}
                    >
                      <Layers size={22} />
                    </div>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {inviteInfo.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        Invited by <strong>{inviteInfo.ownerName}</strong> • {inviteInfo.memberCount} member{inviteInfo.memberCount === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent)" }}>
                    Team Invitation
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError(null);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: "12px",
                      textDecoration: "underline",
                    }}
                  >
                    Sign in to other account
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  backgroundColor: "var(--bg-sidebar)",
                  borderRadius: "var(--radius-sm)",
                  padding: "3px",
                  marginBottom: "28px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMode("setup");
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    backgroundColor: mode === "setup" ? "var(--bg-surface)" : "transparent",
                    color: mode === "setup" ? "var(--text-primary)" : "var(--text-muted)",
                    fontWeight: mode === "setup" ? 600 : 500,
                    fontSize: "13px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Workspace Setup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    backgroundColor: mode === "signin" ? "var(--bg-surface)" : "transparent",
                    color: mode === "signin" ? "var(--text-primary)" : "var(--text-muted)",
                    fontWeight: mode === "signin" ? 600 : 500,
                    fontSize: "13px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Sign In
                </button>
              </div>
            )}

            {/* Heading & Subtitle */}
            <div style={{ marginBottom: "24px", textAlign: "left" }}>
              <h1
                className="font-serif"
                style={{
                  fontSize: "24px",
                  fontWeight: 600,
                  marginBottom: "8px",
                  color: "var(--text-primary)",
                }}
              >
                {mode === "join"
                  ? `Join ${inviteInfo?.name || "Workspace"}`
                  : mode === "setup"
                  ? "Welcome to Clocean"
                  : "Welcome back"}
              </h1>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {mode === "join"
                  ? "Enter your details to verify your email and join your team."
                  : mode === "setup"
                  ? "We'll send a 6-digit code to verify your email and launch your workspace."
                  : "Enter your email to receive a secure 6-digit verification code."}
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#ef4444",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 14px",
                  fontSize: "13px",
                  marginBottom: "20px",
                  lineHeight: 1.4,
                }}
              >
                {error}
              </div>
            )}

            {/* Details Form */}
            <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {(mode === "setup" || mode === "join") && (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={handleNameChange}
                    placeholder="e.g. Ardon Bailey"
                    required
                    className="input-search"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. ardon@example.com"
                  required
                  className="input-search"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {mode === "setup" && (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="e.g. Acme Workspace"
                    className="input-search"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: 600,
                  marginTop: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? (
                  "Sending verification code..."
                ) : (
                  <>
                    {mode === "join" ? "Continue to Join Workspace" : mode === "setup" ? "Send Verification Code" : "Send Login Code"} <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          /* Step 2: Verification Code Entry */
          <div>
            <button
              type="button"
              onClick={() => {
                setStep("details");
                setError(null);
                setOtp("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                padding: "0 0 16px 0",
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "var(--accent-light)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent)",
                  marginBottom: "16px",
                }}
              >
                <Mail size={24} />
              </div>
              <h2
                className="font-serif"
                style={{
                  fontSize: "22px",
                  fontWeight: 600,
                  margin: "0 0 8px 0",
                  color: "var(--text-primary)",
                }}
              >
                Check your email
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                We sent a 6-digit code to <strong>{email}</strong>.
              </p>
            </div>

            {/* Dev Hint Banner if available */}
            {devCodeHint && (
              <div
                style={{
                  backgroundColor: "rgba(30, 125, 107, 0.08)",
                  border: "1px solid var(--accent)",
                  color: "var(--accent)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 12px",
                  fontSize: "12px",
                  marginBottom: "18px",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <KeyRound size={14} />
                <span>Dev Code: <strong>{devCodeHint}</strong></span>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#ef4444",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 14px",
                  fontSize: "13px",
                  marginBottom: "20px",
                  lineHeight: 1.4,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textAlign: "center",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "10px",
                  }}
                >
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  autoFocus
                  required
                  style={{
                    width: "100%",
                    padding: "14px",
                    fontSize: "26px",
                    fontWeight: 700,
                    letterSpacing: "12px",
                    textAlign: "center",
                    boxSizing: "border-box",
                    backgroundColor: "var(--bg-primary)",
                    border: "1.5px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-primary)",
                    outline: "none",
                    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="btn-primary"
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  opacity: loading || otp.length !== 6 ? 0.6 : 1,
                  cursor: loading || otp.length !== 6 ? "not-allowed" : "pointer",
                }}
              >
                {loading ? (
                  "Verifying code..."
                ) : (
                  <>
                    {mode === "join" ? "Verify & Join Workspace" : "Verify & Launch Workspace"} <CheckCircle2 size={16} />
                  </>
                )}
              </button>

              <div style={{ textAlign: "center", marginTop: "4px" }}>
                {resendCooldown > 0 ? (
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Resend code in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                      fontSize: "12px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <RefreshCw size={12} /> Resend verification code
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
