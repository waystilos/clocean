export interface AuthUser {
  email: string;
  name: string;
  avatar: string;
}

const KNOWN_USERS: Record<string, { name: string; avatar: string }> = {
  "alex@clocean.co": {
    name: "Alex Sterling",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  },
  "marcus@clocean.co": {
    name: "Marcus Vance",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  },
  "elena@clocean.co": {
    name: "Elena Rostova",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  },
  "sofia@clocean.co": {
    name: "Sofia Chen",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80",
  },
};

export function getAuthUser(request: Request): AuthUser {
  // 1. Cloudflare Access Identity header
  const cfEmail = request.headers.get("cf-access-authenticated-user-email");
  
  // 2. Custom header or dev query override for testing multiplayer locally
  const url = new URL(request.url);
  const queryUser = url.searchParams.get("user");
  const headerEmail = request.headers.get("x-user-email");

  const email = (cfEmail || headerEmail || (queryUser ? `${queryUser}@clocean.co` : "alex@clocean.co")).toLowerCase();

  const userMeta = KNOWN_USERS[email] || {
    name: email.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`,
  };

  return {
    email,
    name: userMeta.name,
    avatar: userMeta.avatar,
  };
}
