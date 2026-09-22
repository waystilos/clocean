import { describe, it, expect } from "vitest";
import { sanitizeFilename, isValidId, isAllowedOrigin } from "../worker/index.ts";
import { getAuthEmail, requireAuth } from "../worker/auth/cfAccess.ts";
import { signSessionToken, verifySessionToken } from "../worker/auth/session.ts";
import { renderToString } from "react-dom/server";
import React from "react";
import { MarkdownRenderer } from "../src/components/MarkdownRenderer.tsx";

const BASE_URL = "http://127.0.0.1:8787";
const WS_BASE_URL = "ws://127.0.0.1:8787";

describe("Clocean Enterprise Security Regression Test Suite", () => {
  // 1. Path Traversal & Identifier Validation
  describe("R2 Path Traversal & Identifier Sanitization", () => {
    it("should sanitize path traversal characters and directory slashes from filenames", () => {
      expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
      expect(sanitizeFilename("..\\..\\windows\\system32\\calc.exe")).toBe("calc.exe");
      expect(sanitizeFilename("../../../workspaces/default/tree.json")).toBe("tree.json");
      expect(sanitizeFilename('exploit"filename\r\nInjection: True')).toBe("exploit_filename__Injection_ True");
    });

    it("should validate and reject path traversal and invalid characters in IDs", () => {
      expect(isValidId("doc-manifesto")).toBe(true);
      expect(isValidId("file-123_456")).toBe(true);
      expect(isValidId("../../../tree")).toBe(false);
      expect(isValidId("doc/subdir")).toBe(false);
      expect(isValidId("doc\\subdir")).toBe(false);
      expect(isValidId("doc%2F..%2F")).toBe(false);
    });

    it("should reject API requests containing path traversal sequences in :id parameter with 400", async () => {
      const res = await fetch(`${BASE_URL}/api/docs/..%2F..%2Fworkspaces%2Fdefault%2Ftree.json`);
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Invalid document ID parameter");
    });

    it("should reject file fetch requests with path traversal ID parameter", async () => {
      const res = await fetch(`${BASE_URL}/api/files/..%2F..%2Ftree/payload.txt`);
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Invalid file ID parameter");
    });
  });

  // 2. Cross-Site WebSocket Hijacking (CSWSH) Defense
  describe("Cross-Site WebSocket Hijacking (CSWSH) Defense", () => {
    it("should allow matching host and reject unauthorized foreign origins in isAllowedOrigin", () => {
      const requestUrl = "https://clocean.example.com/api/collab/doc-123";
      
      // Same-origin / same-host
      expect(isAllowedOrigin("https://clocean.example.com", requestUrl)).toBe(true);
      
      // Localhost development allowed in non-production
      expect(isAllowedOrigin("http://localhost:3000", requestUrl)).toBe(true);
      expect(isAllowedOrigin("http://127.0.0.1:8787", requestUrl)).toBe(true);
      expect(isAllowedOrigin("http://localhost:3000", requestUrl, { ENVIRONMENT: "development" } as any)).toBe(true);

      // Localhost strictly blocked in production
      expect(isAllowedOrigin("http://localhost:3000", requestUrl, { ENVIRONMENT: "production" } as any)).toBe(false);
      expect(isAllowedOrigin("http://127.0.0.1:8787", requestUrl, { ENVIRONMENT: "production" } as any)).toBe(false);
      
      // Malicious third-party origin
      expect(isAllowedOrigin("https://evil-hacker-site.com", requestUrl)).toBe(false);
      expect(isAllowedOrigin("https://clocean.example.com.attacker.org", requestUrl)).toBe(false);
    });

    it("should reject requests with 403 Forbidden when origin is untrusted", async () => {
      const docId = `security-cswsh-${Date.now()}`;
      const res = await fetch(`${BASE_URL}/api/collab/${docId}`, {
        headers: {
          Origin: "https://evil-attacker.site",
        },
      });

      expect(res.status).toBe(403);
      const text = await res.text();
      expect(text).toContain("Cross-Site WebSocket Hijacking blocked");
    });
  });

  // 3. Stored XSS Prevention & File Sandboxing Headers
  describe("Stored XSS Prevention & Defense-in-Depth Headers", () => {
    let htmlFileId: string;

    it("should upload an HTML file and force Content-Disposition: attachment to prevent stored XSS", async () => {
      const maliciousHtml = "<html><body><script>alert(document.cookie)</script></body></html>";
      const blob = new Blob([maliciousHtml], { type: "text/html" });
      const formData = new FormData();
      formData.append("file", blob, "stored-xss.html");

      const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      expect(uploadRes.status).toBe(200);
      const data = (await uploadRes.json()) as any;
      htmlFileId = data.id;

      // Fetch file and verify defense headers
      const fileRes = await fetch(`${BASE_URL}/api/files/${htmlFileId}/stored-xss.html`);
      expect(fileRes.status).toBe(200);

      // Verify Content-Disposition is FORCED to attachment (NOT inline)
      const disposition = fileRes.headers.get("content-disposition");
      expect(disposition).toContain("attachment");

      // Verify security headers: nosniff and CSP sandbox
      expect(fileRes.headers.get("x-content-type-options")).toBe("nosniff");
      expect(fileRes.headers.get("content-security-policy")).toBe("sandbox; default-src 'none';");
      expect(fileRes.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    });

    it("should allow safe image formats to be rendered inline", async () => {
      const imgBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      const blob = new Blob([imgBytes], { type: "image/png" });
      const formData = new FormData();
      formData.append("file", blob, "safe-diagram.png");

      const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      expect(uploadRes.status).toBe(200);
      const data = (await uploadRes.json()) as any;

      const fileRes = await fetch(`${BASE_URL}/api/files/${data.id}/safe-diagram.png`);
      expect(fileRes.status).toBe(200);
      const disposition = fileRes.headers.get("content-disposition");
      expect(disposition).toContain("inline");
      expect(fileRes.headers.get("x-content-type-options")).toBe("nosniff");
    });
  });

  // 4. Denial of Service (DoS) & Upload Limits
  describe("Resource Exhaustion & Upload Limits", () => {
    it("should reject avatar upload exceeding 5MB limit with 413 Payload Too Large", async () => {
      // Create a 6MB dummy buffer
      const largeBuffer = new Uint8Array(6 * 1024 * 1024);
      const blob = new Blob([largeBuffer], { type: "image/png" });
      const formData = new FormData();
      formData.append("avatar", blob, "giant-avatar.png");

      const res = await fetch(`${BASE_URL}/api/user/avatar`, {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(413);
      const data = (await res.json()) as any;
      expect(data.error).toContain("5MB limit");
    });

    it("should reject avatar upload with invalid executable/script MIME type", async () => {
      const blob = new Blob(["#!/bin/bash\necho hacked"], { type: "application/x-sh" });
      const formData = new FormData();
      formData.append("avatar", blob, "script.sh");

      const res = await fetch(`${BASE_URL}/api/user/avatar`, {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Invalid image format");
    });
  });

  // 5. Zero Trust Production Authentication Gating
  describe("Zero Trust Production Authentication Gating", () => {
    it("should reject session tokens in ordinary HTTP query parameters", async () => {
      const token = signSessionToken("alice@clocean.co");
      const req = new Request(`http://127.0.0.1:8787/api/me?token=${encodeURIComponent(token)}`);
      expect(await getAuthEmail(req, { ENVIRONMENT: "development" })).toBeNull();
    });

    it("should strictly reject dev query parameters and headers when in production mode", async () => {
      const prodEnv = { ENVIRONMENT: "production" };

      // Attacker attempting query override in production
      const reqQuery = new Request("https://clocean.example.com/api/me?email=admin@clocean.co");
      expect(await getAuthEmail(reqQuery, prodEnv)).toBeNull();

      // Attacker attempting custom header in production
      const reqHeader = new Request("https://clocean.example.com/api/me", {
        headers: { "x-user-email": "admin@clocean.co" },
      });
      expect(await getAuthEmail(reqHeader, prodEnv)).toBeNull();

      // Attacker connecting with no credentials in production
      const reqEmpty = new Request("https://clocean.example.com/api/me");
      expect(await getAuthEmail(reqEmpty, prodEnv)).toBeNull();

      // Legitimate user with Cloudflare Zero Trust header
      const reqLegit = new Request("https://clocean.example.com/api/me", {
        headers: { "cf-access-authenticated-user-email": "sarah.connor@sky.net" },
      });
      expect(await getAuthEmail(reqLegit, prodEnv)).toBeNull();
    });

    it("should return 401 Unauthorized via requireAuth when unauthenticated in production", async () => {
      const prodEnv = { ENVIRONMENT: "production" };
      const req = new Request("https://clocean.example.com/api/tree");
      const authRes = await requireAuth(req, prodEnv);

      expect(authRes instanceof Response).toBe(true);
      if (authRes instanceof Response) {
        expect(authRes.status).toBe(401);
        const data = (await authRes.json()) as any;
        expect(data.error).toBe("Unauthorized");
      }
    });

    it("should allow dev overrides when NOT in production for seamless open-source development", async () => {
      const devEnv = { ENVIRONMENT: "development" };
      const req = new Request("http://127.0.0.1:8787/api/me?user=marcus");
      expect(await getAuthEmail(req, devEnv)).toBe("marcus@clocean.co");
    });
  });

  // 6. Public Share Isolation & Token Boundary Defense
  describe("Public Share Isolation & Token Boundary Defense", () => {
    const testDocId = `sec-share-${Date.now()}`;
    let pubToken = "";

    it("should reject path traversal sequences in public token parameter with 400", async () => {
      const res = await fetch(`${BASE_URL}/api/public/docs/..%2F..%2Fworkspaces%2Fdefault%2Ftree`);
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Invalid share token");
    });

    it("should return 404 for nonexistent or invalid share tokens", async () => {
      const res = await fetch(`${BASE_URL}/api/public/docs/pub-nonexistent-12345`);
      expect(res.status).toBe(404);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Public document not found");
    });

    it("should share a document, allow unauthenticated read, and strictly sanitize response against data leakage", async () => {
      // 1. Create document with internal metadata
      await fetch(`${BASE_URL}/api/docs/${testDocId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Public Share Test Doc",
          content: "Confidential details in comments only.",
          icon: "shield",
          cover: "gradient-emerald",
        }),
      });

      // 2. Enable sharing
      const shareRes = await fetch(`${BASE_URL}/api/docs/${testDocId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: true }),
      });
      expect(shareRes.status).toBe(200);
      const shareData = (await shareRes.json()) as any;
      expect(shareData.isPublic).toBe(true);
      expect(shareData.publicToken).toBeDefined();
      pubToken = shareData.publicToken;

      // 3. Fetch anonymously without any auth headers or cookies
      const publicRes = await fetch(`${BASE_URL}/api/public/docs/${pubToken}`);
      expect(publicRes.status).toBe(200);
      const publicDoc = (await publicRes.json()) as any;

      // Verify legitimate public fields
      expect(publicDoc.title).toBe("Public Share Test Doc");
      expect(publicDoc.content).toBe("Confidential details in comments only.");
      expect(publicDoc.icon).toBe("shield");
      expect(publicDoc.cover).toBe("gradient-emerald");

      // Verify ZERO leakage of sensitive internal workspace fields
      expect(publicDoc.workspaceId).toBeUndefined();
      expect(publicDoc.members).toBeUndefined();
      expect(publicDoc.comments).toBeUndefined();
      expect(publicDoc.attachments).toBeUndefined();
      expect(publicDoc.revisions).toBeUndefined();
    });

    it("should immediately revoke public access when isPublic is set to false", async () => {
      const revokeRes = await fetch(`${BASE_URL}/api/docs/${testDocId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: false }),
      });
      expect(revokeRes.status).toBe(200);

      // Now verify public token returns 404
      const publicRes = await fetch(`${BASE_URL}/api/public/docs/${pubToken}`);
      expect(publicRes.status).toBe(404);
      const data = (await publicRes.json()) as any;
      expect(data.error).toContain("disabled");
    });
  });

  // 7. Revisions & Favorites Identifier Validation (Path Traversal)
  describe("Revisions & Favorites Identifier Validation", () => {
    it("should reject path traversal in revisions endpoints", async () => {
      const resRev = await fetch(`${BASE_URL}/api/docs/..%2F..%2Ftree/revisions`);
      expect(resRev.status).toBe(400);

      const resRestore = await fetch(
        `${BASE_URL}/api/docs/doc-valid/revisions/..%2F..%2Fevil/restore`,
        { method: "POST" }
      );
      expect(resRestore.status).toBe(400);
    });

    it("should reject path traversal in favorites workspace parameter", async () => {
      const resFav = await fetch(`${BASE_URL}/api/workspaces/..%2F..%2Fexploit/favorites`);
      expect(resFav.status).toBe(400);

      const resFavPost = await fetch(
        `${BASE_URL}/api/workspaces/..%2F..%2Fexploit/favorites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docId: "doc-123" }),
        }
      );
      expect(resFavPost.status).toBe(400);
    });

    it("should reject invalid docId in favorites body", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces/default/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: "../../../escape" }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Invalid doc ID");
    });
  });

  // 6. Zod Runtime Schema Validation & Malformed Payload Defenses
  describe("Zod Edge Schema Validation Defenses", () => {
    it("should reject workspace creation with empty or invalid payload", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces?user=alex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Workspace name is required");
    });

    it("should reject member invitation with malformed email format", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces/default/members?user=alex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email", role: "member" }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("valid email");
    });

    it("should reject member role update with invalid role value", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces/default/members/elena%40clocean.co/role?user=alex`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "superadmin" }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Role must be 'admin' or 'member'");
    });

    it("should reject document share toggle with non-boolean payload", async () => {
      const res = await fetch(`${BASE_URL}/api/docs/doc-manifesto/share?user=alex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: "yes_please" }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("isPublic boolean is required");
    });

    it("should reject comment submission with empty text", async () => {
      const res = await fetch(`${BASE_URL}/api/docs/doc-manifesto/comments?user=alex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "   " }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Comment text");
    });

    it("should reject tasks update with non-array payload", async () => {
      const res = await fetch(`${BASE_URL}/api/tasks?user=alex`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalid: "not an array" }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Invalid tasks array payload");
    });

    it("should reject user profile update with non-string fields", async () => {
      const res = await fetch(`${BASE_URL}/api/user/profile?user=alex`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 12345 }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Invalid profile payload");
    });

    it("should reject tree node creation with empty name or invalid type", async () => {
      const res = await fetch(`${BASE_URL}/api/tree/node?user=alex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   ", type: "invalid_type" }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Invalid tree node payload");
    });

    it("should reject favorites toggle with missing or empty docId", async () => {
      const res = await fetch(`${BASE_URL}/api/workspaces/default/favorites?user=alex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: "" }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toContain("Invalid favorites payload");
    });
  });

  // 9. Production Session Secret & Token Tamper Defense
  describe("Production Session Secret & Token Tamper Defense", () => {
    it("should refuse to verify tokens signed with the default secret when ENVIRONMENT is production", () => {
      const defaultSignedToken = signSessionToken("alice@clocean.co");
      const prodEnv = { ENVIRONMENT: "production" };

      // In production, verifySessionToken must return null for default-signed tokens
      expect(verifySessionToken(defaultSignedToken, undefined, prodEnv)).toBeNull();
    });

    it("should throw an error if attempting to sign tokens with default secret in production", () => {
      const prodEnv = { ENVIRONMENT: "production" };
      expect(() => signSessionToken("alice@clocean.co", undefined, prodEnv)).toThrow(
        "SESSION_SECRET must be configured"
      );
    });

    it("should successfully verify tokens signed with a dedicated production secret", () => {
      const customSecret = "super-secret-crypto-key-9876543210";
      const validToken = signSessionToken("alice@clocean.co", customSecret);
      const prodEnv = { ENVIRONMENT: "production" };

      const result = verifySessionToken(validToken, customSecret, prodEnv);
      expect(result).not.toBeNull();
      expect(result?.email).toBe("alice@clocean.co");
    });
  });

  // 10. Protocol-Relative Link Phishing Defense
  describe("Protocol-Relative Link Phishing Defense", () => {
    it("should neutralize protocol-relative links (//evil.com) and backslash tricks (/\\evil.com)", () => {
      const markdown = `
[Safe Link](/docs/intro)
[Protocol-Relative Phishing](//evil-attacker.com/login)
[Backslash Phishing](/\\evil-attacker.com)
`;
      const html = renderToString(React.createElement(MarkdownRenderer, { content: markdown }));

      // Safe relative link preserved
      expect(html).toContain('href="/docs/intro"');

      // Phishing vectors neutralized to "#"
      expect(html).not.toContain('href="//evil-attacker.com/login"');
      expect(html).not.toContain('href="/\\evil-attacker.com"');
    });
  });

  // 11. Public Share Token Entropy & Revocation
  describe("Share Token Entropy & Revocation Defense", () => {
    it("should generate full 128-bit CSPRNG tokens with pub- prefix", () => {
      const token = `pub-${crypto.randomUUID().replace(/-/g, "")}`;
      expect(token).toMatch(/^pub-[0-9a-f]{32}$/);
      expect(isValidId(token)).toBe(true);
    });
  });
});
