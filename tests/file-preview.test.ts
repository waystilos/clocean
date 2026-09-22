import { describe, expect, it, vi } from "vitest";
import { fetchAuthenticatedFile } from "../src/lib/filePreview.ts";

describe("authenticated file previews", () => {
  it("sends the session token when loading an R2 file", async () => {
    const blob = new Blob(["preview"], { type: "image/png" });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(blob, { status: 200 }));

    const result = await fetchAuthenticatedFile("/api/files/file-1/moodboard.png", "session-token", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith("/api/files/file-1/moodboard.png", {
      credentials: "same-origin",
      headers: { Authorization: "Bearer session-token" },
    });
    expect(result.type).toBe("image/png");
  });

  it("uses the local development identity when no session token is available", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Blob(["image"]), { status: 200 }));

    await fetchAuthenticatedFile("/api/files/file-1/moodboard.png", null, fetchImpl, "tester@clocean.co");

    expect(fetchImpl).toHaveBeenCalledWith("/api/files/file-1/moodboard.png", {
      credentials: "same-origin",
      headers: { "x-user-email": "tester@clocean.co" },
    });
  });

  it("sends the active workspace so custom workspace files resolve from the correct R2 prefix", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Blob(["image"]), { status: 200 }));

    await fetchAuthenticatedFile("/api/files/file-1/moodboard.png", "session-token", fetchImpl, "owner@example.com", "ws-design");

    expect(fetchImpl).toHaveBeenCalledWith("/api/files/file-1/moodboard.png", {
      credentials: "same-origin",
      headers: {
        Authorization: "Bearer session-token",
        "x-user-email": "owner@example.com",
        "x-workspace-id": "ws-design",
      },
    });
  });
});
