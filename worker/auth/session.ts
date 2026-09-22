import crypto from "node:crypto";

const DEFAULT_SECRET = "clocean-edge-auth-secret-key-production-v1";
const SESSION_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface SessionPayload {
  email: string;
  iat: number;
  exp: number;
}

/**
 * Synchronously signs a tamper-proof session JWT using HMAC-SHA256.
 */
export function signSessionToken(
  email: string,
  secret?: string,
  env?: { ENVIRONMENT?: string }
): string {
  if (env?.ENVIRONMENT === "production" && (!secret || secret === DEFAULT_SECRET)) {
    throw new Error("Security Error: In production, a secure SESSION_SECRET must be configured.");
  }
  const secretKey = secret || DEFAULT_SECRET;
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload: SessionPayload = {
    email: email.toLowerCase().trim(),
    iat: now,
    exp: now + SESSION_EXPIRY_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(`${header}.${payloadB64}`)
    .digest("base64url");

  return `${header}.${payloadB64}.${signature}`;
}

/**
 * Synchronously verifies a session JWT using constant-time HMAC comparison.
 */
export function verifySessionToken(
  token: string,
  secret?: string,
  env?: { ENVIRONMENT?: string }
): { email: string } | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  // In production, strictly refuse tokens signed with the public fallback secret
  if (env?.ENVIRONMENT === "production" && (!secret || secret === DEFAULT_SECRET)) {
    return null;
  }

  try {
    const secretKey = secret || DEFAULT_SECRET;
    const expectedSig = crypto
      .createHmac("sha256", secretKey)
      .update(`${parts[0]}.${parts[1]}`)
      .digest("base64url");

    const sigBuf = Buffer.from(parts[2]);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedBuf.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
    const payload: SessionPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }

    if (!payload.email || typeof payload.email !== "string") {
      return null;
    }

    return { email: payload.email.toLowerCase().trim() };
  } catch {
    return null;
  }
}
