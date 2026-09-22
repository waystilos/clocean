import { describe, it, expect } from "vitest";

const BASE_URL = "http://127.0.0.1:8787";

describe("Account Lifecycle: Duplicate Prevention and Account Deletion", () => {
  const lifecycleEmail = `user-lifecycle-${Date.now()}@example.com`;
  let otpCode = "";
  let sessionToken = "";

  it("should permit initial signup via OTP verification", async () => {
    // 1. Send OTP for signup
    const sendRes = await fetch(`${BASE_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: lifecycleEmail,
        purpose: "setup",
        name: "Lifecycle User",
        workspaceName: "Lifecycle Space",
      }),
    });

    expect(sendRes.status).toBe(200);
    const sendData = (await sendRes.json()) as any;
    expect(sendData.success).toBe(true);
    expect(sendData.devVerificationCode).toBeDefined();
    otpCode = sendData.devVerificationCode;

    // 2. Verify OTP and complete setup
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: lifecycleEmail,
        code: otpCode,
        purpose: "setup",
        name: "Lifecycle User",
        workspaceName: "Lifecycle Space",
      }),
    });

    expect(verifyRes.status).toBe(200);
    const verifyData = (await verifyRes.json()) as any;
    expect(verifyData.authenticated).toBe(true);
    expect(verifyData.token).toBeDefined();
    sessionToken = verifyData.token;
    expect(verifyData.user.email).toBe(lifecycleEmail);
    expect(verifyData.workspace.name).toBe("Lifecycle Space");
  });

  it("should prevent the same email from signing up twice via /api/auth/send-otp", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: lifecycleEmail,
        purpose: "setup",
        name: "Duplicate User",
        workspaceName: "Duplicate Space",
      }),
    });

    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.accountExists).toBe(true);
    expect(data.error).toContain("already exists");
  });

  it("should prevent the same email from signing up twice via /api/setup", async () => {
    const res = await fetch(`${BASE_URL}/api/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-unauth": "true" },
      body: JSON.stringify({
        name: "Duplicate Via Direct Setup",
        email: lifecycleEmail,
        workspaceName: "Duplicate Direct Space",
      }),
    });

    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.accountExists).toBe(true);
    expect(data.error).toContain("already exists");
  });

  it("should allow the existing user to sign in normally", async () => {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-unauth": "true" },
      body: JSON.stringify({ email: lifecycleEmail }),
    });

    expect(loginRes.status).toBe(200);
    const loginData = (await loginRes.json()) as any;
    expect(loginData.authenticated).toBe(true);
    expect(loginData.user.email).toBe(lifecycleEmail);
  });

  it("should reject account deletion when unauthenticated", async () => {
    const res = await fetch(`${BASE_URL}/api/user/account`, {
      method: "DELETE",
      headers: { "x-test-unauth": "true" },
    });
    expect(res.status).toBe(401);
  });

  it("should reject account deletion for a non-existent account with 404", async () => {
    const res = await fetch(`${BASE_URL}/api/user/account?user=nobody-nowhere-${Date.now()}@example.com`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("should permanently delete user account via DELETE /api/user/account", async () => {
    const res = await fetch(`${BASE_URL}/api/user/account`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "x-user-email": lifecycleEmail,
      },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.message).toContain("permanently deleted");
  });

  it("should confirm the user account is wiped after deletion", async () => {
    // Attempting login must now indicate setup is required
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-unauth": "true" },
      body: JSON.stringify({ email: lifecycleEmail }),
    });

    expect(loginRes.status).toBe(200);
    const data = (await loginRes.json()) as any;
    expect(data.authenticated).toBe(false);
    expect(data.setupRequired).toBe(true);

    // Attempting to delete again must return 404
    const deleteAgain = await fetch(`${BASE_URL}/api/user/account?user=${encodeURIComponent(lifecycleEmail)}`, {
      method: "DELETE",
    });
    expect(deleteAgain.status).toBe(404);
  });

  it("should allow the same email to sign up again as a fresh account after deletion", async () => {
    // 1. Send OTP for new setup with the deleted email
    const sendRes = await fetch(`${BASE_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: lifecycleEmail,
        purpose: "setup",
        name: "Reborn User",
        workspaceName: "New Workspace",
      }),
    });

    expect(sendRes.status).toBe(200);
    const sendData = (await sendRes.json()) as any;
    expect(sendData.success).toBe(true);
    expect(sendData.devVerificationCode).toBeDefined();

    // 2. Verify OTP to complete new account registration
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: lifecycleEmail,
        code: sendData.devVerificationCode,
        purpose: "setup",
        name: "Reborn User",
        workspaceName: "New Workspace",
      }),
    });

    expect(verifyRes.status).toBe(200);
    const verifyData = (await verifyRes.json()) as any;
    expect(verifyData.authenticated).toBe(true);
    expect(verifyData.user.name).toBe("Reborn User");
    expect(verifyData.workspace.name).toBe("New Workspace");

    // 3. Now that the account exists again, duplicate signup must once again be blocked
    const duplicateRes = await fetch(`${BASE_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: lifecycleEmail,
        purpose: "setup",
      }),
    });
    expect(duplicateRes.status).toBe(409);
    const duplicateData = (await duplicateRes.json()) as any;
    expect(duplicateData.accountExists).toBe(true);
  });
});
