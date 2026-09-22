import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  Env,
  WorkspaceTree,
  TreeNode,
  DocContent,
  TaskItem,
  TasksData,
  TaskBoard,
  PhotosData,
  ActivitiesData,
  DocComment,
  DocCommentsData,
  MentionNotification,
  UserNotificationsData,
  DocRevision,
  DocRevisionsData,
  WorkspaceFavoritesData,
  UserProfile,
  UserWorkspaceReference,
} from "./types.ts";
import { R2Database } from "./storage/r2Db.ts";
import { DatabaseConflictError, DatabaseStore, DatabaseValidationError } from "./storage/databaseStore.ts";
import { getAuthEmail, requireAuth } from "./auth/cfAccess.ts";
import { DocSessionDO } from "./durable_objects/DocSessionDO.ts";
import crypto from "node:crypto";
import { signSessionToken } from "./auth/session.ts";
import {
  extractMentions,
  dispatchMentionNotification,
  generateOtpEmailHtml,
} from "./notifications/emailNotifier.ts";
import { z } from "zod";
import {
  CreateWorkspaceSchema,
  InviteMemberSchema,
  UpdateMemberRoleSchema,
  SaveDocSchema,
  ShareDocSchema,
  TaskItemSchema,
  AddCommentSchema,
  MentionNotificationPayloadSchema,
  UpdateUserProfileSchema,
  CreateTreeNodeSchema,
  UpdateTreeNodeSchema,
  ToggleFavoriteSchema,
  SetupSchema,
  LoginSchema,
  SendOtpSchema,
  VerifyOtpSchema,
  CheckDeadlinesSchema,
  CreateDatabaseSchema,
  DatabaseRecordPayloadSchema,
} from "./schemas.ts";

export { DocSessionDO };

