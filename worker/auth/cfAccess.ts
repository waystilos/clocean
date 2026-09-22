export interface AuthIdentity {
  email: string;
}

export function getAuthEmail(
  request: Request,
  env?: { ENVIRONMENT?: string; CF_ACCESS_AUD?: string }
): string | null {
  const isProduction = env?.ENVIRONMENT === "production";

  // 1. Cloudflare Access Identity header from Zero Trust
  const cfEmail = request.headers.get("cf-access-authenticated-user-email");
  const cfJwt = request.headers.get("cf-access-jwt-assertion");

  // In production, verify JWT assertion and AUD tag if CF_ACCESS_AUD is configured
  if (isProduction && env?.CF_ACCESS_AUD) {
    if (!cfJwt) return null;
    try {
      const parts = cfJwt.split(".");
      if (parts.length !== 3) return null;
      const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(atob(payloadBase64));

      const audMatches = Array.isArray(claims.aud)
        ? claims.aud.includes(env.CF_ACCESS_AUD)
        : claims.aud === env.CF_ACCESS_AUD;
      if (!audMatches) return null;

      if (claims.exp && typeof claims.exp === "number" && claims.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      if (claims.email && typeof claims.email === "string") {
        return claims.email.toLowerCase().trim();
      }
    } catch {
      return null;
    }
  }

  if (cfEmail) {
    return cfEmail.toLowerCase().trim();
  }

  // In production, strictly reject dev overrides and require valid Cloudflare Zero Trust authentication
  if (isProduction) {
    return null;
  }

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

  // Local development default
  return "alex@clocean.co";
}

export function requireAuth(
  request: Request,
  env?: { ENVIRONMENT?: string; CF_ACCESS_AUD?: string }
): { email: string } | Response {
  const email = getAuthEmail(request, env);
  if (!email) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Cloudflare Zero Trust identity token required in production",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  return { email };
}

