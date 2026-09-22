import { describe, it, expect } from "vitest";
import { signSessionToken, verifySessionToken } from "../worker/auth/session.ts";

describe("Cryptographic Session Token Engine", () => {
  it("should sign and verify a session token for a valid email", () => {
    const email = "sarah.connor@sky.net";
    const token = signSessionToken(email);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe(email);
  });

  it("should reject a tampered session token payload", () => {
    const email = "legit@clocean.co";
    const token = signSessionToken(email);
    const parts = token.split(".");

    // Tamper with payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ email: "hacker@evil.com", exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const verified = verifySessionToken(tamperedToken);
    expect(verified).toBeNull();
  });

  it("should reject an invalid or malformed token", () => {
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("invalid-token")).toBeNull();
    expect(verifySessionToken("a.b")).toBeNull();
    expect(verifySessionToken("a.b.c.d")).toBeNull();
  });

  it("should support custom secrets", () => {
    const email = "custom@clocean.co";
    const customSecret = "super-secret-key-12345";
    const token = signSessionToken(email, customSecret);

    // Fails with default secret
    expect(verifySessionToken(token)).toBeNull();
    // Succeeds with matching secret
    expect(verifySessionToken(token, customSecret)?.email).toBe(email);
  });
});