// Security Utility: Sanitize filename to prevent R2 path traversal and header injection
export function sanitizeFilename(filename: string): string {
  const basename = filename.replace(/\\/g, "/").split("/").pop() || "unnamed_file";
  const sanitized = basename
    .replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, "_")
    .replace(/\.\.+/g, ".")
    .replace(/["'\r\n]/g, "")
    .trim();
  return sanitized || "unnamed_file";
}

// Security Utility: Enforce safe identifier format for IDs and document slugs
export function isValidId(id: string): boolean {
  return typeof id === "string" && /^[a-zA-Z0-9_\-\.]+$/.test(id) && !id.includes("..");
}

// Security Utility: Validate Origin header during WebSocket handshake to prevent CSWSH
export function isAllowedOrigin(originHeader: string | null | undefined, requestUrl: string, env?: Env): boolean {
  if (!originHeader) return true; // Direct non-browser requests or same-site
  try {
    const requestOrigin = new URL(requestUrl).origin;
    const originUrl = new URL(originHeader);

    // Match exact scheme, host, and port.
    if (originUrl.origin === requestOrigin) return true;

    // Allow localhost development only in non-production environments
    if (env?.ENVIRONMENT !== "production") {
      if ((originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1") &&
          (originUrl.port === "" || originUrl.port === "3000" || originUrl.port === "8787")) return true;
    }

    // Check configured allowed origins
    if (env?.ALLOWED_ORIGINS) {
      const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
      if (allowed.includes(originHeader) || allowed.includes(originUrl.origin)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Safe extensions allowed for inline rendering (all other formats forced to attachment)
const SAFE_INLINE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".txt"];
const ALLOWED_AVATAR_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const app = new Hono<{ Bindings: Env; Variables: { requesterEmail: string } }>();

function applySecurityHeaders(response: Response): Response {
  // A successful WebSocket upgrade uses status 101. The Fetch Response
  // constructor rejects informational status codes, so preserve the upgrade
  // response and let the WebSocket handshake complete.
  if (response.status === 101) return response;

  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src 'self' ws: wss:;");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Hardened CORS: dynamically validate origin and allow credentials
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return "*";
      if (isAllowedOrigin(origin, c.req.url, c.env)) return origin;
      return null;
    },
    allowHeaders: ["Content-Type", "Authorization", "x-user-email", "x-workspace-id", "Range", "If-Match"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use("*", async (c, next) => {
  await next();
  c.res = applySecurityHeaders(c.res);
});

// Helper: Extract active workspace ID from header or query (defaulting to "default")
export function getWorkspaceId(c: any): string {
  const headerWs = c.req.header("x-workspace-id");
  const queryWs = c.req.query("ws");
  const ws = headerWs || queryWs || "default";
  return isValidId(ws) ? ws : "default";
}

function getRequestedWorkspaceId(c: any): string | null {
  const headerWs = c.req.header("x-workspace-id");
  const queryWs = c.req.query("ws");
  if (headerWs || queryWs) return headerWs || queryWs;
  const match = c.req.path.match(/^\/api\/workspaces\/([^/]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

// Helper: Extract authenticated user email or throw 401
export function getRequesterEmail(c: any): string {
  const email = c.get?.("requesterEmail");
  if (!email) {
    throw new Error("Unauthorized: Identity required");
  }
  return email;
}

function getAppUrl(c: any): string {
  if (c.env.APP_URL) return c.env.APP_URL.replace(/\/$/, "");
  if (c.env.ENVIRONMENT === "production" && c.env.ALLOWED_ORIGINS) {
    return c.env.ALLOWED_ORIGINS.split(",")[0].trim().replace(/\/$/, "");
  }
  if (c.env.ENVIRONMENT === "production") throw new Error("APP_URL or ALLOWED_ORIGINS must be configured in production");
  return new URL(c.req.url).origin;
}

function rejectOversizedRequest(c: any, maxBytes: number, message = "Request body exceeds the maximum allowed size"): Response | null {
  const contentLength = Number(c.req.header("content-length"));
  return Number.isFinite(contentLength) && contentLength > maxBytes
    ? c.json({ error: message }, 413)
    : null;
}

app.onError((err, c) => {
  if (err.message.startsWith("Unauthorized")) {
    return c.json({ error: "Unauthorized", message: err.message }, 401);
  }
  console.error("Unhandled request error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Security Utility: Verify that an authenticated user has membership in the requested workspace
export async function verifyWorkspaceAccess(
  c: any,
  wsId: string,
  db: R2Database,
  requesterEmail: string
): Promise<Response | null> {
  // 'default' workspace is shared and accessible to all authenticated users
  if (wsId === "default") return null;

  const meta = await db.getWorkspaceMetadata(wsId);
  if (!meta) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  // Fast-path: Check user's registered workspaces
  const userWorkspaces = await db.getUserWorkspaces(requesterEmail);
  if (userWorkspaces.some((w) => w.id === wsId)) {
    return null;
  }

  // Fallback: Check workspace members roster
  const members = await db.getWorkspaceMembers(wsId);
  if (members.some((m) => m.email.toLowerCase() === requesterEmail.toLowerCase())) {
    return null;
  }

  return c.json({ error: "Forbidden: You are not a member of this workspace" }, 403);
}

// Middleware: Enforce authentication across all workspace endpoints
app.use("/api/*", async (c, next) => {
  // Public endpoints accessible without session
  if (c.req.path.startsWith("/api/public/")) {
    return next();
  }
  if (
    c.req.path === "/api/auth/login" ||
    c.req.path === "/api/auth/send-otp" ||
    c.req.path === "/api/auth/verify-otp" ||
    c.req.path === "/api/setup" ||
    c.req.path === "/api/me" ||
    c.req.path.startsWith("/api/user/avatar/") ||
    (c.req.path.startsWith("/api/workspaces/") && c.req.path.endsWith("/invite-info"))
  ) {
    return next();
  }

  // Enforce authentication on all other endpoints
  const authRes = await requireAuth(c.req.raw, c.env);
  if (authRes instanceof Response) {
    return authRes;
  }

  c.set("requesterEmail", authRes.email);

  const requestedWs = getRequestedWorkspaceId(c);
  if (requestedWs !== null && !isValidId(requestedWs)) {
    return c.json({ error: "Invalid workspace ID" }, 400);
  }

  // Joining is authorized by the route's invitation check rather than current membership.
  const isJoinRoute = /^\/api\/workspaces\/[^/]+\/join$/.test(c.req.path);
  // Let mutation handlers perform their role-specific checks so callers
  // receive the correct authorization response. Read-only workspace routes
  // still go through this membership gate.
  const isMemberManagementMutation =
    (/^\/api\/workspaces\/[^/]+\/members$/.test(c.req.path) && c.req.method === "POST") ||
    (/^\/api\/workspaces\/[^/]+\/members\/[^/]+\/role$/.test(c.req.path) && c.req.method === "PUT");
  if (requestedWs && !isJoinRoute && !isMemberManagementMutation) {
    const db = new R2Database(c.env.CLOCEAN_STORAGE);
    const access = await verifyWorkspaceAccess(c, requestedWs, db, authRes.email);
    if (access) return access;
  }

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  await db.ensureSeeded();

  await next();
});

// Auth & Setup Endpoints (Backed by R2)
app.get("/api/me", async (c) => {
  const email = await getAuthEmail(c.req.raw, c.env);
  if (!email) {
    return c.json({ authenticated: false, accessRequired: c.env.ENVIRONMENT === "production" }, 200);
  }
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfile(email);
  const workspaces = await db.getUserWorkspaces(email);
  return c.json({ ...profile, authenticated: true, user: profile, workspaces }, 200);
});

// 1. Send 6-digit Verification Code via Email (OTP)
app.post("/api/auth/send-otp", async (c) => {
  if (c.env.ENVIRONMENT === "production") {
    return c.json({ error: "Email verification signup is disabled in production. Protect the deployment with Cloudflare Access and sign in through your Access application." }, 410);
  }
  const json = await c.req.json().catch(() => null);
  const parsed = SendOtpSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid request payload", details: parsed.error.issues }, 400);
  }

  const cleanEmail = parsed.data.email.toLowerCase().trim();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);

  if (parsed.data.purpose === "login") {
    const existing = await db.getUserProfileIfExists(cleanEmail);
    if (!existing) {
      return c.json({ setupRequired: true, error: "No workspace found for this email. Please complete workspace setup first." }, 404);
    }
  }

  if (parsed.data.purpose === "setup") {
    const existing = await db.getUserProfileIfExists(cleanEmail);
    if (existing) {
      return c.json(
        {
          error: "An account with this email already exists. Please sign in instead.",
          accountExists: true,
        },
        409
      );
    }
  }

  // Rate-limiting: prevent sending more than once every 30 seconds
  const existingOtp = await db.getOtp(cleanEmail);
  if (existingOtp && Date.now() - existingOtp.lastSentAt < 30000) {
    const waitSec = Math.ceil((30000 - (Date.now() - existingOtp.lastSentAt)) / 1000);
    return c.json({ error: `Please wait ${waitSec}s before requesting a new code.` }, 429);
  }

  // Generate cryptographically secure 6-digit numeric OTP (CSPRNG)
  let randomNum: string;
  if (typeof crypto.randomInt === "function") {
    randomNum = crypto.randomInt(100000, 1000000).toString();
  } else {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    randomNum = (100000 + (buf[0] % 900000)).toString();
  }
  const salt = crypto.randomUUID();
  const hashedCode = crypto.createHash("sha256").update(randomNum + salt).digest("hex");

  await db.storeOtp(cleanEmail, {
    email: cleanEmail,
    hashedCode,
    salt,
    purpose: parsed.data.purpose,
    metadata: {
      name: parsed.data.name,
      workspaceName: parsed.data.workspaceName,
      workspaceId: parsed.data.workspaceId,
    },
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
    lastSentAt: Date.now(),
  });

  const emailSubject = parsed.data.purpose === "join"
    ? `Clocean Invite Code: ${randomNum}`
    : parsed.data.purpose === "setup"
    ? `Clocean Verification Code: ${randomNum}`
    : `Clocean Login Code: ${randomNum}`;
  const emailHtml = generateOtpEmailHtml(randomNum, parsed.data.purpose, parsed.data.workspaceName);

  let emailSent = false;
  // Option A: Cloudflare Email Routing
  if (c.env.SEND_EMAIL && typeof c.env.SEND_EMAIL.send === "function") {
    try {
      await c.env.SEND_EMAIL.send({
        to: cleanEmail,
        from: c.env.EMAIL_FROM || "notifications@clocean.co",
        subject: emailSubject,
        html: emailHtml,
      });
      emailSent = true;
    } catch (e) {
      console.warn("Cloudflare Email send failed:", e);
    }
  }
  // Option B: Resend Transactional Email
  else if (c.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: c.env.EMAIL_FROM || "notifications@clocean.co",
          to: cleanEmail,
          subject: emailSubject,
          html: emailHtml,
        }),
      });
      if (res.ok) emailSent = true;
    } catch (e) {
      console.warn("Resend API send failed:", e);
    }
  }

  if (c.env.ENVIRONMENT === "production" && !emailSent) {
    return c.json({
      error: "Email delivery is not configured. Configure a Cloudflare Email Service binding or RESEND_API_KEY before requesting verification codes.",
    }, 503);
  }

  const responsePayload: any = {
    success: true,
    message: `Verification code sent to ${cleanEmail}.`,
    emailSent,
  };

  if (c.env.ENVIRONMENT !== "production") {
    responsePayload.devVerificationCode = randomNum;
  }

  return c.json(responsePayload, 200);
});

// 2. Verify 6-digit Code & Issue Signed Session Token
app.post("/api/auth/verify-otp", async (c) => {
  if (c.env.ENVIRONMENT === "production") {
    return c.json({ error: "Email verification signup is disabled in production. Sign in through Cloudflare Access." }, 410);
  }
  const json = await c.req.json().catch(() => null);
  const parsed = VerifyOtpSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid verification payload", details: parsed.error.issues }, 400);
  }

  const cleanEmail = parsed.data.email.toLowerCase().trim();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const record = await db.getOtp(cleanEmail);

  if (!record) {
    return c.json({ error: "No pending verification found for this email. Please request a new code." }, 400);
  }

  if (Date.now() > record.expiresAt) {
    await db.deleteOtp(cleanEmail);
    return c.json({ error: "Verification code has expired. Please request a new code." }, 400);
  }

  if (record.attempts >= 5) {
    await db.deleteOtp(cleanEmail);
    return c.json({ error: "Too many failed attempts. Code has been invalidated for security. Please request a new code." }, 429);
  }

  const testHash = crypto.createHash("sha256").update(parsed.data.code.trim() + record.salt).digest("hex");
  const isMatch = crypto.timingSafeEqual(Buffer.from(testHash), Buffer.from(record.hashedCode));

  if (!isMatch) {
    const attempts = await db.incrementOtpAttempts(cleanEmail);
    const remaining = Math.max(0, 5 - attempts);
    return c.json({ error: `Invalid code. ${remaining} attempts remaining.` }, 400);
  }

  // Invalidate OTP immediately to prevent replay attacks
  await db.deleteOtp(cleanEmail);

  let primaryWorkspace: UserWorkspaceReference;
  let user: UserProfile;

  if (record.purpose === "setup") {
    const existing = await db.getUserProfileIfExists(cleanEmail);
    if (existing) {
      return c.json(
        {
          error: "An account with this email already exists. Please sign in instead.",
          accountExists: true,
        },
        409
      );
    }
    const name = record.metadata?.name || parsed.data.name || cleanEmail.split("@")[0];
    const wsName = record.metadata?.workspaceName || parsed.data.workspaceName;
    const setupResult = await db.setupWorkspace(name, cleanEmail, wsName);
    user = setupResult.user;
    primaryWorkspace = setupResult.workspace;
  } else if (record.purpose === "join") {
    const targetWsId = record.metadata?.workspaceId || parsed.data.workspaceId;
    if (!targetWsId) {
      return c.json({ error: "Missing target workspace ID to join" }, 400);
    }
    if (!isValidId(targetWsId)) {
      return c.json({ error: "Invalid target workspace ID" }, 400);
    }
    const invited = (await db.getWorkspaceMembers(targetWsId)).some(
      (member) => member.email.toLowerCase() === cleanEmail
    );
    if (!invited) {
      return c.json({ error: "A valid invitation is required to join this workspace" }, 403);
    }
    const name = record.metadata?.name || parsed.data.name || cleanEmail.split("@")[0];
    user = await db.getUserProfile(cleanEmail);
    if (name && (!user.name || user.name === cleanEmail.split("@")[0])) {
      user.name = name;
      await db.putUserProfile(user);
    }
    await db.addWorkspaceMember(targetWsId, cleanEmail, user.name || name, "member");
    const wsMeta = await db.getWorkspaceMetadata(targetWsId);
    primaryWorkspace = {
      id: targetWsId,
      name: wsMeta?.name || "Team Workspace",
      icon: wsMeta?.icon || "layers",
      role: "member",
    };
  } else {
    user = await db.getUserProfile(cleanEmail);
    const workspaces = await db.getUserWorkspaces(cleanEmail);
    primaryWorkspace = workspaces[0];
  }

  const allWorkspaces = await db.getUserWorkspaces(cleanEmail);
  const token = signSessionToken(cleanEmail, c.env.SESSION_SECRET, c.env);

  return c.json({
    success: true,
    authenticated: true,
    token,
    user,
    workspace: primaryWorkspace,
    workspaces: allWorkspaces,
  }, 200);
});

app.post("/api/auth/login", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid email", details: parsed.error.issues }, 400);
  }
  const email = parsed.data.email.toLowerCase().trim();

  // In production, identity comes from the Cloudflare Access protected application.
  if (c.env.ENVIRONMENT === "production") {
    return c.json(
      {
        error: "Direct passwordless login is disabled in production. Sign in through the Cloudflare Access protected application.",
        accessRequired: true,
      },
      403
    );
  }

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfileIfExists(email);
  if (!profile) {
    return c.json({ authenticated: false, email, setupRequired: true }, 200);
  }
  const workspaces = await db.getUserWorkspaces(email);
  const token = signSessionToken(email, c.env.SESSION_SECRET, c.env);
  return c.json({ authenticated: true, token, user: profile, workspaces }, 200);
});

app.post("/api/setup", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = SetupSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid setup payload", details: parsed.error.issues }, 400);
  }

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const cleanEmail = parsed.data.email.toLowerCase().trim();
  if (c.env.ENVIRONMENT === "production") {
    const accessEmail = await getAuthEmail(c.req.raw, c.env);
    if (!accessEmail) return c.json({ error: "Cloudflare Access authentication is required" }, 401);
    if (accessEmail !== cleanEmail) return c.json({ error: "The setup email must match the authenticated Cloudflare Access identity" }, 403);
  }
  const existing = await db.getUserProfileIfExists(cleanEmail);
  if (existing) {
    return c.json(
      {
        error: "An account with this email already exists. Please sign in instead.",
        accountExists: true,
      },
      409
    );
  }

  const result = await db.setupWorkspace(
    parsed.data.name,
    parsed.data.email,
    parsed.data.workspaceName,
    parsed.data.theme
  );
  const token = signSessionToken(parsed.data.email, c.env.SESSION_SECRET, c.env);
  return c.json({ success: true, token, ...result }, 201);
});

