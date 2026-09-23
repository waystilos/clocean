import { describe, expect, it } from "vitest";

const BASE = "http://127.0.0.1:8787";
const json = { "Content-Type": "application/json" };

describe("recoverable workspace Trash", () => {
  it("restores a folder, its page, and the page content", async () => {
    const suffix = crypto.randomUUID();
    const folderResponse = await fetch(`${BASE}/api/tree/node`, {
      method: "POST", headers: json, body: JSON.stringify({ type: "folder", name: `Trash test ${suffix}` }),
    });
    expect(folderResponse.status).toBe(200);
    const folder = await folderResponse.json() as { id: string };

    const pageResponse = await fetch(`${BASE}/api/tree/node`, {
      method: "POST", headers: json, body: JSON.stringify({ type: "doc", parentId: folder.id, name: `Draft ${suffix}` }),
    });
    expect(pageResponse.status).toBe(200);
    const page = await pageResponse.json() as { id: string };
    const content = `Keep this draft ${suffix}`;
    const saveResponse = await fetch(`${BASE}/api/docs/${page.id}`, {
      method: "PUT", headers: json, body: JSON.stringify({ title: `Draft ${suffix}`, content, tags: [], attachments: [] }),
    });
    expect(saveResponse.status).toBe(200);

    const deleteResponse = await fetch(`${BASE}/api/tree/node/${folder.id}`, { method: "DELETE" });
    expect(deleteResponse.status).toBe(200);
    const active = await (await fetch(`${BASE}/api/tree`)).json() as { nodes: { id: string }[] };
    expect(active.nodes.some((node) => node.id === folder.id || node.id === page.id)).toBe(false);
    const trash = await (await fetch(`${BASE}/api/trash`)).json() as { items: { id: string; count: number }[] };
    expect(trash.items).toContainEqual(expect.objectContaining({ id: folder.id, count: 2 }));

    const restoreResponse = await fetch(`${BASE}/api/trash/${folder.id}/restore`, { method: "POST" });
    expect(restoreResponse.status).toBe(200);
    const restored = await (await fetch(`${BASE}/api/tree`)).json() as { nodes: { id: string; parentId: string | null }[] };
    expect(restored.nodes).toContainEqual(expect.objectContaining({ id: folder.id, parentId: null }));
    expect(restored.nodes).toContainEqual(expect.objectContaining({ id: page.id, parentId: folder.id }));
    const doc = await (await fetch(`${BASE}/api/docs/${page.id}`)).json() as { content: string };
    expect(doc.content).toBe(content);
  });
});
