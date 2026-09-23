import React, { useEffect, useState } from "react";
import { FileText, RotateCcw, Upload } from "lucide-react";

const templates = [
  { name: "Meeting notes", description: "Capture decisions and give every action an owner.", content: "# Meeting notes\n\n## Agenda\n\n- Topic\n\n## Decisions\n\n## Action items\n\n- [ ] Action — owner\n" },
  { name: "Project brief", description: "Align your team on the problem, scope, and success criteria.", content: "# Project brief\n\n## Problem\n\n## Goals\n\n## Scope\n\n## Success criteria\n\n## Milestones\n\n- [ ] Kickoff\n" },
  { name: "Weekly plan", description: "Choose priorities and track your progress through the week.", content: "# Weekly plan\n\n## Top priorities\n\n- [ ] First priority\n- [ ] Second priority\n\n## Notes\n\n## End-of-week reflection\n" },
];
type TrashItem = { id: string; name: string; deletedAt: string; count: number };

export function WorkspaceToolsView({ mode, workspaceId, headers, onRefresh, onOpenDoc }: {
  mode: "templates" | "import" | "trash";
  workspaceId: string;
  headers: (extra?: Record<string, string>) => Record<string, string>;
  onRefresh: () => Promise<void>;
  onOpenDoc: (id: string) => void;
}) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = async <T,>(url: string, method = "GET", body?: unknown): Promise<T> => {
    const response = await fetch(url, { method, headers: headers({ "x-workspace-id": workspaceId, "Content-Type": "application/json" }), body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not complete the request. Please try again.");
    return data;
  };
  useEffect(() => {
    let active = true;
    setError(""); setMessage(""); setItems([]);
    if (mode === "trash") {
      setBusy(true);
      request<{ items: TrashItem[] }>("/api/trash").then((data) => { if (active) setItems(data.items); }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setBusy(false); });
    }
    return () => { active = false; };
  }, [workspaceId, mode]);
  const createDoc = async (name: string, content: string) => {
    const node = await request<{ id: string }>("/api/tree/node", "POST", { type: "doc", name });
    try { await request(`/api/docs/${encodeURIComponent(node.id)}`, "PUT", { title: name, content, tags: [], attachments: [] }); }
    catch (err) { throw new Error(`Created “${name}”, but its content could not be saved. Open the page and retry. ${err instanceof Error ? err.message : ""}`); }
    return node.id as string;
  };
  const useTemplate = async (template: typeof templates[number]) => {
    setBusy(true); setError("");
    try { const id = await createDoc(template.name, template.content); await onRefresh(); onOpenDoc(id); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not create page"); await onRefresh(); }
    finally { setBusy(false); }
  };
  const importFiles = async (files: File[]) => {
    setBusy(true); setError(""); setMessage("");
    let imported = 0;
    try {
      for (const file of files) {
        if (!/\.(md|markdown|txt)$/i.test(file.name)) throw new Error(`“${file.name}” is not Markdown or plain text. Upload other formats from Files.`);
        if (file.size > 1024 * 1024) throw new Error(`“${file.name}” exceeds the 1 MB import limit.`);
        await createDoc(file.name.replace(/\.(md|markdown|txt)$/i, ""), await file.text());
        imported++;
        setMessage(`${imported} ${imported === 1 ? "page imported" : "pages imported"}. Find them in Docs.`);
      }
    } catch (err) { setError(`${imported} imported. ${err instanceof Error ? err.message : "Import failed"}`); }
    finally { await onRefresh(); setBusy(false); }
  };
  const restore = async (item: TrashItem) => {
    setBusy(true); setError("");
    try { await request(`/api/trash/${encodeURIComponent(item.id)}/restore`, "POST"); setItems((current) => current.filter((entry) => entry.id !== item.id)); setMessage(`Restored “${item.name}”.`); await onRefresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Restore failed"); }
    finally { setBusy(false); }
  };
  const title = { templates: "Templates", import: "Import pages", trash: "Trash" }[mode];
  return <section className="workspace-tools animate-fade-in">
    <h1 className="font-serif">{title}</h1>
    <p className="view-description">{mode === "templates" ? "Start with a useful structure. Every template becomes a page you can edit." : mode === "import" ? "Turn Markdown and plain-text files into editable pages. Select several files to import them together." : "Deleted pages, files, and folders stay here until you restore them. Restoring a folder also restores its contents."}</p>
    {error && <p role="alert" className="feedback-error">{error}</p>}
    {message && <p role="status" className="feedback-success">{message}</p>}
    {mode === "templates" && <div className="template-grid">{templates.map((template) => <article className="template-card" key={template.name}><FileText size={24} /><h2>{template.name}</h2><p>{template.description}</p><button className="btn-primary" disabled={busy} onClick={() => void useTemplate(template)}>Use template</button></article>)}</div>}
    {mode === "import" && <div className="template-card"><Upload size={24} /><h2>Import Markdown or text</h2><p>.md, .markdown, or .txt · up to 1 MB per file. Each file creates one page. Existing pages are never overwritten.</p><label className="btn-primary">{busy ? "Importing…" : "Choose files"}<input aria-label="Choose files to import" type="file" accept=".md,.markdown,.txt" multiple disabled={busy} onChange={(event) => { void importFiles(Array.from(event.target.files || [])); event.target.value = ""; }} /></label></div>}
    {mode === "trash" && <div aria-busy={busy}>{busy && <p role="status">Loading…</p>}{!busy && !items.length && !error && <div className="template-card"><h2>Trash is empty</h2><p>Items you delete from Docs or Files will appear here.</p></div>}{items.map((item) => <article className="trash-row" key={item.id}><div><strong>{item.name}</strong><p>{item.count} {item.count === 1 ? "item" : "items"} · Deleted {new Date(item.deletedAt).toLocaleDateString()}</p></div><button className="btn-secondary" disabled={busy} onClick={() => void restore(item)}><RotateCcw size={15} />Restore</button></article>)}</div>}
  </section>;
}
