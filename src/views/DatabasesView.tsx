import React, { useEffect, useMemo, useState, useRef } from "react";
import { Plus, Search, Table2, Trash2, Calendar, Check, AlertCircle, MoreHorizontal, Rows3, Settings2, X, Save, LayoutGrid, ChevronDown } from "lucide-react";
import { DatabaseProperty, DatabaseRecord, DatabaseSchema, UserProfile } from "../types.ts";
import { CreateDatabaseModal } from "../components/CreateDatabaseModal.tsx";
import { DatabaseCellInput } from "../components/DatabaseCellInput.tsx";

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
  const [newRecordTitle, setNewRecordTitle] = useState("");
  const [error, setError] = useState("");
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordDraft, setRecordDraft] = useState<{ title: string; properties: Record<string, unknown> }>({ title: "", properties: {} });
  const [editingDatabaseName, setEditingDatabaseName] = useState(false);
  const [databaseNameDraft, setDatabaseNameDraft] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const loadVersion = useRef(0);
  const submitting = useRef(false);
  const [isSubmittingRecord, setIsSubmittingRecord] = useState(false);

  const headers = (json = false) =>
    getAuthHeaders({
      "x-workspace-id": workspaceId,
      ...(json ? { "Content-Type": "application/json" } : {}),
    });

  const loadDatabases = async () => {
    setIsLoadingDatabases(true);
    try {
      const response = await fetch("/api/databases", { headers: headers() });
      if (!response.ok) throw new Error("Could not load databases");
      const data = (await response.json()) as { databases: DatabaseSchema[] };
      setDatabases(data.databases);
      setSelected((current) =>
        data.databases.find((database) => database.id === current?.id) ?? data.databases[0] ?? null
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load databases");
    } finally {
      setIsLoadingDatabases(false);
    }
  };

  const loadRecords = async (database: DatabaseSchema) => {
    const version = ++loadVersion.current;
    setIsLoadingRecords(true);
    try {
      const query = search ? `?q=${encodeURIComponent(search)}` : "";
      const response = await fetch(
        `/api/databases/${encodeURIComponent(database.id)}/records${query}`,
        { headers: headers() }
      );
      if (!response.ok) throw new Error("Could not load records");
      const data = (await response.json()) as { records: DatabaseRecord[] };
      if (version !== loadVersion.current) return;
      setRecords(data.records);
    } catch (err: unknown) {
      if (version === loadVersion.current) setError(err instanceof Error ? err.message : "Failed to load records");
    } finally {
      if (version === loadVersion.current) setIsLoadingRecords(false);
    }
  };

  useEffect(() => {
    setSelected(null);
    setRecords([]);
    setError("");
    loadDatabases();
  }, [workspaceId]);

  useEffect(() => {
    if (selected) {
      setRecords([]);
      loadRecords(selected);
    }
    return () => { loadVersion.current++; };
  }, [selected?.id, search]);

  const handleCreateDatabase = async (name: string, templateId: string) => {
    let properties: DatabaseProperty[] = [];
    if (templateId === "projects") {
      properties = [
        { id: "status", name: "Status", type: "select", options: ["Not started", "In progress", "In review", "Done"] },
        { id: "priority", name: "Priority", type: "select", options: ["Low", "Medium", "High", "Urgent"] },
        { id: "due_date", name: "Due date", type: "date" },
      ];
    } else if (templateId === "content") {
      properties = [
        { id: "status", name: "Status", type: "select", options: ["Idea", "Drafting", "In review", "Published"] },
        { id: "channel", name: "Channel", type: "select", options: ["Blog", "Newsletter", "Twitter/X", "YouTube", "Docs"] },
        { id: "due_date", name: "Publish Date", type: "date" },
      ];
    } else if (templateId === "bugs") {
      properties = [
        { id: "status", name: "Status", type: "select", options: ["Open", "Investigating", "Fixed", "Verified"] },
        { id: "severity", name: "Severity", type: "select", options: ["Low", "Medium", "High", "Critical"] },
        { id: "due_date", name: "Target Fix", type: "date" },
      ];
    } else {
      properties = [
        { id: "status", name: "Status", type: "select", options: ["Not started", "In progress", "Done"] },
        { id: "due_date", name: "Due date", type: "date" },
      ];
    }

    const response = await fetch("/api/databases", {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ name, properties }),
    });

    const data = (await response.json().catch(() => ({}))) as DatabaseSchema & { error?: string };
    if (!response.ok) throw new Error(data.error || `Could not create database (${response.status})`);

    const newDb = data as DatabaseSchema;
    setDatabases((prev) => [...prev, newDb]);
    setSelected(newDb);
    await loadRecords(newDb);
  };

  const handleDeleteDatabase = async (databaseId: string) => {
    if (!confirm("Are you sure you want to delete this database and all its records?")) return;
    try {
      const response = await fetch(`/api/databases/${encodeURIComponent(databaseId)}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!response.ok) throw new Error("Could not delete database");
      setDatabases((prev) => prev.filter((d) => d.id !== databaseId));
      if (selected?.id === databaseId) {
        const remaining = databases.filter((d) => d.id !== databaseId);
        setSelected(remaining[0] || null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete database");
    }
  };

  const handleSaveDatabaseName = async () => {
    if (!selected || !databaseNameDraft.trim()) return;
    try {
      const response = await fetch(`/api/databases/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: headers(true),
        body: JSON.stringify({ name: databaseNameDraft.trim(), properties: selected.properties }),
      });
      const data = (await response.json().catch(() => ({}))) as DatabaseSchema & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not rename database");
      setDatabases((prev) => prev.map((db) => db.id === data.id ? data : db));
      setSelected(data);
      setEditingDatabaseName(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to rename database");
    }
  };

  const getEmptyDraft = (database: DatabaseSchema) => ({
    title: "",
    properties: Object.fromEntries(database.properties.map((property) => [
      property.id,
      property.type === "checkbox" ? false : property.type === "multi_select" ? [] : "",
    ])),
  });

  const openRecordModal = () => {
    if (!selected) return;
    setRecordDraft(getEmptyDraft(selected));
    setIsRecordModalOpen(true);
  };

  const handleCreateRecordFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !recordDraft.title.trim() || submitting.current) return;
    submitting.current = true;
    setIsSubmittingRecord(true);
    setError("");
    const properties = Object.fromEntries(Object.entries(recordDraft.properties).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== "" && value !== null && value !== undefined;
    }));
    try {
      const response = await fetch(`/api/databases/${encodeURIComponent(selected.id)}/records`, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({ title: recordDraft.title.trim(), properties }),
      });
      const data = (await response.json().catch(() => ({}))) as DatabaseRecord & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not create row");
      setRecords((prev) => [...prev, data]);
      setRecordDraft(getEmptyDraft(selected));
      setIsRecordModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create row");
    } finally {
      submitting.current = false;
      setIsSubmittingRecord(false);
    }
  };

  const handleCreateRecord = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selected || !newRecordTitle.trim()) return;

    // Provide sensible default properties based on schema
    const defaultProperties: Record<string, unknown> = {};
    for (const prop of selected.properties) {
      if (prop.type === "select" && prop.options && prop.options.length > 0) {
        defaultProperties[prop.id] = prop.options[0];
      } else if (prop.type === "date") {
        defaultProperties[prop.id] = new Date().toISOString().split("T")[0];
      }
    }

    try {
      const response = await fetch(`/api/databases/${encodeURIComponent(selected.id)}/records`, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({ title: newRecordTitle.trim(), properties: defaultProperties }),
      });
      if (!response.ok) throw new Error("Could not create row");
      const record = (await response.json()) as DatabaseRecord;
      setRecords((prev) => [...prev, record]);
      setNewRecordTitle("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create row");
    }
  };

  const handleUpdateRecordProperty = async (recordId: string, propertyId: string, value: unknown) => {
    if (!selected) return;
    const targetRecord = records.find((r) => r.id === recordId);
    if (!targetRecord) return;

    const nextValue = value === "" ? null : value;

    try {
      const response = await fetch(
        `/api/databases/${encodeURIComponent(selected.id)}/records/${encodeURIComponent(recordId)}`,
        {
          method: "PATCH",
          headers: headers(true),
          body: JSON.stringify({ properties: { [propertyId]: nextValue } }),
        }
      );
      if (!response.ok) throw new Error("Failed to save changes");
      setRecords((prev) => prev.map((r) => r.id === recordId ? { ...r, properties: { ...r.properties, [propertyId]: nextValue } } : r));
      setError("");
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update record");
      return false;
    }
  };

  const handleSaveTitle = async (recordId: string) => {
    if (!selected || !editingTitleValue.trim()) {
      setEditingTitleId(null);
      return;
    }
    const newTitle = editingTitleValue.trim();
    setRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, title: newTitle } : r))
    );
    setEditingTitleId(null);

    try {
      const response = await fetch(
        `/api/databases/${encodeURIComponent(selected.id)}/records/${encodeURIComponent(recordId)}`,
        {
          method: "PATCH",
          headers: headers(true),
          body: JSON.stringify({ title: newTitle }),
        }
      );
      if (!response.ok) throw new Error("Could not save row name. Please try again.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update title");
      loadRecords(selected);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!selected) return;
    if (!confirm("Permanently delete this row? This cannot be undone.")) return;
    try {
      const response = await fetch(
        `/api/databases/${encodeURIComponent(selected.id)}/records/${encodeURIComponent(recordId)}`,
        { method: "DELETE", headers: headers() }
      );
      if (!response.ok) throw new Error("Could not delete row. Please try again.");
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete record");
    }
  };

  const columns = useMemo(() => selected?.properties ?? [], [selected]);

  const getBadgeStyle = (value: string) => {
    const val = value.toLowerCase();
    if (val.includes("done") || val.includes("fixed") || val.includes("published")) {
      return { bg: "rgba(34, 197, 94, 0.15)", text: "#16a34a", border: "rgba(34, 197, 94, 0.3)" };
    }
    if (val.includes("progress") || val.includes("draft") || val.includes("investigat")) {
      return { bg: "rgba(59, 130, 246, 0.15)", text: "#2563eb", border: "rgba(59, 130, 246, 0.3)" };
    }
    if (val.includes("review") || val.includes("high") || val.includes("urgent") || val.includes("critical")) {
      return { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" };
    }
    return { bg: "var(--bg-subtle)", text: "var(--text-secondary)", border: "var(--border-subtle)" };
  };

  return (
    <div
      className="animate-fade-in database-view"
      style={{
        padding: "40px 32px",
        maxWidth: "1280px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        className="database-heading"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <h1 className="font-serif" style={{ margin: 0, fontSize: 30, fontWeight: 600, color: "var(--text-primary)" }}>
            Databases
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 13 }}>
            Flexible tables for projects, trackers, and anything your team needs to remember.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "13px" }}
        >
          <Plus size={15} />
          <span>New database</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            color: "var(--danger, #ef4444)",
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: "var(--radius-md)",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={15} />
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div
        className="database-layout"
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left Sidebar: Databases List */}
        <aside
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "14px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 8px 12px 8px",
              borderBottom: "1px solid var(--border-subtle)",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Workspace tables
            </span>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-icon"
              title="Create new database"
              style={{ width: "24px", height: "24px" }}
            >
              <Plus size={13} />
            </button>
          </div>

          {isLoadingDatabases ? (
            <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
              Loading databases…
            </div>
          ) : databases.length === 0 ? (
            <div style={{ padding: "16px 8px", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
              No tables yet. Create one to start organizing structured information.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {databases.map((database) => {
                const isSelected = selected?.id === database.id;
                return (
                  <button
                    key={database.id}
                    onClick={() => setSelected(database)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      border: "none",
                      borderRadius: "var(--radius-md)",
                      color: isSelected ? "var(--accent)" : "var(--text-primary)",
                      background: isSelected ? "var(--bg-nav-active)" : "transparent",
                      fontSize: "13px",
                      fontWeight: isSelected ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.1s ease",
                    }}
                  >
                    <Table2 size={16} color={isSelected ? "var(--accent)" : "var(--text-muted)"} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {database.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Main Panel: Table View or Empty State */}
        <section
          className="database-panel"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {selected ? (
            <>
              {/* Database Toolbar */}
              <div
                className="database-toolbar"
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  borderBottom: "1px solid var(--border-subtle)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Table2 size={20} color="var(--accent)" />
                  {editingDatabaseName ? (
                    <input
                      autoFocus
                      value={databaseNameDraft}
                      onChange={(e) => setDatabaseNameDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleSaveDatabaseName(); if (e.key === "Escape") setEditingDatabaseName(false); }}
                      onBlur={() => void handleSaveDatabaseName()}
                      aria-label="Database name"
                      style={{ fontSize: 18, fontWeight: 600, minHeight: 32, padding: "4px 8px", width: 220 }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setDatabaseNameDraft(selected.name); setEditingDatabaseName(true); }}
                      title="Rename database"
                      style={{ border: 0, background: "transparent", color: "var(--text-primary)", fontSize: 18, fontWeight: 600, padding: 0, cursor: "text" }}
                    >
                      {selected.name}
                    </button>
                  )}
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "4px" }}>
                    ({records.length} {records.length === 1 ? "row" : "rows"})
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {/* Search / Filter */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-surface)",
                    }}
                  >
                    <Search size={14} color="var(--text-muted)" />
                    <input
                      value={search}
                      maxLength={100}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter rows…"
                      style={{
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        fontSize: "12px",
                        color: "var(--text-primary)",
                        width: "120px",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 2, padding: 2, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }} aria-label="Database view options">
                    <button type="button" className="btn-icon" title="Table view" aria-pressed={viewMode === "table"} onClick={() => setViewMode("table")} style={{ width: 28, height: 28, background: viewMode === "table" ? "var(--bg-nav-active)" : "transparent" }}><Rows3 size={14} /></button>
                    <button type="button" className="btn-icon" title="Card view" aria-pressed={viewMode === "cards"} onClick={() => setViewMode("cards")} style={{ width: 28, height: 28, background: viewMode === "cards" ? "var(--bg-nav-active)" : "transparent" }}><LayoutGrid size={14} /></button>
                  </div>
                  <button type="button" onClick={openRecordModal} className="btn-primary" style={{ padding: "7px 12px", fontSize: 12 }}><Plus size={14} /> New row</button>
                  <button
                    onClick={() => handleDeleteDatabase(selected.id)}
                    className="btn-icon"
                    title="Delete this database"
                    style={{ width: "30px", height: "30px", color: "var(--danger)" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div style={{ padding: "10px 20px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{viewMode === "table" ? "Edit a cell, then press Enter or leave the field to save. Selections save immediately." : "Cards show a summary. Switch to Table to edit fields."}</span>
                <button type="button" className="btn-secondary" onClick={openRecordModal} style={{ padding: "6px 10px", fontSize: 12 }}><Plus size={13} /> Add a row</button>
              </div>

              {/* Table Body */}
              <div style={{ overflowX: "auto", display: viewMode === "table" ? "block" : "none" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-subtle)" }}>
                      <th style={{ textAlign: "left", padding: "12px 20px", fontWeight: 600, color: "var(--text-secondary)", width: "35%" }}>
                        Name
                      </th>
                      {columns.map((column) => (
                        <th
                          key={column.id}
                          style={{
                            textAlign: "left",
                            padding: "12px 16px",
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {column.name}
                        </th>
                      ))}
                      <th style={{ width: "50px" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr
                        key={record.id}
                        style={{
                          borderBottom: "1px solid var(--border-subtle)",
                          transition: "background 0.1s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        {/* Title Column */}
                        <td style={{ padding: "12px 20px" }}>
                          {editingTitleId === record.id ? (
                            <input
                              type="text"
                              value={editingTitleValue}
                              onChange={(e) => setEditingTitleValue(e.target.value)}
                              onBlur={() => handleSaveTitle(record.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveTitle(record.id);
                                if (e.key === "Escape") setEditingTitleId(null);
                              }}
                              autoFocus
                              className="form-control"
                              style={{ padding: "4px 8px", fontSize: "13px" }}
                            />
                          ) : (
                            <span
                              onClick={() => {
                                setEditingTitleId(record.id);
                                setEditingTitleValue(record.title);
                              }}
                              style={{
                                cursor: "pointer",
                                fontWeight: 500,
                                color: "var(--text-primary)",
                                display: "inline-block",
                                width: "100%",
                              }}
                              title="Click to edit name"
                            >
                              {record.title}
                            </span>
                          )}
                        </td>

                        {/* Property Columns */}
                        {columns.map((column) => {
                          const val = record.properties[column.id];

                          if (column.type === "select" && column.options) {
                            const currentVal = String(val ?? "");
                            const badge = getBadgeStyle(currentVal);
                            return (
                              <td key={column.id} style={{ padding: "8px 16px" }}>
                                <select
                                  value={currentVal}
                                  onChange={(e) =>
                                    handleUpdateRecordProperty(record.id, column.id, e.target.value)
                                  }
                                  style={{
                                    border: `1px solid ${badge.border}`,
                                    backgroundColor: badge.bg,
                                    color: badge.text,
                                    fontWeight: 600,
                                    fontSize: "12px",
                                    borderRadius: "var(--radius-sm)",
                                    padding: "4px 8px",
                                    cursor: "pointer",
                                    outline: "none",
                                  }}
                                >
                                  <option value="">Empty</option>
                                  {column.options.map((opt) => (
                                    <option key={opt} value={opt} style={{ color: "var(--text-primary)", background: "var(--bg-surface)" }}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          }

                          if (column.type === "date") {
                            const dateVal = typeof val === "string" ? val : "";
                            return (
                              <td key={column.id} style={{ padding: "8px 16px" }}>
                                <input
                                  type="date"
                                  value={dateVal}
                                  onChange={(e) =>
                                    handleUpdateRecordProperty(record.id, column.id, e.target.value)
                                  }
                                  style={{
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-sm)",
                                    backgroundColor: "transparent",
                                    color: "var(--text-primary)",
                                    padding: "4px 8px",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                  }}
                                />
                              </td>
                            );
                          }

                          if (column.type === "checkbox") {
                            return (
                              <td key={column.id} style={{ padding: "8px 16px" }}>
                                <input type="checkbox" checked={Boolean(val)} onChange={(e) => handleUpdateRecordProperty(record.id, column.id, e.target.checked)} aria-label={`${column.name} for ${record.title}`} />
                              </td>
                            );
                          }

                          if (column.type === "select" || column.type === "multi_select") {
                            const values = Array.isArray(val) ? val : [];
                            return (
                              <td key={column.id} style={{ padding: "8px 16px", minWidth: 160 }}>
                                <select
                                  multiple={column.type === "multi_select"}
                                  value={column.type === "multi_select" ? values.map(String) : String(val ?? "")}
                                  onChange={(e) => handleUpdateRecordProperty(record.id, column.id, column.type === "multi_select" ? Array.from(e.target.selectedOptions).map((option) => option.value) : e.target.value)}
                                  aria-label={`${column.name} for ${record.title}`}
                                  style={{ width: "100%", minHeight: column.type === "multi_select" ? 54 : 32, padding: "4px 8px", fontSize: 12 }}
                                >
                                  {column.type === "select" && <option value="">Select…</option>}
                                  {(column.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              </td>
                            );
                          }

                          if (["text", "number", "person", "url"].includes(column.type)) {
                            return (
                              <td key={column.id} style={{ padding: "8px 16px", minWidth: 150 }}>
                                <DatabaseCellInput value={val} type={column.type} label={`${column.name} for ${record.title}`} onSave={(value) => handleUpdateRecordProperty(record.id, column.id, value)} />
                              </td>
                            );
                          }

                          return (
                            <td key={column.id} style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>
                              {Array.isArray(val) ? val.join(", ") : String(val ?? "—")}
                            </td>
                          );
                        })}

                        {/* Delete Row Action */}
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <button
                            aria-label={`Delete ${record.title}`}
                            onClick={() => handleDeleteRecord(record.id)}
                            className="btn-icon"
                            style={{ width: "26px", height: "26px", color: "var(--danger)" }}
                            title="Delete row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {records.length === 0 && (
                      <tr>
                        <td
                          colSpan={columns.length + 2}
                          style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}
                        >
                          {isLoadingRecords ? "Loading rows…" : search ? "No matching rows found. Try a different search." : "No rows yet. Choose New row to add your first record."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ display: viewMode === "cards" ? "grid" : "none", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, padding: 16 }}>
                {records.map((record) => (
                  <article key={record.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: 16, background: "var(--bg-surface)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", color: "var(--text-primary)", marginBottom: 8, wordBreak: "break-word" }}>{record.title}</strong>
                        {columns.map((column) => <div key={column.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderTop: "1px solid var(--border-subtle)", fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>{column.name}</span><span style={{ color: "var(--text-secondary)", textAlign: "right" }}>{Array.isArray(record.properties[column.id]) ? (record.properties[column.id] as unknown[]).join(", ") : String(record.properties[column.id] ?? "—")}</span></div>)}
                      </div>
                      <button type="button" aria-label={`Delete ${record.title}`} onClick={() => handleDeleteRecord(record.id)} className="btn-icon" style={{ width: 28, height: 28, color: "var(--danger)", flexShrink: 0 }} title="Delete row"><Trash2 size={14} /></button>
                    </div>
                  </article>
                ))}
                {records.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>{search ? "No matching rows found." : "No rows yet. Create your first row above."}</div>}
              </div>
            </>
          ) : (
            /* Empty State */
            <div
              className="database-empty-state"
              style={{
                padding: "64px 32px",
                textAlign: "center",
                color: "var(--text-secondary)",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "var(--radius-lg)",
                  backgroundColor: "var(--accent-light)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 18px auto",
                }}
              >
                <Table2 size={28} />
              </div>
              <h2
                className="font-serif"
                style={{
                  margin: "0 0 8px 0",
                  color: "var(--text-primary)",
                  fontSize: "22px",
                  fontWeight: 600,
                }}
              >
                Start with a database
              </h2>
              <p
                style={{
                  maxWidth: "420px",
                  margin: "0 auto 24px auto",
                  lineHeight: 1.6,
                  fontSize: "13px",
                }}
              >
                Choose a starter template, add your first row, and keep your team's information organized in one place.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsCreateModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 22px",
                  fontSize: "13px",
                }}
              >
                <Plus size={16} />
                <span>Create your first database</span>
              </button>
            </div>
          )}
        </section>
      </div>

      {isRecordModalOpen && selected && (
        <div className="modal-overlay" onClick={() => setIsRecordModalOpen(false)} role="presentation">
          <div className="modal-dialog animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "calc(100vh - 40px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <h2 className="font-serif" style={{ fontSize: 20, fontWeight: 600 }}>New row</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 3 }}>Add a record to {selected.name}.</p>
              </div>
              <button type="button" className="btn-icon" onClick={() => setIsRecordModalOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateRecordFromModal} style={{ padding: "20px 22px", overflowY: "auto" }}>
              {error && <p role="alert" className="feedback-error">{error}</p>}
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Name <span aria-hidden="true">*</span></label>
              <input autoFocus required maxLength={200} value={recordDraft.title} onChange={(e) => setRecordDraft((draft) => ({ ...draft, title: e.target.value }))} placeholder="e.g. Launch new onboarding flow" style={{ width: "100%", marginBottom: 18 }} />
              <div style={{ display: "grid", gap: 14 }}>
                {selected.properties.map((property) => {
                  const value = recordDraft.properties[property.id];
                  const setValue = (next: unknown) => setRecordDraft((draft) => ({ ...draft, properties: { ...draft.properties, [property.id]: next } }));
                  return (
                    <label key={property.id} style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                      {property.name}
                      {property.type === "checkbox" ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400, color: "var(--text-primary)" }}><input type="checkbox" checked={Boolean(value)} onChange={(e) => setValue(e.target.checked)} /> Mark as complete</span>
                      ) : property.type === "select" ? (
                        <select value={String(value ?? "")} onChange={(e) => setValue(e.target.value)}><option value="">Select an option…</option>{(property.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select>
                      ) : property.type === "multi_select" ? (
                        <select multiple value={Array.isArray(value) ? value.map(String) : []} onChange={(e) => setValue(Array.from(e.target.selectedOptions).map((option) => option.value))} style={{ minHeight: 76 }}>{(property.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select>
                      ) : (
                        <input type={property.type === "date" ? "date" : property.type === "number" ? "number" : property.type === "url" ? "url" : "text"} value={String(value ?? "")} placeholder={property.type === "person" ? "name@example.com" : undefined} onChange={(e) => setValue(property.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />
                      )}
                    </label>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
                <button type="button" className="btn-secondary" onClick={() => setIsRecordModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmittingRecord || !recordDraft.title.trim()}><Plus size={14} />{isSubmittingRecord ? "Creating…" : "Create row"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CreateDatabaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateDatabase}
      />
    </div>
  );
};