app.put("/api/user/profile", async (c) => {
  const email = getRequesterEmail(c);
  const json = await c.req.json().catch(() => null);
  const parsed = UpdateUserProfileSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid profile payload", details: parsed.error.issues }, 400);
  }

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfile(email);
  if (parsed.data.name !== undefined) profile.name = parsed.data.name;
  if (parsed.data.bio !== undefined) profile.bio = parsed.data.bio;
  profile.updatedAt = new Date().toISOString();
  await db.putUserProfile(profile);
  return c.json(profile);
});

app.post("/api/user/avatar", async (c) => {
  const email = getRequesterEmail(c);
  const oversized = rejectOversizedRequest(c, MAX_AVATAR_SIZE + 64 * 1024, "Avatar file exceeds maximum 5MB limit");
  if (oversized) return oversized;
  const cleanEmail = email.toLowerCase().trim();
  const body = await c.req.parseBody();
  const file = body["avatar"] as File | undefined;
  if (!file) return c.json({ error: "No avatar image provided" }, 400);

  // Validate avatar file size (max 5 MB)
  if (file.size > MAX_AVATAR_SIZE) {
    return c.json({ error: "Avatar file exceeds maximum 5MB limit" }, 413);
  }

  // Validate avatar MIME type
  if (!file.type || !ALLOWED_AVATAR_MIMES.includes(file.type)) {
    return c.json({ error: "Invalid image format. Allowed: PNG, JPEG, WEBP, GIF" }, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const mimeType = file.type || "image/png";

  // Dual-write to unencoded and encoded keys for total robustness
  await c.env.CLOCEAN_STORAGE.put(`workspaces/default/avatars/${cleanEmail}.png`, arrayBuffer, {
    httpMetadata: { contentType: mimeType },
  });
  await c.env.CLOCEAN_STORAGE.put(`workspaces/default/avatars/${encodeURIComponent(cleanEmail)}.png`, arrayBuffer, {
    httpMetadata: { contentType: mimeType },
  });

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfile(cleanEmail);
  profile.avatar = `/api/user/avatar/${encodeURIComponent(cleanEmail)}?t=${Date.now()}`;
  profile.updatedAt = new Date().toISOString();
  await db.putUserProfile(profile);

  return c.json(profile);
});

app.get("/api/user/avatar/:email", async (c) => {
  const param = c.req.param("email");
  if (!param || param.includes("/") || param.includes("\\") || param.includes("..")) {
    return c.json({ error: "Invalid email parameter" }, 400);
  }
  const cleanEmail = decodeURIComponent(param).toLowerCase().trim();
  if (cleanEmail.includes("/") || cleanEmail.includes("\\") || cleanEmail.includes("..")) {
    return c.json({ error: "Invalid email parameter" }, 400);
  }

  let object = await c.env.CLOCEAN_STORAGE.get(`workspaces/default/avatars/${cleanEmail}.png`);
  if (!object) {
    object = await c.env.CLOCEAN_STORAGE.get(`workspaces/default/avatars/${encodeURIComponent(cleanEmail)}.png`);
  }
  if (!object) {
    object = await c.env.CLOCEAN_STORAGE.get(`workspaces/default/avatars/${param}.png`);
  }
  if (!object) {
    return c.redirect(
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanEmail)}`
    );
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; img-src 'self'; sandbox;");
  const hasBody = "body" in object && object.body;
  return new Response(hasBody ? object.body : null, { headers, status: hasBody ? 200 : 304 });
});

app.delete("/api/user/account", async (c) => {
  const email = getRequesterEmail(c);
  const cleanEmail = email.toLowerCase().trim();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfileIfExists(cleanEmail);
  if (!profile) {
    return c.json({ error: "User account not found" }, 404);
  }

  await db.deleteUserAccount(cleanEmail);

  return c.json(
    {
      success: true,
      message: `Account for ${cleanEmail} has been permanently deleted.`,
    },
    200
  );
});

app.delete("/api/user", async (c) => {
  const email = getRequesterEmail(c);
  const cleanEmail = email.toLowerCase().trim();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfileIfExists(cleanEmail);
  if (!profile) {
    return c.json({ error: "User account not found" }, 404);
  }

  await db.deleteUserAccount(cleanEmail);

  return c.json(
    {
      success: true,
      message: `Account for ${cleanEmail} has been permanently deleted.`,
    },
    200
  );
});

// --- Organization & Team Workspace Endpoints ---
app.get("/api/workspaces", async (c) => {
  const email = getRequesterEmail(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const workspaces = await db.getUserWorkspaces(email);
  return c.json(workspaces);
});

app.post("/api/workspaces", async (c) => {
  const email = getRequesterEmail(c);
  const json = await c.req.json().catch(() => null);
  const parsed = CreateWorkspaceSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "Workspace name is required" }, 400);
  }
  const body = parsed.data;
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const profile = await db.getUserProfile(email);
  const meta = await db.createWorkspace(
    body.name,
    body.icon || "layers",
    email,
    profile.name
  );
  return c.json({ ...meta, role: "owner" }, 201);
});

app.get("/api/workspaces/:wsId/members", async (c) => {
  const wsId = c.req.param("wsId");
  if (!isValidId(wsId)) return c.json({ error: "Invalid workspace ID" }, 400);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const members = await db.getWorkspaceMembers(wsId);
  return c.json(members);
});

app.get("/api/workspaces/:wsId/invite-info", async (c) => {
  const wsId = c.req.param("wsId");
  if (!isValidId(wsId)) return c.json({ error: "Invalid workspace ID" }, 400);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const meta = await db.getWorkspaceMetadata(wsId);
  if (!meta) return c.json({ error: "Workspace not found" }, 404);
  const members = await db.getWorkspaceMembers(wsId);
  const owner = members.find((m) => m.role === "owner") || members[0];
  return c.json({
    id: meta.id,
    name: meta.name,
    icon: meta.icon,
    memberCount: members.length,
    ownerName: owner ? owner.name : "A team member",
  });
});

app.post("/api/workspaces/:wsId/join", async (c) => {
  const wsId = c.req.param("wsId");
  if (!isValidId(wsId)) return c.json({ error: "Invalid workspace ID" }, 400);
  const email = getRequesterEmail(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const meta = await db.getWorkspaceMetadata(wsId);
  if (!meta) return c.json({ error: "Workspace not found" }, 404);
  const members = await db.getWorkspaceMembers(wsId);
  const user = await db.getUserProfile(email);
  const invitedMember = members.find((member) => member.email.toLowerCase() === email.toLowerCase());
  if (!invitedMember) {
    return c.json({ error: "A valid invitation is required to join this workspace" }, 403);
  }
  await db.addWorkspaceMember(wsId, email, user.name, "member");
  const workspaces = await db.getUserWorkspaces(email);
  const joinedWs = workspaces.find((w) => w.id === wsId) || {
    id: wsId,
    name: meta.name,
    icon: meta.icon,
    role: "member",
  };
  return c.json({
    success: true,
    workspace: joinedWs,
    workspaces,
  });
});

app.post("/api/workspaces/:wsId/members", async (c) => {
  const wsId = c.req.param("wsId");
  if (!isValidId(wsId)) return c.json({ error: "Invalid workspace ID" }, 400);
  const requesterEmail = getRequesterEmail(c);

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const currentMembers = await db.getWorkspaceMembers(wsId);
  const requester = currentMembers.find(
    (m) => m.email.toLowerCase() === requesterEmail.toLowerCase()
  );

  if (requester && requester.role !== "owner" && requester.role !== "admin") {
    return c.json({ error: "Only workspace owners and admins can invite members" }, 403);
  }
  if (!requester && wsId !== "default") {
    return c.json({ error: "Only workspace owners and admins can invite members" }, 403);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = InviteMemberSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "Valid email is required" }, 400);
  }
  const body = parsed.data;

  await db.addWorkspaceMember(
    wsId,
    body.email,
    body.name || body.email.split("@")[0],
    body.role || "member"
  );

  const wsMeta = await db.getWorkspaceMetadata(wsId);
  const senderProfile = await db.getUserProfile(requesterEmail);
  const memberSender = currentMembers.find(
    (m) => m.email.toLowerCase() === requesterEmail.toLowerCase()
  );
  const senderName = memberSender?.name || senderProfile.name;
  const senderAvatar = memberSender?.avatar || senderProfile.avatar;

  // Dispatch rich invitation email to invitee
  const inviteNotification: MentionNotification = {
    id: `invite-${crypto.randomUUID()}`,
    workspaceId: wsId,
    workspaceName: wsMeta?.name || "Clocean Workspace",
    type: "invite",
    inviteRole: body.role || "member",
    sender: {
      name: senderName,
      email: requesterEmail,
      avatar: senderAvatar,
    },
    recipientEmail: body.email.trim(),
    recipientName: body.name || body.email.split("@")[0],
    contextSnippet: `You have been invited by ${senderName} to collaborate in ${
      wsMeta?.name || "Clocean Workspace"
    } as ${body.role === "admin" ? "an Admin" : "a Member"}.`,
    timestamp: "Just now",
    emailStatus: "delivered",
    read: false,
  };
  await dispatchMentionNotification(c.env, db, inviteNotification, getAppUrl(c));

  await db.appendActivity(wsId, {
    title: `${senderName} invited ${body.email.trim()} as ${body.role || "member"}`,
    type: "doc",
    user: senderName,
  });

  const updated = await db.getWorkspaceMembers(wsId);
  return c.json(updated);
});

app.put("/api/workspaces/:wsId/members/:email/role", async (c) => {
  const wsId = c.req.param("wsId");
  if (!isValidId(wsId)) return c.json({ error: "Invalid workspace ID" }, 400);

  const targetEmail = decodeURIComponent(c.req.param("email")).trim();
  if (!targetEmail || !targetEmail.includes("@")) {
    return c.json({ error: "Invalid target email" }, 400);
  }

  const requesterEmail = getRequesterEmail(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const currentMembers = await db.getWorkspaceMembers(wsId);
  const requester = currentMembers.find(
    (m) => m.email.toLowerCase() === requesterEmail.toLowerCase()
  );

  // Must be owner or admin to change roles
  if (requester && requester.role !== "owner" && requester.role !== "admin") {
    return c.json({ error: "Only workspace owners and admins can update member roles" }, 403);
  }
  if (!requester && wsId !== "default") {
    return c.json({ error: "Only workspace owners and admins can update member roles" }, 403);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = UpdateMemberRoleSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Role must be 'admin' or 'member'" }, 400);
  }
  const body = parsed.data;

  const result = await db.updateWorkspaceMemberRole(wsId, targetEmail, body.role);
  if (!result.success) {
    return c.json({ error: result.error || "Failed to update member role" }, 400);
  }

  return c.json(result.members);
});

// R2-backed Notion-style databases. All routes inherit workspace membership middleware above.
app.get("/api/databases", async (c) => {
  const store = new DatabaseStore(new R2Database(c.env.CLOCEAN_STORAGE));
  return c.json({ databases: await store.list(getWorkspaceId(c)) });
});

app.post("/api/databases", async (c) => {
  const oversized = rejectOversizedRequest(c, 32 * 1024);
  if (oversized) return oversized;
  const parsed = CreateDatabaseSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid database schema", details: parsed.error.issues }, 400);
  try {
    const schema = await new DatabaseStore(new R2Database(c.env.CLOCEAN_STORAGE)).create(getWorkspaceId(c), parsed.data.name, parsed.data.properties, getRequesterEmail(c));
    return c.json(schema, 201);
  } catch (error) {
    if (error instanceof DatabaseConflictError) return c.json({ error: error.message }, 409);
    return c.json({ error: "Failed to create database" }, 500);
  }
});

app.get("/api/databases/:databaseId/records", async (c) => {
  const databaseId = c.req.param("databaseId");
  if (!isValidId(databaseId)) return c.json({ error: "Invalid database ID" }, 400);
  const query = c.req.query("q")?.slice(0, 100);
  const sort = c.req.query("sort");
  const direction = c.req.query("dir") === "desc" ? "desc" : "asc";
  const result = await new DatabaseStore(new R2Database(c.env.CLOCEAN_STORAGE)).listRecords(getWorkspaceId(c), databaseId, query, sort, direction);
  if (!result) return c.json({ error: "Database not found" }, 404);
  return c.json(result);
});

app.post("/api/databases/:databaseId/records", async (c) => {
  const databaseId = c.req.param("databaseId");
  if (!isValidId(databaseId)) return c.json({ error: "Invalid database ID" }, 400);
  const oversized = rejectOversizedRequest(c, 64 * 1024);
  if (oversized) return oversized;
  const parsed = DatabaseRecordPayloadSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid database record", details: parsed.error.issues }, 400);
  try {
    const record = await new DatabaseStore(new R2Database(c.env.CLOCEAN_STORAGE)).createRecord(getWorkspaceId(c), databaseId, parsed.data, getRequesterEmail(c));
    if (!record) return c.json({ error: "Database not found" }, 404);
    return c.json(record, 201);
  } catch (error) {
    if (error instanceof DatabaseValidationError) return c.json({ error: error.message }, 400);
    if (error instanceof DatabaseConflictError) return c.json({ error: error.message }, 409);
    return c.json({ error: "Failed to create database record" }, 500);
  }
});

app.delete("/api/databases/:databaseId/records/:recordId", async (c) => {
  const databaseId = c.req.param("databaseId");
  const recordId = c.req.param("recordId");
  if (!isValidId(databaseId) || !isValidId(recordId)) return c.json({ error: "Invalid database or record ID" }, 400);
  try {
    const deleted = await new DatabaseStore(new R2Database(c.env.CLOCEAN_STORAGE)).deleteRecord(getWorkspaceId(c), databaseId, recordId);
    return deleted ? c.json({ ok: true }) : c.json({ error: "Record not found" }, 404);
  } catch (error) {
    if (error instanceof DatabaseConflictError) return c.json({ error: error.message }, 409);
    return c.json({ error: "Failed to delete database record" }, 500);
  }
});

// Workspace Tree Endpoints
app.get("/api/tree", async (c) => {
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  return c.json(data || { workspaceId: ws, nodes: [], updatedAt: new Date().toISOString() });
});

app.post("/api/tree/node", async (c) => {
  const ws = getWorkspaceId(c);
  const json = await c.req.json().catch(() => null);
  const parsed = CreateTreeNodeSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid tree node payload", details: parsed.error.issues }, 400);
  }

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data, etag } = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  if (!data) return c.json({ error: "Tree not found" }, 404);

  const body = parsed.data;
  const newNode: TreeNode = {
    id: body.id && isValidId(body.id) ? body.id : `node-${crypto.randomUUID()}`,
    name: sanitizeFilename(body.name),
    type: body.type,
    parentId: body.parentId || null,
    size: body.size || 0,
    mimeType: body.mimeType,
    updatedAt: "Just now",
    createdAt: new Date().toISOString(),
    tags: body.tags || [],
  };

  data.nodes.unshift(newNode);
  data.updatedAt = new Date().toISOString();

  // If creating a doc, also initialize its content.json in R2
  if (newNode.type === "doc") {
    const docData: DocContent = {
      id: newNode.id,
      title: newNode.name,
      tags: newNode.tags || [],
      content: "",
      updatedAt: new Date().toISOString(),
      attachments: [],
    };
    await db.putJson(`workspaces/${ws}/docs/${newNode.id}/content.json`, docData);
  }

  const write = await db.putJson(`workspaces/${ws}/tree.json`, data, etag || undefined);
  if (!write.ok) return c.json({ error: "Workspace changed concurrently; please retry" }, 409);
  return c.json(newNode);
});

app.put("/api/tree/node/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid node ID parameter" }, 400);
  const ws = getWorkspaceId(c);

  const json = await c.req.json().catch(() => null);
  const parsed = UpdateTreeNodeSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid tree node update payload", details: parsed.error.issues }, 400);
  }

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data, etag } = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  if (!data) return c.json({ error: "Tree not found" }, 404);

  const node = data.nodes.find((n) => n.id === id);
  if (!node) return c.json({ error: "Node not found" }, 404);

  const body = parsed.data;
  if (body.name) node.name = sanitizeFilename(body.name);
  if (body.parentId !== undefined) node.parentId = body.parentId;
  if (body.tags) node.tags = body.tags;
  node.updatedAt = "Just now";

  const write = await db.putJson(`workspaces/${ws}/tree.json`, data, etag || undefined);
  if (!write.ok) return c.json({ error: "Workspace changed concurrently; please retry" }, 409);
  return c.json(node);
});

app.delete("/api/tree/node/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid node ID parameter" }, 400);
  const ws = getWorkspaceId(c);

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data, etag } = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  if (!data) return c.json({ error: "Tree not found" }, 404);

  data.nodes = data.nodes.filter((n) => n.id !== id);
  data.updatedAt = new Date().toISOString();

  const write = await db.putJson(`workspaces/${ws}/tree.json`, data, etag || undefined);
  if (!write.ok) return c.json({ error: "Workspace changed concurrently; please retry" }, 409);
  return c.json({ success: true, deletedId: id });
});

// Document Content Endpoints
app.get("/api/docs/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid document ID parameter" }, 400);
  const ws = getWorkspaceId(c);

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<DocContent>(`workspaces/${ws}/docs/${id}/content.json`);
  if (!data) {
    // If not found, return empty template
    return c.json({
      id,
      title: "Untitled Document",
      tags: [],
      content: "",
      updatedAt: new Date().toISOString(),
      attachments: [],
    });
  }
  return c.json(data);
});

app.put("/api/docs/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid document ID parameter" }, 400);
  const ws = getWorkspaceId(c);
  const json = await c.req.json().catch(() => null);
  const parsed = SaveDocSchema.partial().safeParse(json);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "Invalid document payload" }, 400);
  }
  const body = parsed.data;
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const existingRes = await db.getJson<DocContent>(`workspaces/${ws}/docs/${id}/content.json`);
  const existing = existingRes.data;

  const rawTitle = body.title ?? existing?.title ?? "Untitled";
  const safeTitle = sanitizeFilename(rawTitle).slice(0, 200);

  const updatedDoc: DocContent = {
    id,
    title: safeTitle,
    tags: body.tags ?? existing?.tags ?? [],
    content: (body.content ?? existing?.content ?? "").slice(0, 5 * 1024 * 1024), // Max 5 MB markdown
    updatedAt: new Date().toISOString(),
    attachments: body.attachments ?? existing?.attachments ?? [],
    icon: body.icon ?? existing?.icon,
    cover: body.cover ?? existing?.cover,
    isPublic: body.isPublic ?? existing?.isPublic,
    publicToken: body.publicToken ?? existing?.publicToken,
  };

  const docWrite = await db.putJson(
    `workspaces/${ws}/docs/${id}/content.json`,
    updatedDoc,
    existingRes.etag || undefined
  );
  if (!docWrite.ok) return c.json({ error: "Document changed concurrently; please retry" }, 409);

  // Sync title & icon in tree
  const treeRes = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  if (treeRes.data) {
    const node = treeRes.data.nodes.find((n) => n.id === id);
    if (node) {
      let treeChanged = false;
      if (node.name !== updatedDoc.title) {
        node.name = updatedDoc.title;
        treeChanged = true;
      }
      if (updatedDoc.icon && node.icon !== updatedDoc.icon) {
        node.icon = updatedDoc.icon;
        treeChanged = true;
      }
      if (treeChanged) {
        node.updatedAt = "Just now";
        const treeWrite = await db.putJson(`workspaces/${ws}/tree.json`, treeRes.data, treeRes.etag || undefined);
        if (!treeWrite.ok) return c.json({ error: "Workspace changed concurrently; please retry" }, 409);
      }
    }
  }

  // Save revision snapshot if content changed and non-empty
  if (body.content !== undefined && body.content !== existing?.content && updatedDoc.content.trim().length > 0) {
    const senderEmail = getRequesterEmail(c);
    const senderProfile = await db.getUserProfile(senderEmail);
    const revId = `rev-${Date.now()}`;
    const newRev: DocRevision = {
      id: revId,
      timestamp: new Date().toISOString(),
      title: safeTitle,
      author: {
        name: senderProfile.name,
        email: senderEmail,
        avatar: senderProfile.avatar,
      },
      snippet: updatedDoc.content.slice(0, 120).trim(),
      content: updatedDoc.content,
    };
    await db.putJson(`workspaces/${ws}/docs/${id}/revisions/${revId}.json`, newRev);
    const revListRes = await db.getJson<DocRevisionsData>(`workspaces/${ws}/docs/${id}/revisions.json`);
    const revList = revListRes.data || { docId: id, revisions: [] };
    revList.revisions = [newRev, ...revList.revisions].slice(0, 25);
    await db.putJson(`workspaces/${ws}/docs/${id}/revisions.json`, revList);
  }

  // Detect @ mentions in document content and dispatch email notifications to mentioned teammates
  if (body.content) {
    const senderEmail = getRequesterEmail(c);
    const members = await db.getWorkspaceMembers(ws);
    const newMentions = extractMentions(body.content, members, senderEmail);
    const existingMentions = existing?.content ? extractMentions(existing.content, members, senderEmail) : [];
    const existingEmails = new Set(existingMentions.map((m) => m.email.toLowerCase()));

    const newlyMentioned = newMentions.filter((m) => !existingEmails.has(m.email.toLowerCase()));
    if (newlyMentioned.length > 0) {
      const wsMeta = await db.getWorkspaceMetadata(ws);
      const senderProfile = await db.getUserProfile(senderEmail);
      for (const member of newlyMentioned) {
        const notif: MentionNotification = {
          id: `notif-${crypto.randomUUID()}`,
          workspaceId: ws,
          workspaceName: wsMeta?.name || "Clocean Main",
          documentId: id,
          documentTitle: safeTitle,
          sender: {
            name: senderProfile.name,
            email: senderEmail,
            avatar: senderProfile.avatar,
          },
          recipientEmail: member.email,
          recipientName: member.name,
          contextSnippet: body.content.slice(0, 160).trim(),
          timestamp: "Just now",
          emailStatus: "delivered",
          read: false,
        };
        await dispatchMentionNotification(c.env, db, notif, getAppUrl(c));
        await db.appendActivity(ws, {
          title: `${senderProfile.name} mentioned @${member.name} in "${safeTitle}"`,
          type: "doc",
          user: senderProfile.name,
        });
      }
    }
  }

  return c.json(updatedDoc);
});

// Document Revisions Endpoints
app.get("/api/docs/:id/revisions", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid document ID parameter" }, 400);
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const res = await db.getJson<DocRevisionsData>(`workspaces/${ws}/docs/${id}/revisions.json`);
  return c.json(res.data?.revisions || []);
});

app.post("/api/docs/:id/revisions/:revId/restore", async (c) => {
  const id = c.req.param("id");
  const revId = c.req.param("revId");
  if (!isValidId(id) || !isValidId(revId)) return c.json({ error: "Invalid ID parameter" }, 400);
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const revRes = await db.getJson<DocRevision>(`workspaces/${ws}/docs/${id}/revisions/${revId}.json`);
  if (!revRes.data) return c.json({ error: "Revision not found" }, 404);

  const docRes = await db.getJson<DocContent>(`workspaces/${ws}/docs/${id}/content.json`);
  const doc = docRes.data || {
    id,
    title: revRes.data.title,
    tags: [],
    content: revRes.data.content,
    updatedAt: new Date().toISOString(),
    attachments: [],
  };
  doc.content = revRes.data.content;
  doc.title = revRes.data.title;
  doc.updatedAt = new Date().toISOString();
  const restoreWrite = await db.putJson(`workspaces/${ws}/docs/${id}/content.json`, doc, docRes.etag || undefined);
  if (!restoreWrite.ok) return c.json({ error: "Document changed concurrently; please retry" }, 409);
  return c.json(doc);
});

// Document Public Sharing Endpoints
app.post("/api/docs/:id/share", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid document ID parameter" }, 400);
  const ws = getWorkspaceId(c);
  const json = await c.req.json().catch(() => null);
  const parsed = ShareDocSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "isPublic boolean is required" }, 400);
  }
  const body = parsed.data;
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const docRes = await db.getJson<DocContent>(`workspaces/${ws}/docs/${id}/content.json`);
  if (!docRes.data) return c.json({ error: "Document not found" }, 404);

  const doc = docRes.data;
  const previousToken = doc.publicToken;
  doc.isPublic = !!body.isPublic;
  if (doc.isPublic && !doc.publicToken) {
    doc.publicToken = `pub-${crypto.randomUUID().replace(/-/g, "")}`;
  }
  const shareWrite = await db.putJson(`workspaces/${ws}/docs/${id}/content.json`, doc, docRes.etag || undefined);
  if (!shareWrite.ok) return c.json({ error: "Document changed concurrently; please retry" }, 409);

  if (doc.isPublic && doc.publicToken) {
    await db.putJson(`public/shares/${doc.publicToken}.json`, {
      workspaceId: ws,
      docId: id,
    });
  } else if (!doc.isPublic && previousToken) {
    // Clean up public share lookup index when sharing is revoked
    await db.deleteKey(`public/shares/${previousToken}.json`);
  }
  return c.json({ isPublic: doc.isPublic, publicToken: doc.publicToken });
});

// Public Read-Only Endpoint (Exempt from Auth)
app.get("/api/public/docs/:token", async (c) => {
  const token = c.req.param("token");
  if (!isValidId(token)) return c.json({ error: "Invalid share token" }, 400);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const lookup = await db.getJson<{ workspaceId: string; docId: string }>(`public/shares/${token}.json`);
  if (!lookup.data) return c.json({ error: "Public document not found or sharing disabled" }, 404);

  const { workspaceId, docId } = lookup.data;
  const docRes = await db.getJson<DocContent>(`workspaces/${workspaceId}/docs/${docId}/content.json`);
  if (!docRes.data || !docRes.data.isPublic || docRes.data.publicToken !== token) {
    return c.json({ error: "Public document not found or sharing disabled" }, 404);
  }

  // Return strictly public metadata: zero leakage of internal ids, members, or comments
  return c.json({
    id: docRes.data.id,
    title: docRes.data.title,
    content: docRes.data.content,
    tags: docRes.data.tags || [],
    icon: docRes.data.icon,
    cover: docRes.data.cover,
    updatedAt: docRes.data.updatedAt,
  });
});

// Workspace Favorites Endpoints
app.get("/api/workspaces/:ws/favorites", async (c) => {
  const ws = c.req.param("ws") || getWorkspaceId(c);
  if (!isValidId(ws)) return c.json({ error: "Invalid workspace ID" }, 400);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const res = await db.getJson<WorkspaceFavoritesData>(`workspaces/${ws}/favorites.json`);
  return c.json(res.data?.docIds || []);
});

app.post("/api/workspaces/:ws/favorites", async (c) => {
  const ws = c.req.param("ws") || getWorkspaceId(c);
  if (!isValidId(ws)) return c.json({ error: "Invalid workspace ID" }, 400);

  const json = await c.req.json().catch(() => null);
  const parsed = ToggleFavoriteSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid favorites payload", details: parsed.error.issues }, 400);
  }
  if (!isValidId(parsed.data.docId)) return c.json({ error: "Invalid doc ID" }, 400);

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const res = await db.getJson<WorkspaceFavoritesData>(`workspaces/${ws}/favorites.json`);
  const favs = res.data || { workspaceId: ws, docIds: [] };
  if (favs.docIds.includes(parsed.data.docId)) {
    favs.docIds = favs.docIds.filter((id) => id !== parsed.data.docId);
  } else {
    favs.docIds.push(parsed.data.docId);
  }
  const favoriteWrite = await db.putJson(`workspaces/${ws}/favorites.json`, favs, res.etag || undefined);
  if (!favoriteWrite.ok) return c.json({ error: "Favorites changed concurrently; please retry" }, 409);
  return c.json(favs.docIds);
});

// Document Comments & Discussions Endpoints
app.get("/api/docs/:id/comments", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid document ID parameter" }, 400);
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const res = await db.getJson<DocCommentsData>(`workspaces/${ws}/docs/${id}/comments.json`);
  return c.json(res.data?.comments || []);
});

app.post("/api/docs/:id/comments", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id)) return c.json({ error: "Invalid document ID parameter" }, 400);
  const ws = getWorkspaceId(c);
  const senderEmail = getRequesterEmail(c);

  const json = await c.req.json().catch(() => null);
  const parsed = AddCommentSchema.extend({ documentTitle: z.string().optional() }).safeParse(json);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "Comment text is required" }, 400);
  }
  const body = parsed.data;

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const senderProfile = await db.getUserProfile(senderEmail);
  const members = await db.getWorkspaceMembers(ws);
  const memberSender = members.find((m) => m.email.toLowerCase() === senderEmail.toLowerCase());
  const senderName = memberSender?.name || senderProfile.name;
  const senderAvatar = memberSender?.avatar || senderProfile.avatar;
  const wsMeta = await db.getWorkspaceMetadata(ws);
  const docRes = await db.getJson<DocContent>(`workspaces/${ws}/docs/${id}/content.json`);
  const docTitle = body.documentTitle || docRes.data?.title || "Document";

  const mentioned = extractMentions(body.text, members, senderEmail);
  const comment: DocComment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    docId: id,
    user: {
      name: senderName,
      email: senderEmail,
      avatar: senderAvatar,
    },
    text: body.text.trim(),
    mentions: mentioned.map((m) => m.email),
    createdAt: new Date().toISOString(),
  };

  const commentsKey = `workspaces/${ws}/docs/${id}/comments.json`;
  const existingComments = await db.getJson<DocCommentsData>(commentsKey);
  const list = existingComments.data?.comments || [];
  list.push(comment);
  const commentWrite = await db.putJson(commentsKey, { docId: id, comments: list }, existingComments.etag || undefined);
  if (!commentWrite.ok) return c.json({ error: "Comments changed concurrently; please retry" }, 409);

  // Dispatch email notifications to all mentioned teammates
  for (const member of mentioned) {
    const notif: MentionNotification = {
      id: `notif-${crypto.randomUUID()}`,
      workspaceId: ws,
      workspaceName: wsMeta?.name || "Clocean Main",
      documentId: id,
      documentTitle: docTitle,
      sender: {
        name: senderName,
        email: senderEmail,
        avatar: senderAvatar,
      },
      recipientEmail: member.email,
      recipientName: member.name,
      contextSnippet: body.text.trim(),
      timestamp: "Just now",
      emailStatus: "delivered",
      read: false,
    };
    await dispatchMentionNotification(c.env, db, notif, getAppUrl(c));
  }

  await db.appendActivity(ws, {
    title: `${senderProfile.name} commented on "${docTitle}"`,
    type: "doc",
    user: senderProfile.name,
  });

  return c.json(comment, 201);
});

// Notifications Endpoints
app.get("/api/notifications", async (c) => {
  const email = getRequesterEmail(c);
  const cleanEmail = email.toLowerCase().trim();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  let res = await db.getJson<UserNotificationsData>(`workspaces/registry/users/${cleanEmail}/notifications.json`);
  if (!res.data) {
    res = await db.getJson<UserNotificationsData>(`workspaces/registry/users/${encodeURIComponent(cleanEmail)}/notifications.json`);
  }
  return c.json(res.data?.notifications || []);
});

app.put("/api/notifications/read", async (c) => {
  const email = getRequesterEmail(c);
  const cleanEmail = email.toLowerCase().trim();
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const key1 = `workspaces/registry/users/${cleanEmail}/notifications.json`;
  const key2 = `workspaces/registry/users/${encodeURIComponent(cleanEmail)}/notifications.json`;
  let res = await db.getJson<UserNotificationsData>(key1);
  if (!res.data) {
    res = await db.getJson<UserNotificationsData>(key2);
  }
  if (res.data) {
    res.data.notifications.forEach((n) => (n.read = true));
    await db.putJson(key1, res.data);
    await db.putJson(key2, res.data);
  }
  return c.json({ success: true });
});

app.post("/api/notifications/mention", async (c) => {
  const ws = getWorkspaceId(c);
  const senderEmail = getRequesterEmail(c);
  const json = await c.req.json().catch(() => null);
  const parsed = MentionNotificationPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Text and documentId are required" }, 400);
  }
  const body = parsed.data;

  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const members = await db.getWorkspaceMembers(ws);
  const senderProfile = await db.getUserProfile(senderEmail);
  const memberSender = members.find((m) => m.email.toLowerCase() === senderEmail.toLowerCase());
  const senderName = memberSender?.name || senderProfile.name;
  const senderAvatar = memberSender?.avatar || senderProfile.avatar;
  const wsMeta = await db.getWorkspaceMetadata(ws);
  const mentioned = extractMentions(body.text, members, senderEmail);

  const dispatched: MentionNotification[] = [];
  for (const member of mentioned) {
    const lines = body.text.split("\n");
    const matchedLine =
      lines.find(
        (l) =>
          l.toLowerCase().includes(member.email.toLowerCase()) ||
          l.toLowerCase().includes(member.name.toLowerCase())
      ) || body.text.slice(0, 150);

    const notification: MentionNotification = {
      id: `notif-${crypto.randomUUID()}`,
      workspaceId: ws,
      workspaceName: wsMeta?.name || "Clocean Main",
      documentId: body.documentId,
      documentTitle: body.documentTitle || "Document",
      sender: {
        name: senderName,
        email: senderEmail,
        avatar: senderAvatar,
      },
      recipientEmail: member.email,
      recipientName: member.name,
      contextSnippet: matchedLine.trim(),
      timestamp: "Just now",
      emailStatus: "delivered",
      read: false,
    };

    await dispatchMentionNotification(c.env, db, notification, getAppUrl(c));
    dispatched.push(notification);

    await db.appendActivity(ws, {
      title: `${senderProfile.name} mentioned @${member.name} in "${body.documentTitle || "Document"}"`,
      type: "doc",
      user: senderProfile.name,
    });
  }

  return c.json({ dispatched: dispatched.length, notifications: dispatched });
});

app.post("/api/notifications/test", async (c) => {
  const ws = getWorkspaceId(c);
  const senderEmail = getRequesterEmail(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const wsMeta = await db.getWorkspaceMetadata(ws);
  const senderProfile = await db.getUserProfile(senderEmail);

  const testNotification: MentionNotification = {
    id: `notif-test-${crypto.randomUUID()}`,
    workspaceId: ws,
    workspaceName: wsMeta?.name || "Clocean Workspace",
    type: "test",
    sender: {
      name: senderProfile.name,
      email: senderEmail,
      avatar: senderProfile.avatar,
    },
    recipientEmail: senderEmail,
    recipientName: senderProfile.name,
    contextSnippet:
      "This is a test notification verifying that your Clocean email notification engine is properly configured.",
    timestamp: "Just now",
    emailStatus: "delivered",
    read: false,
  };

  const result = await dispatchMentionNotification(
    c.env,
    db,
    testNotification,
    getAppUrl(c)
  );
  return c.json({ success: true, notification: testNotification, deliveryStatus: result.status });
});

// Drive File Upload & Streaming
app.post("/api/upload", async (c) => {
  const oversized = rejectOversizedRequest(c, MAX_FILE_SIZE + 64 * 1024);
  if (oversized) return oversized;
  const body = await c.req.parseBody();
  const file = body["file"] as File | undefined;
  if (!file) {
    return c.json({ error: "No file provided in form data" }, 400);
  }

  // Security: Enforce maximum file upload size (100 MB)
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: "File exceeds maximum 100MB limit" }, 413);
  }

  const ws = getWorkspaceId(c);
  const fileId = `file-${crypto.randomUUID()}`;
  // Security: Sanitize filename to prevent R2 path traversal
  const filename = sanitizeFilename(file.name || "uploaded_file");
  const r2Key = `workspaces/${ws}/files/${fileId}/${filename}`;

  // Stream file directly to R2 bucket
  await c.env.CLOCEAN_STORAGE.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  // Record node in tree
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data, etag } = await db.getJson<WorkspaceTree>(`workspaces/${ws}/tree.json`);
  const newNode: TreeNode = {
    id: fileId,
    name: filename,
    type: "file",
    parentId: null,
    size: file.size,
    mimeType: file.type,
    updatedAt: "Just now",
    createdAt: new Date().toISOString(),
    r2Key,
  };

  if (data) {
    data.nodes.unshift(newNode);
    const treeWrite = await db.putJson(`workspaces/${ws}/tree.json`, data, etag || undefined);
    if (!treeWrite.ok) return c.json({ error: "Workspace changed concurrently; please retry" }, 409);
  }

  // If image, also record in photos gallery in R2
  if (file.type && file.type.startsWith("image/")) {
    const photosRes = await db.getJson<PhotosData>(`workspaces/${ws}/photos.json`);
    if (photosRes.data) {
      photosRes.data.photos.unshift({
        id: fileId,
        name: filename.replace(/\.[^/.]+$/, ""),
        url: `/api/files/${fileId}/${encodeURIComponent(filename)}`,
        size: file.size,
        album: "Uploads",
        uploadedAt: "Just now",
      });
      await db.putJson(`workspaces/${ws}/photos.json`, photosRes.data);
    }
  }

  // Also record in activity log
  const email = getRequesterEmail(c);
  const user = await db.getUserProfile(email);
  const actRes = await db.getJson<ActivitiesData>(`workspaces/${ws}/activity.json`);
  if (actRes.data) {
    actRes.data.activities.unshift({
      id: `act-${crypto.randomUUID()}`,
      title: filename,
      type: "file",
      timestamp: "Just now",
      user: user.name,
    });
    await db.putJson(`workspaces/${ws}/activity.json`, actRes.data);
  }

  return c.json({
    id: fileId,
    name: filename,
    size: file.size,
    mimeType: file.type,
    url: `/api/files/${fileId}/${encodeURIComponent(filename)}`,
  });
});

// Stream file from R2 with XSS sandboxing & security headers
app.get("/api/files/:id/:filename", async (c) => {
  const { id, filename } = c.req.param();

  // Security: Validate file ID and sanitize filename
  if (!isValidId(id)) {
    return c.json({ error: "Invalid file ID parameter" }, 400);
  }

  const ws = getWorkspaceId(c);
  const safeFilename = sanitizeFilename(decodeURIComponent(filename));
  const r2Key = `workspaces/${ws}/files/${id}/${safeFilename}`;

  let object = await c.env.CLOCEAN_STORAGE.get(r2Key, {
    range: c.req.raw.headers,
    onlyIf: c.req.raw.headers,
  });

  if (!object) {
    return c.json({ error: "File not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  // Security Headers: Prevent stored XSS and MIME sniffing
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "sandbox; default-src 'none';");
  headers.set("X-Frame-Options", "SAMEORIGIN");

  // Only allow inline disposition for safe non-executable formats (images & PDF)
  const ext = safeFilename.toLowerCase().slice(safeFilename.lastIndexOf("."));
  const isInlineSafe = SAFE_INLINE_EXTENSIONS.includes(ext);
  const dispositionType = isInlineSafe ? "inline" : "attachment";
  headers.set("Content-Disposition", `${dispositionType}; filename="${safeFilename.replace(/["\r\n\\]/g, "")}"`);

  const bodyStream = "body" in object ? (object as R2ObjectBody).body : null;
  return new Response(bodyStream, {
    headers,
    status: bodyStream ? 200 : 304,
  });
});

