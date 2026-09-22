import { describe, it, expect } from "vitest";
import { getAuthEmail } from "../worker/auth/cfAccess.ts";

describe("Cloudflare Access Authentication Handler", () => {
  it("should reject an unverified Cloudflare Access header", async () => {
    const req = new Request("https://clocean.example.com/api/me", {
      headers: {
        "cf-access-authenticated-user-email": "sarah.connor@sky.net",
        "cf-access-jwt-assertion": "mock-jwt-token",
      },
    });

    const email = await getAuthEmail(req, { ENVIRONMENT: "production", CF_ACCESS_AUD: "aud", CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com" });
    expect(email).toBeNull();
  });

  it("should normalize email case and trim whitespace", async () => {
    const req = new Request("https://clocean.example.com/api/me", {
      headers: {
        "cf-access-authenticated-user-email": "  ALEX.STERLING@CLOCEAN.CO  ",
      },
    });

    const email = await getAuthEmail(req, { ENVIRONMENT: "development" });
    expect(email).toBe("alex.sterling@clocean.co");
  });

  it("should support query parameter override for local development and multiplayer testing", async () => {
    const req = new Request("http://127.0.0.1:8787/api/me?user=marcus");
    const email = await getAuthEmail(req, { ENVIRONMENT: "development" });
    expect(email).toBe("marcus@clocean.co");
  });

  it("should support full email in query parameter", async () => {
    const req = new Request("http://127.0.0.1:8787/api/me?user=elena@clocean.co");
    const email = await getAuthEmail(req, { ENVIRONMENT: "development" });
    expect(email).toBe("elena@clocean.co");
  });

  it("should support x-user-email header for API testing", async () => {
    const req = new Request("http://127.0.0.1:8787/api/me", {
      headers: {
        "x-user-email": "sofia@clocean.co",
      },
    });

    const email = await getAuthEmail(req, { ENVIRONMENT: "development" });
    expect(email).toBe("sofia@clocean.co");
  });

  it("should support email query parameter directly", async () => {
    const req = new Request("http://127.0.0.1:8787/api/me?email=marcus@clocean.co");
    const email = await getAuthEmail(req, { ENVIRONMENT: "development" });
    expect(email).toBe("marcus@clocean.co");
  });

  it("should normalize email query parameter case and whitespace", async () => {
    const req = new Request("http://127.0.0.1:8787/api/me?email=%20TESTER@CLOCEAN.CO%20");
    const email = await getAuthEmail(req, { ENVIRONMENT: "development" });
    expect(email).toBe("tester@clocean.co");
  });

  it("should return null when no header or query is present", async () => {
    const req = new Request("http://127.0.0.1:8787/api/me");
    const email = await getAuthEmail(req, { ENVIRONMENT: "development" });
    expect(email).toBeNull();
  });

  describe("Edge Workspace Onboarding & Setup API", () => {
    const BASE_URL = "http://127.0.0.1:8787";
    const setupEmail = `newuser-${Date.now()}@example.com`;

    it("should initialize a new workspace and user profile on /api/setup", async () => {
      const res = await fetch(`${BASE_URL}/api/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-unauth": "true" },
        body: JSON.stringify({
          name: "Ardon Bailey",
          email: setupEmail,
          workspaceName: "Ardon's Lab",
          theme: "dark",
        }),
      });

      expect(res.status).toBe(201);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.user.name).toBe("Ardon Bailey");
      expect(data.user.email).toBe(setupEmail);
      expect(data.workspace.name).toBe("Ardon's Lab");
      expect(data.workspace.role).toBe("owner");
    });

    it("should reject invalid email during setup", async () => {
      const res = await fetch(`${BASE_URL}/api/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-unauth": "true" },
        body: JSON.stringify({
          name: "Invalid User",
          email: "notanemail",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should sign in an existing user on /api/auth/login", async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-unauth": "true" },
        body: JSON.stringify({ email: setupEmail }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.authenticated).toBe(true);
      expect(data.user.email).toBe(setupEmail);
      expect(data.user.name).toBe("Ardon Bailey");
    });

    it("should signal setupRequired for an unauthenticated / unknown user on login", async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-unauth": "true" },
        body: JSON.stringify({ email: `unknown-${Date.now()}@example.com` }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.authenticated).toBe(false);
      expect(data.setupRequired).toBe(true);
    });
  });
});
