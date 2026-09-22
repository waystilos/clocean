import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, Table2, Trash2 } from "lucide-react";
import { DatabaseRecord, DatabaseSchema, UserProfile } from "../types.ts";

interface Props {
  workspaceId: string;
  currentUser: UserProfile;
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>;
}

export const DatabasesView: React.FC<Props> = ({ workspaceId, currentUser, getAuthHeaders }) => {
  const [databases, setDatabases] = useState<DatabaseSchema[]>([]);
  const [selected, setSelected] = useState<DatabaseSchema | null>(null);
  const [records, setRecords] = useState<DatabaseRecord[]>([]);
  const [search, setSearch] = useState("");
  const [newDatabaseName, setNewDatabaseName] = useState("");
  const [newRecordTitle, setNewRecordTitle] = useState("");
  const [error, setError] = useState("");

  const headers = (json = false) => getAuthHeaders({ "x-workspace-id": workspaceId, ...(json ? { "Content-Type": "application/json" } : {}) });
  const loadDatabases = async () => {
    const response = await fetch("/api/databases", { headers: headers() });
    if (!response.ok) throw new Error("Could not load databases");
    const data = await response.json() as { databases: DatabaseSchema[] };
    setDatabases(data.databases);
    if (!selected && data.databases[0]) setSelected(data.databases[0]);
  };
  const loadRecords = async (database: DatabaseSchema) => {
    const query = search ? `?q=${encodeURIComponent(search)}` : "";
    const response = await fetch(`/api/databases/${encodeURIComponent(database.id)}/records${query}`, { headers: headers() });
    if (!response.ok) throw new Error("Could not load records");
    const data = await response.json() as { records: DatabaseRecord[] };
    setRecords(data.records);
  };

  useEffect(() => { loadDatabases().catch((e) => setError(e.message)); }, [workspaceId]);
  useEffect(() => { if (selected) loadRecords(selected).catch((e) => setError(e.message)); }, [selected, search]);

  const createDatabase = async () => {
    if (!newDatabaseName.trim()) return;
    const response = await fetch("/api/databases", { method: "POST", headers: headers(true), body: JSON.stringify({
      name: newDatabaseName.trim(),
      properties: [
        { id: "status", name: "Status", type: "select", options: ["Not started", "In progress", "Done"] },
        { id: "due_date", name: "Due date", type: "date" },
      ],
    }) });
    if (!response.ok) { setError("Could not create database"); return; }
    const database = await response.json() as DatabaseSchema;
    setDatabases((items) => [...items, database]); setSelected(database); setNewDatabaseName("");
  };
  const createRecord = async () => {
    if (!selected || !newRecordTitle.trim()) return;
    const response = await fetch(`/api/databases/${encodeURIComponent(selected.id)}/records`, { method: "POST", headers: headers(true), body: JSON.stringify({ title: newRecordTitle.trim(), properties: {} }) });
    if (response.status === 409) { setError("This database changed in another tab. Reload and try again."); return; }
    if (!response.ok) { setError("Could not create record"); return; }
    setNewRecordTitle(""); await loadRecords(selected);
  };
  const deleteRecord = async (id: string) => {
    if (!selected) return;
    const response = await fetch(`/api/databases/${encodeURIComponent(selected.id)}/records/${encodeURIComponent(id)}`, { method: "DELETE", headers: headers() });
    if (response.status === 409) { setError("This database changed in another tab. Reload and try again."); return; }
    if (response.ok) setRecords((items) => items.filter((record) => record.id !== id));
  };
  const columns = useMemo(() => selected?.properties ?? [], [selected]);

  return <div className="animate-fade-in" style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 24 }}>
      <div><h1 className="font-serif" style={{ margin: 0, fontSize: 32 }}>Databases</h1><p style={{ color: "var(--text-secondary)", marginTop: 8 }}>Structured workspace data stored securely in R2.</p></div>
      <div style={{ display: "flex", gap: 8 }}><input value={newDatabaseName} maxLength={100} onChange={(e) => setNewDatabaseName(e.target.value)} placeholder="New database" aria-label="New database name" /><button className="btn-primary" onClick={createDatabase}><Plus size={16} /> Create</button></div>
    </div>
    {error && <div role="alert" style={{ color: "var(--danger, #b42318)", marginBottom: 16 }}>{error}</div>}
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
      <aside style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 12 }}><strong style={{ padding: 8, display: "block" }}>Your databases</strong>{databases.map((database) => <button key={database.id} onClick={() => setSelected(database)} style={{ display: "flex", gap: 8, width: "100%", textAlign: "left", padding: 10, border: 0, borderRadius: 8, color: "var(--text-primary)", background: selected?.id === database.id ? "var(--bg-secondary)" : "transparent" }}><Table2 size={16} />{database.name}</button>)}{databases.length === 0 && <span style={{ padding: 8, color: "var(--text-secondary)", fontSize: 13 }}>Create your first database.</span>}</aside>
      <section style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}>{selected ? <><div style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--border-subtle)" }}><h2 style={{ margin: 0, fontSize: 20 }}>{selected.name}</h2><div style={{ display: "flex", gap: 8 }}><label style={{ display: "flex", alignItems: "center", gap: 6 }}><Search size={15} /><input value={search} maxLength={100} onChange={(e) => setSearch(e.target.value)} placeholder="Filter rows" aria-label="Filter rows" /></label><input value={newRecordTitle} maxLength={200} onChange={(e) => setNewRecordTitle(e.target.value)} placeholder="New row" aria-label="New row title" /><button className="btn-primary" onClick={createRecord}><Plus size={16} /> Add</button></div></div><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th style={{ textAlign: "left", padding: 12 }}>Name</th>{columns.map((column) => <th key={column.id} style={{ textAlign: "left", padding: 12 }}>{column.name}</th>)}<th /></tr></thead><tbody>{records.map((record) => <tr key={record.id} style={{ borderTop: "1px solid var(--border-subtle)" }}><td style={{ padding: 12 }}>{record.title}</td>{columns.map((column) => <td key={column.id} style={{ padding: 12, color: "var(--text-secondary)" }}>{Array.isArray(record.properties[column.id]) ? (record.properties[column.id] as string[]).join(", ") : String(record.properties[column.id] ?? "")}</td>)}<td style={{ padding: 12, textAlign: "right" }}><button aria-label={`Delete ${record.title}`} onClick={() => deleteRecord(record.id)} style={{ border: 0, background: "transparent", color: "var(--text-secondary)" }}><Trash2 size={16} /></button></td></tr>)}{records.length === 0 && <tr><td colSpan={columns.length + 2} style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>No rows yet.</td></tr>}</tbody></table></div></> : <div style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>Select a database to begin.</div>}</section>
    </div>
    <p style={{ color: "var(--text-tertiary, var(--text-secondary))", fontSize: 12, marginTop: 16 }}>Signed in as {currentUser.email}. Database values are validated by the workspace API.</p>
  </div>;
};
