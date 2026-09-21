export interface AuthIdentity {
  email: string;
}

export function getAuthEmail(request: Request): string {
  // 1. Cloudflare Access Identity header from Zero Trust
  const cfEmail = request.headers.get("cf-access-authenticated-user-email");
  
  // 2. Custom header or dev query override for testing
  const url = new URL(request.url);
  const queryUser = url.searchParams.get("user");
  const headerEmail = request.headers.get("x-user-email");

  const email = (
    cfEmail ||
    headerEmail ||
    (queryUser ? (queryUser.includes("@") ? queryUser : `${queryUser}@clocean.co`) : "alex@clocean.co")
  ).toLowerCase().trim();

  return email;
}