// Kanban Tasks
app.get("/api/task-boards", async (c) => {
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const key = `workspaces/${ws}/task-boards.json`;
  const existing = await db.getJson<{ boards: TaskBoard[] }>(key);
  if (existing.data?.boards) return c.json(existing.data.boards);
  const current = await db.getJson<TasksData>(`workspaces/${ws}/tasks.json`);
  const now = new Date().toISOString();
  const board: TaskBoard = { id: "default", name: "Sprint board", createdAt: now, updatedAt: now };
  await db.putJson(key, { boards: [board] });
  if (current.data) await db.putJson(`workspaces/${ws}/task-boards/default.json`, current.data);
  return c.json([board]);
});

app.post("/api/task-boards", async (c) => {
  const json = await c.req.json().catch(() => null) as { name?: unknown } | null;
  const name = typeof json?.name === "string" ? json.name.trim().slice(0, 100) : "";
  if (!name) return c.json({ error: "Board name is required" }, 400);
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const key = `workspaces/${ws}/task-boards.json`;
  const current = await db.getJson<{ boards: TaskBoard[] }>(key);
  const now = new Date().toISOString();
  const board: TaskBoard = { id: `board-${crypto.randomUUID()}`, name, createdAt: now, updatedAt: now };
  const write = await db.putJson(key, { boards: [...(current.data?.boards || []), board] }, current.etag || undefined);
  if (!write.ok) return c.json({ error: "Workspace changed concurrently; please retry" }, 409);
  await db.putJson(`workspaces/${ws}/task-boards/${board.id}.json`, { tasks: [], updatedAt: now });
  return c.json(board, 201);
});

