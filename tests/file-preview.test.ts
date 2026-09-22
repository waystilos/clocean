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
});
