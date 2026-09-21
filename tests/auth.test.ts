import { describe, it, expect } from "vitest";
import { getAuthEmail } from "../worker/auth/cfAccess.ts";

describe("Cloudflare Access Authentication Handler", () => {
  it("should extract user email from Cloudflare Access header in production", () => {
    const req = new Request("https://clocean.example.com/api/me", {
      headers: {
        "cf-access-authenticated-user-email": "sarah.connor@sky.net",
        "cf-access-jwt-assertion": "mock-jwt-token",
      },
    });

    const email = getAuthEmail(req);
    expect(email).toBe("sarah.connor@sky.net");
  });

  it("should normalize email case and trim whitespace", () => {
    const req = new Request("https://clocean.example.com/api/me", {
      headers: {
        "cf-access-authenticated-user-email": "  ALEX.STERLING@CLOCEAN.CO  ",
      },
    });

    const email = getAuthEmail(req);
    expect(email).toBe("alex.sterling@clocean.co");
  });

  it("should support query parameter override for local development and multiplayer testing", () => {
    const req = new Request("http://127.0.0.1:8787/api/me?user=marcus");
    const email = getAuthEmail(req);
    expect(email).toBe("marcus@clocean.co");
  });

  it("should support full email in query parameter", () => {
    const req = new Request("http://127.0.0.1:8787/api/me?user=elena@clocean.co");
    const email = getAuthEmail(req);
    expect(email).toBe("elena@clocean.co");
  });

  it("should support x-user-email header for API testing", () => {
    const req = new Request("http://127.0.0.1:8787/api/me", {
      headers: {
        "x-user-email": "sofia@clocean.co",
      },
    });

    const email = getAuthEmail(req);
    expect(email).toBe("sofia@clocean.co");
  });

  it("should support email query parameter directly", () => {
    const req = new Request("http://127.0.0.1:8787/api/me?email=marcus@clocean.co");
    const email = getAuthEmail(req);
    expect(email).toBe("marcus@clocean.co");
  });

  it("should normalize email query parameter case and whitespace", () => {
    const req = new Request("http://127.0.0.1:8787/api/me?email=%20TESTER@CLOCEAN.CO%20");
    const email = getAuthEmail(req);
    expect(email).toBe("tester@clocean.co");
  });

  it("should fallback to default user when no header or query is present", () => {
    const req = new Request("http://127.0.0.1:8787/api/me");
    const email = getAuthEmail(req);
    expect(email).toBe("alex@clocean.co");
  });
});