app.get("/api/tasks", async (c) => {
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const boardId = c.req.query("boardId") || "default";
  if (boardId !== "default") {
    const registry = await db.getJson<{ boards: TaskBoard[] }>(`workspaces/${ws}/task-boards.json`);
    if (!registry.data?.boards.some((board) => board.id === boardId)) {
      return c.json({ error: "Task board not found" }, 404);
    }
  }
  const key = boardId === "default" ? `workspaces/${ws}/tasks.json` : `workspaces/${ws}/task-boards/${boardId}.json`;
  const { data } = await db.getJson<TasksData>(key);
  return c.json(data?.tasks || []);
});

app.put("/api/tasks", async (c) => {
  const ws = getWorkspaceId(c);
  const json = await c.req.json().catch(() => null);
  const parsed = z.array(TaskItemSchema).safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid tasks array payload" }, 400);
  }
  const tasks = parsed.data;
  const senderEmail = getRequesterEmail(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const boardId = c.req.query("boardId") || "default";
  if (boardId !== "default") {
    const registry = await db.getJson<{ boards: TaskBoard[] }>(`workspaces/${ws}/task-boards.json`);
    if (!registry.data?.boards.some((board) => board.id === boardId)) {
      return c.json({ error: "Task board not found" }, 404);
    }
  }
  const tasksKey = boardId === "default" ? `workspaces/${ws}/tasks.json` : `workspaces/${ws}/task-boards/${boardId}.json`;
  const existing = await db.getJson<TasksData>(tasksKey);
  const previousTasks = existing.data?.tasks || [];
  const prevMap = new Map<string, TaskItem>(previousTasks.map((t) => [t.id, t]));

  const members = await db.getWorkspaceMembers(ws);
  const wsMeta = await db.getWorkspaceMetadata(ws);
  const senderProfile = await db.getUserProfile(senderEmail);
  const memberSender = members.find((m) => m.email.toLowerCase() === senderEmail.toLowerCase());
  const senderName = memberSender?.name || senderProfile.name;
  const senderAvatar = memberSender?.avatar || senderProfile.avatar;

  // Detect newly added or updated tasks with @ mentions or assignee assignments
  for (const task of tasks) {
    const prev = prevMap.get(task.id);
    const combinedText = `${task.title} ${task.description || ""}`;
    const mentions = extractMentions(combinedText, members, senderEmail);

    // Also check if an assignee is set who is not the sender and wasn't previously assigned
    const assigneeEmail =
      typeof task.assignee === "object" && task.assignee !== null
        ? task.assignee.email?.toLowerCase()
        : typeof task.assignee === "string" && task.assignee.includes("@")
        ? task.assignee.toLowerCase()
        : undefined;
    const prevAssigneeRaw = prev?.assignee as any;
    const prevAssigneeEmail =
      typeof prevAssigneeRaw === "object" && prevAssigneeRaw !== null
        ? prevAssigneeRaw.email?.toLowerCase()
        : typeof prevAssigneeRaw === "string" && prevAssigneeRaw.includes("@")
        ? prevAssigneeRaw.toLowerCase()
        : undefined;
    const isNewAssignee =
      assigneeEmail &&
      assigneeEmail !== senderEmail.toLowerCase() &&
      assigneeEmail !== prevAssigneeEmail;

    const notifiedEmails = new Set<string>();

    for (const member of mentions) {
      notifiedEmails.add(member.email.toLowerCase());
      const notif: MentionNotification = {
        id: `notif-task-${crypto.randomUUID()}`,
        workspaceId: ws,
        workspaceName: wsMeta?.name || "Clocean Workspace",
        type: "task",
        taskId: task.id,
        taskTitle: task.title,
        sender: {
          name: senderName,
          email: senderEmail,
          avatar: senderAvatar,
        },
        recipientEmail: member.email,
        recipientName: member.name,
        contextSnippet: task.title,
        timestamp: "Just now",
        emailStatus: "delivered",
        read: false,
      };
      await dispatchMentionNotification(c.env, db, notif, getAppUrl(c));
    }

    if (isNewAssignee && !notifiedEmails.has(assigneeEmail)) {
      const assignedMember = members.find((m) => m.email.toLowerCase() === assigneeEmail);
      if (assignedMember) {
        const notif: MentionNotification = {
          id: `notif-task-${crypto.randomUUID()}`,
          workspaceId: ws,
          workspaceName: wsMeta?.name || "Clocean Workspace",
          type: "task",
          taskId: task.id,
          taskTitle: task.title,
          sender: {
            name: senderName,
            email: senderEmail,
            avatar: senderAvatar,
          },
          recipientEmail: assignedMember.email,
          recipientName: assignedMember.name,
          contextSnippet: `Assigned to: "${task.title}"`,
          timestamp: "Just now",
          emailStatus: "delivered",
          read: false,
        };
        await dispatchMentionNotification(c.env, db, notif, getAppUrl(c));
      }
    }
  }

  const taskWrite = await db.putJson(tasksKey, {
    tasks,
    updatedAt: new Date().toISOString(),
  }, existing.etag || undefined);
  if (!taskWrite.ok) return c.json({ error: "Tasks changed concurrently; please retry" }, 409);
  return c.json({ success: true, count: tasks.length });
});

