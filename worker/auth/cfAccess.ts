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

