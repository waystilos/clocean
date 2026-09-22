// Vitest test runner client session setup
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  if (url.includes("127.0.0.1:8787/api") || url.includes("localhost:8787/api")) {
    const headers = new Headers(init?.headers);
    // Attach test user session if no user header or query is present and not explicitly unauthenticated
    if (
      !headers.has("x-user-email") &&
      !headers.has("cf-access-authenticated-user-email") &&
      !url.includes("user=") &&
      !url.includes("email=") &&
      !headers.has("x-test-unauth")
    ) {
      headers.set("x-user-email", "tester@clocean.co");
      return originalFetch(input, { ...init, headers });
    }
  }
  return originalFetch(input, init);
};