// Check deadlines and dispatch email alerts for tasks due soon
app.post("/api/tasks/check-deadlines", async (c) => {
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const wsMeta = await db.getWorkspaceMetadata(ws);
  const workspaceTitle = wsMeta?.name || "Clocean Workspace";

  const result = await db.checkWorkspaceDeadlines(ws);

  for (const task of result.alerted) {
    if (task.assignee && task.assignee.email) {
      const notif: MentionNotification = {
        id: `notif-deadline-${crypto.randomUUID()}`,
        workspaceId: ws,
        workspaceName: workspaceTitle,
        taskId: task.id,
        taskTitle: task.title,
        type: "deadline",
        sender: {
          name: "Clocean Deadlines",
          email: c.env.EMAIL_FROM || "notifications@clocean.co",
          avatar: "https://api.dicebear.com/7.x/initials/svg?seed=Clocean",
        },
        recipientEmail: task.assignee.email,
        recipientName: task.assignee.name || task.assignee.email,
        contextSnippet: `Deadline alert: "${task.title}" is due ${task.dueDate}. Priority: ${task.priority || "normal"}.`,
        timestamp: "Just now",
        emailStatus: "sent",
        read: false,
      };
      await dispatchMentionNotification(c.env, db, notif, getAppUrl(c));
    }
  }

  return c.json({
    success: true,
    workspaceId: ws,
    checkedCount: result.checked,
    alertedCount: result.alerted.length,
    alertedTasks: result.alerted,
  });
});

