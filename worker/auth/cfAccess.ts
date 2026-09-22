import { verifySessionToken } from "./session.ts";

export interface AuthIdentity {
  email: string;
}

interface AccessEnv {
  ENVIRONMENT?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_JWKS_URL?: string;
  SESSION_SECRET?: string;
}

interface CfAccessKey extends JsonWebKey {
  kid?: string;
}

let cachedJwks: { expiresAt: number; keys: CfAccessKey[] } | null = null;

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJson(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function verifyCloudflareAccessJwt(token: string, env: AccessEnv): Promise<string | null> {
  if (!env.CF_ACCESS_AUD) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== "number" || claims.exp <= now) return null;
    if (typeof claims.nbf === "number" && claims.nbf > now) return null;

    const aud = claims.aud;
    const audMatches = Array.isArray(aud)
      ? aud.includes(env.CF_ACCESS_AUD)
      : aud === env.CF_ACCESS_AUD;
    if (!audMatches || typeof claims.email !== "string") return null;

    if (env.CF_ACCESS_TEAM_DOMAIN) {
      const expectedIssuer = `https://${env.CF_ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
      if (claims.iss !== expectedIssuer) return null;
    }

    const jwksUrl = env.CF_ACCESS_JWKS_URL ||
      (env.CF_ACCESS_TEAM_DOMAIN
        ? `https://${env.CF_ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "")}/cdn-cgi/access/certs`
        : null);
    if (!jwksUrl) return null;

    if (!cachedJwks || cachedJwks.expiresAt <= Date.now()) {
      const response = await fetch(jwksUrl, { headers: { Accept: "application/json" } });
      if (!response.ok) return null;
      const body = (await response.json()) as { keys?: CfAccessKey[] };
      if (!body.keys?.length) return null;
      cachedJwks = { keys: body.keys, expiresAt: Date.now() + 5 * 60 * 1000 };
    }

    const jwk = cachedJwks.keys.find((key) => key.kid === header.kid);
    if (!jwk) return null;
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signatureBytes = new Uint8Array(decodeBase64Url(parts[2]));
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signatureBytes as BufferSource,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    return valid ? claims.email.toLowerCase().trim() : null;
  } catch {
    return null;
  }
}

export async function getAuthEmail(
  request: Request,
  env?: AccessEnv
): Promise<string | null> {
  const isProduction = env?.ENVIRONMENT === "production";

  // 1. Cryptographic Session Token verification (HMAC-SHA256)
  const authHeader = request.headers.get("authorization");
  let token: string | null = null;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    // Browser WebSocket clients cannot set Authorization headers. Limit the
    // query-token exception to the authenticated collaboration handshake.
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/collab/")) token = url.searchParams.get("token");
    } catch {}
  }

  if (token) {
    const session = verifySessionToken(token, env?.SESSION_SECRET, env);
    if (session) {
      return session.email;
    }
  }

  // 2. Cloudflare Access Identity header from Zero Trust
  const cfEmail = request.headers.get("cf-access-authenticated-user-email");
  const cfJwt = request.headers.get("cf-access-jwt-assertion");

  if (isProduction) {
    return cfJwt ? await verifyCloudflareAccessJwt(cfJwt, env || {}) : null;
  }

  if (cfEmail) return cfEmail.toLowerCase().trim();

  // 2. Development / Testing overrides (only enabled when NOT in production)
  const url = new URL(request.url);
  const queryUser = url.searchParams.get("email") || url.searchParams.get("user");
  const headerEmail = request.headers.get("x-user-email");

  if (headerEmail) {
    return headerEmail.toLowerCase().trim();
  }

  if (queryUser) {
    const cleanUser = queryUser.toLowerCase().trim();
    return cleanUser.includes("@") ? cleanUser : `${cleanUser}@clocean.co`;
  }

  // No authentication credentials provided
  return null;
}

export async function requireAuth(
  request: Request,
  env?: AccessEnv
): Promise<{ email: string } | Response> {
  const email = await getAuthEmail(request, env);
  if (!email) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Authentication required. Please log in or complete workspace setup.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  return { email };
}
