import { describe, it, expect } from "vitest";

const BASE_URL = "http://127.0.0.1:8787";

describe("Email Verification OTP Authentication Flow", () => {
  const testEmail = `verify-${Date.now()}@example.com`;
  let activeCode = "";

  it("should send a 6-digit OTP for setup", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        purpose: "setup",
        name: "Verification User",
        workspaceName: "Verified Workspace",
      }),
    });

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.devVerificationCode).toBeDefined();
    expect(data.devVerificationCode.length).toBe(6);
    activeCode = data.devVerificationCode;
  });

  it("should rate-limit rapid subsequent OTP requests for the same email", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        purpose: "setup",
      }),
    });

    expect(res.status).toBe(429);
    const data: any = await res.json();
    expect(data.error).toMatch(/Please wait/i);
  });

  it("should reject an invalid OTP code and report remaining attempts", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        code: "000000",
      }),
    });

    expect(res.status).toBe(400);
    const data: any = await res.json();
    expect(data.error).toMatch(/Invalid code/i);
    expect(data.error).toMatch(/attempts remaining/i);
  });

  it("should verify the valid OTP and issue an authenticated session token", async () => {
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        code: activeCode,
      }),
    });

    expect(verifyRes.status).toBe(200);
    const verifyData: any = await verifyRes.json();
    expect(verifyData.authenticated).toBe(true);
    expect(verifyData.token).toBeDefined();
    expect(verifyData.user.email).toBe(testEmail);
    expect(verifyData.workspace.name).toBe("Verified Workspace");

    // Verify Bearer token grants access to protected /api/me
    const meRes = await fetch(`${BASE_URL}/api/me`, {
      headers: {
        Authorization: `Bearer ${verifyData.token}`,
      },
    });
    expect(meRes.status).toBe(200);
    const meData: any = await meRes.json();
    expect(meData.authenticated).toBe(true);
    expect(meData.email).toBe(testEmail);
  });

  it("should disallow reusing the verified code (replay attack prevention)", async () => {
    const replayRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        code: activeCode,
      }),
    });

    expect(replayRes.status).toBe(400);
    const data: any = await replayRes.json();
    expect(data.error).toMatch(/No pending verification found/i);
  });
});