// Photos Gallery
app.get("/api/photos", async (c) => {
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<PhotosData>(`workspaces/${ws}/photos.json`);
  return c.json(data?.photos || []);
});

// Activity Feed
app.get("/api/activity", async (c) => {
  const ws = getWorkspaceId(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const { data } = await db.getJson<ActivitiesData>(`workspaces/${ws}/activity.json`);
  return c.json(data?.activities || []);
});

// Durable Object Real-Time Multi-Editing WebSocket Route (Hardened with CSWSH protection)
app.get("/api/collab/:docId", async (c) => {
  const docId = c.req.param("docId");

  // Security: Validate document ID
  if (!isValidId(docId)) {
    return c.text("Invalid document ID", 400);
  }

  // Security: Cross-Site WebSocket Hijacking (CSWSH) protection
  const origin = c.req.header("origin");
  if (!isAllowedOrigin(origin, c.req.url, c.env)) {
    return c.text("Forbidden: Cross-Site WebSocket Hijacking blocked", 403);
  }

  const ws = getWorkspaceId(c);
  const email = getRequesterEmail(c);
  const db = new R2Database(c.env.CLOCEAN_STORAGE);
  const user = await db.getUserProfile(email);

  // Route to Durable Object named by workspaceId:docId
  const roomId = `${ws}:${docId}`;
  const id = c.env.DOC_SESSION.idFromName(roomId);
  const stub = c.env.DOC_SESSION.get(id);

  const url = new URL(c.req.url);
  const queryName = url.searchParams.get("name");
  url.searchParams.set("workspaceId", ws);
  url.searchParams.set("docId", docId);
  url.searchParams.set("email", user.email);
  url.searchParams.set("name", queryName ? sanitizeFilename(queryName).slice(0, 60) : user.name);
  url.searchParams.set("avatar", user.avatar);

  const request = new Request(url.toString(), c.req.raw);
  return stub.fetch(request);
});

// Static Assets fallback for Cloudflare Pages / Workers static assets
app.get("*", async (c) => {
  if (c.env.ASSETS) {
    return applySecurityHeaders(await c.env.ASSETS.fetch(c.req.raw));
  }
  return applySecurityHeaders(c.text("Clocean API Gateway Active", 200));
});

export default app;
