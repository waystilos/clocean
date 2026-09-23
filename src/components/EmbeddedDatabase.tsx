import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Table2,
  Plus,
  Search,
  Trash2,
  MoreVertical,
  Calendar,
  Hash,
  AlertCircle,
  ChevronDown,
  Filter,
  ArrowUpDown,
  AlignLeft,
  List,
  Target,
  X,
  Check,
} from "lucide-react";
import { DatabaseProperty, DatabaseRecord, DatabaseSchema } from "../types.ts";

interface EmbeddedDatabaseProps {
  databaseId: string;
  initialName?: string;
  initialSchema?: DatabaseSchema;
  initialRecords?: DatabaseRecord[];
  workspaceId: string;
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>;
  onRemoveFromPage?: () => void;
}

export const EmbeddedDatabase: React.FC<EmbeddedDatabaseProps> = ({
  databaseId,
  initialName,
  initialSchema,
  initialRecords,
  workspaceId,
  getAuthHeaders,
  onRemoveFromPage,
}) => {
  const [schema, setSchema] = useState<DatabaseSchema | null>(() => {
    if (initialSchema) return initialSchema;
    if (initialName) {
      return {
        id: databaseId,
        workspaceId,
        name: initialName,
        properties: [
          { id: "priority", name: "Priority", type: "select", options: ["1", "2", "3", "4", "5"] },
          { id: "name", name: "Name", type: "text" },
          { id: "text", name: "Text", type: "text" },
          {
            id: "multi_select",
            name: "Multi select",
            type: "multi_select",
            options: ["Share with others", "Retention", "10+ pageviews", "Upgrade", "Spends more time"],
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  });
  const [records, setRecords] = useState<DatabaseRecord[]>(() => initialRecords || []);
  const [search, setSearch] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [activeTab, setActiveTab] = useState("table");
  const [isLoading, setIsLoading] = useState(!initialSchema && !initialName);
  const [error, setError] = useState<string | null>(null);

  // Sorting and Filtering states
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterProp, setFilterProp] = useState<string | null>(null);
  const [filterVal, setFilterVal] = useState<string>("");

  // In-line title editing of the database
  const [isEditingDbTitle, setIsEditingDbTitle] = useState(false);
  const [dbTitleValue, setDbTitleValue] = useState(initialName || "Database");

  // In-line editing of row/column titles
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");

  // In-line editing of text/number cells
  const [editingCell, setEditingCell] = useState<{ recordId: string; propId: string } | null>(null);
  const [editingCellValue, setEditingCellValue] = useState("");

  // Menus and Popovers
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOrientationMenuOpen, setIsOrientationMenuOpen] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<"text" | "number" | "select" | "multi_select" | "date">("select");
  const [newColumnOptions, setNewColumnOptions] = useState("1, 2, 3, 4, 5");

  const menuRef = useRef<HTMLDivElement | null>(null);
  const orientationRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const addColumnRef = useRef<HTMLDivElement | null>(null);

  const headers = (json = false) =>
    getAuthHeaders({
      "x-workspace-id": workspaceId,
      ...(json ? { "Content-Type": "application/json" } : {}),
    });

  // Load database schema & records
  const loadDatabase = async () => {
    setIsLoading(true);
    try {
      const listRes = await fetch("/api/databases", { headers: headers() });
      if (!listRes.ok) throw new Error("Could not load database schema");
      const listData = (await listRes.json()) as { databases: DatabaseSchema[] };
      const currentDb = listData.databases?.find((d) => d.id === databaseId);
      if (!currentDb) {
        throw new Error("Database not found in workspace");
      }
      setSchema(currentDb);
      setDbTitleValue(currentDb.name);

      const recordsRes = await fetch(
        `/api/databases/${encodeURIComponent(databaseId)}/records`,
        { headers: headers() }
      );
      if (recordsRes.ok) {
        const recData = (await recordsRes.json()) as { records: DatabaseRecord[] };
        setRecords(recData.records || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load database");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, [databaseId, workspaceId]);

  // Click outside listener for dropdown popovers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
      if (orientationRef.current && !orientationRef.current.contains(e.target as Node)) setIsOrientationMenuOpen(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setIsFilterMenuOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setIsSortMenuOpen(false);
      if (addColumnRef.current && !addColumnRef.current.contains(e.target as Node)) setIsAddColumnOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Save database title rename
  const handleSaveDbTitle = async () => {
    setIsEditingDbTitle(false);
    if (!schema || !dbTitleValue.trim() || dbTitleValue === schema.name) return;

    try {
      const res = await fetch(`/api/databases/${encodeURIComponent(databaseId)}`, {
        method: "PATCH",
        headers: headers(true),
        body: JSON.stringify({ name: dbTitleValue.trim(), properties: schema.properties }),
      });
      if (res.ok) {
        const updated = (await res.json()) as DatabaseSchema;
        setSchema(updated);
      }
    } catch {
      setDbTitleValue(schema.name);
    }
  };

  // Add new column to schema
  const handleAddColumn = async () => {
    if (!schema || !newColumnName.trim()) return;
    const propId = newColumnName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30) || `col_${Date.now()}`;

    if (schema.properties.some((p) => p.id === propId)) {
      setError(`Column "${newColumnName}" already exists`);
      return;
    }

    const newProp: DatabaseProperty = {
      id: propId,
      name: newColumnName.trim(),
      type: newColumnType,
      ...(newColumnType === "select" || newColumnType === "multi_select"
        ? {
            options: newColumnOptions
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean),
          }
        : {}),
    };

    const updatedProperties = [...schema.properties, newProp];

    try {
      const res = await fetch(`/api/databases/${encodeURIComponent(databaseId)}`, {
        method: "PATCH",
        headers: headers(true),
        body: JSON.stringify({ name: schema.name, properties: updatedProperties }),
      });
      if (!res.ok) throw new Error("Could not add column");
      const updated = (await res.json()) as DatabaseSchema;
      setSchema(updated);
      setNewColumnName("");
      setIsAddColumnOpen(false);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add column");
    }
  };

  // Delete column from schema
  const handleDeleteColumn = async (propId: string) => {
    if (!schema) return;
    if (!confirm(`Are you sure you want to delete column "${schema.properties.find((p) => p.id === propId)?.name}"?`)) return;

    const updatedProperties = schema.properties.filter((p) => p.id !== propId);
    try {
      const res = await fetch(`/api/databases/${encodeURIComponent(databaseId)}`, {
        method: "PATCH",
        headers: headers(true),
        body: JSON.stringify({ name: schema.name, properties: updatedProperties }),
      });
      if (res.ok) {
        const updated = (await res.json()) as DatabaseSchema;
        setSchema(updated);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete column");
    }
  };

  // Create new record (row in horizontal, column in vertical)
  const handleCreateRecord = async (customTitle?: string) => {
    if (!schema) return;
    const title = customTitle?.trim() || `Item ${records.length + 1}`;

    const defaultProperties: Record<string, unknown> = {};
    for (const prop of schema.properties) {
      if (prop.type === "select" && prop.options && prop.options.length > 0) {
        defaultProperties[prop.id] = prop.options[0];
      } else if (prop.type === "multi_select" && prop.options && prop.options.length > 0) {
        defaultProperties[prop.id] = [prop.options[0]];
      } else if (prop.type === "date") {
        defaultProperties[prop.id] = new Date().toISOString().split("T")[0];
      } else if (prop.type === "number") {
        defaultProperties[prop.id] = records.length + 1;
      }
    }

    try {
      const res = await fetch(`/api/databases/${encodeURIComponent(databaseId)}/records`, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({
          title,
          properties: defaultProperties,
        }),
      });
      if (!res.ok) throw new Error("Could not add record");
      const newRec = (await res.json()) as DatabaseRecord;
      setRecords((prev) => [...prev, newRec]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add record");
    }
  };

  // Update record property (cell)
  const handleUpdateRecordProperty = async (recordId: string, propertyId: string, value: unknown) => {
    const targetRecord = records.find((r) => r.id === recordId);
    if (!targetRecord) return;

    const updatedProps = { ...targetRecord.properties, [propertyId]: value };

    // Optimistic UI update
    setRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, properties: updatedProps } : r))
    );

    try {
      const res = await fetch(
        `/api/databases/${encodeURIComponent(databaseId)}/records/${encodeURIComponent(recordId)}`,
        {
          method: "PATCH",
          headers: headers(true),
          body: JSON.stringify({ properties: { [propertyId]: value } }),
        }
      );
      if (!res.ok) throw new Error("Failed to save cell");
    } catch {
      loadDatabase();
    }
  };

  // Save record title
  const handleSaveRecordTitle = async (recordId: string) => {
    if (!editingTitleValue.trim()) {
      setEditingTitleId(null);
      return;
    }
    const newTitle = editingTitleValue.trim();
    setRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, title: newTitle } : r))
    );
    setEditingTitleId(null);

    try {
      await fetch(
        `/api/databases/${encodeURIComponent(databaseId)}/records/${encodeURIComponent(recordId)}`,
        {
          method: "PATCH",
          headers: headers(true),
          body: JSON.stringify({ title: newTitle }),
        }
      );
    } catch {
      loadDatabase();
    }
  };

  // Delete record
  const handleDeleteRecord = async (recordId: string) => {
    try {
      const res = await fetch(
        `/api/databases/${encodeURIComponent(databaseId)}/records/${encodeURIComponent(recordId)}`,
        { method: "DELETE", headers: headers() }
      );
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== recordId));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete record");
    }
  };

  // Delete entire database
  const handleDeleteDatabasePermanently = async () => {
    if (!confirm(`Are you sure you want to permanently delete "${schema?.name || "this database"}" from Cloudflare R2?`)) return;
    try {
      const res = await fetch(`/api/databases/${encodeURIComponent(databaseId)}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (res.ok && onRemoveFromPage) {
        onRemoveFromPage();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete database");
    }
  };

  // Filter & Sort
  const processedRecords = useMemo(() => {
    let result = [...records];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => {
        if (r.title.toLowerCase().includes(q)) return true;
        return Object.values(r.properties).some((v) =>
          String(v || "").toLowerCase().includes(q)
        );
      });
    }

    if (filterProp && filterVal) {
      result = result.filter((r) => {
        const rawVal = filterProp === "title" ? r.title : String(r.properties[filterProp] || "");
        return rawVal.toLowerCase().includes(filterVal.toLowerCase());
      });
    }

    if (sortBy) {
      result.sort((a, b) => {
        const valA = sortBy === "title" ? a.title : String(a.properties[sortBy] || "");
        const valB = sortBy === "title" ? b.title : String(b.properties[sortBy] || "");
        return sortDir === "asc"
          ? valA.localeCompare(valB, undefined, { numeric: true })
          : valB.localeCompare(valA, undefined, { numeric: true });
      });
    }

    return result;
  }, [records, search, filterProp, filterVal, sortBy, sortDir]);

  // Dynamic badge styling for tags and priority values
  const getPropertyBadgeStyle = (val: string | number) => {
    const s = String(val).toLowerCase().trim();
    if (s === "1" || s.includes("pageview") || s.includes("done") || s.includes("published")) {
      return { bg: "rgba(34, 197, 94, 0.16)", text: "#166534", border: "transparent" };
    }
    if (s === "2" || s.includes("spends") || s.includes("progress") || s.includes("doing")) {
      return { bg: "rgba(59, 130, 246, 0.16)", text: "#1E40AF", border: "transparent" };
    }
    if (s === "3" || s.includes("upgrade") || s.includes("review") || s.includes("high")) {
      return { bg: "rgba(168, 85, 247, 0.16)", text: "#6B21A8", border: "transparent" };
    }
    if (s === "4" || s.includes("retention") || s.includes("urgent") || s.includes("critical")) {
      return { bg: "rgba(249, 115, 22, 0.16)", text: "#9A3412", border: "transparent" };
    }
    if (s === "5" || s.includes("share") || s.includes("ideas") || s.includes("todo")) {
      return { bg: "rgba(234, 179, 8, 0.18)", text: "#854D0E", border: "transparent" };
    }
    // Deterministic pastel color for other arbitrary strings
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    const colors = [
      { bg: "rgba(34, 197, 94, 0.14)", text: "#166534" },
      { bg: "rgba(59, 130, 246, 0.14)", text: "#1E40AF" },
      { bg: "rgba(168, 85, 247, 0.14)", text: "#6B21A8" },
      { bg: "rgba(249, 115, 22, 0.14)", text: "#9A3412" },
      { bg: "rgba(234, 179, 8, 0.14)", text: "#854D0E" },
      { bg: "rgba(236, 72, 153, 0.14)", text: "#9D174D" },
    ];
    const picked = colors[Math.abs(hash) % colors.length];
    return { ...picked, border: "transparent" };
  };

  // Property type icon (Aa, ⨀, ≡, :=)
  const renderPropertyTypeIcon = (type: string, name?: string) => {
    const norm = (name || "").toLowerCase();
    if (norm.includes("priority") || norm.includes("status")) {
      return <Target size={13} style={{ color: "var(--text-muted)" }} />;
    }
    switch (type) {
      case "text":
        return <AlignLeft size={13} style={{ color: "var(--text-muted)" }} />;
      case "select":
      case "multi_select":
        return <List size={13} style={{ color: "var(--text-muted)" }} />;
      case "date":
        return <Calendar size={13} style={{ color: "var(--text-muted)" }} />;
      case "number":
        return <Hash size={13} style={{ color: "var(--text-muted)" }} />;
      default:
        return (
          <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: "var(--font-sans)", color: "var(--text-muted)" }}>
            Aa
          </span>
        );
    }
  };

  if (isLoading && !schema) {
    return (
      <div
        className="embedded-table-container animate-fade-in"
        style={{
          margin: "24px 0",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-subtle)" }}>
          <Table2 size={16} color="var(--accent)" />
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{initialName || "Table"}</span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "auto" }}>Loading database…</span>
        </div>
        <div style={{ padding: "36px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
          Loading records…
        </div>
      </div>
    );
  }

  if (error && !schema) {
    return (
      <div
        style={{
          margin: "20px 0",
          padding: "14px 18px",
          backgroundColor: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: "var(--radius-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "var(--danger, #ef4444)",
          fontSize: "13px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={16} />
          <span>Database error: {error}</span>
        </div>
        {onRemoveFromPage && (
          <button onClick={onRemoveFromPage} className="btn-secondary" style={{ fontSize: "11px", padding: "4px 8px" }}>
            Remove
          </button>
        )}
      </div>
    );
  }

  const columns = schema?.properties || [];

  return (
    <div
      className="embedded-table-container animate-fade-in"
      style={{
        margin: "24px 0",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      {/* Database Top Bar: Tabs on Left, Actions on Right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-surface)",
          fontSize: "13px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        {/* Left: View Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 10px",
              background: "transparent",
              border: "none",
              borderBottom: "2px solid var(--text-primary)",
              color: "var(--text-primary)",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <Table2 size={15} />
            {isEditingDbTitle ? (
              <input
                type="text"
                value={dbTitleValue}
                onChange={(e) => setDbTitleValue(e.target.value)}
                onBlur={handleSaveDbTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveDbTitle();
                  if (e.key === "Escape") setIsEditingDbTitle(false);
                }}
                autoFocus
                className="form-control"
                style={{ fontSize: "13px", padding: "1px 4px", width: "120px" }}
              />
            ) : (
              <span onClick={() => setIsEditingDbTitle(true)} title="Click to rename table">
                {schema?.name || dbTitleValue || "Table"}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleCreateRecord()}
            className="btn-icon"
            style={{ width: "24px", height: "24px", color: "var(--text-muted)" }}
            title="Add view / new item"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Right: Actions bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Orientation Switcher: Vertical v / Horizontal v */}
          <div style={{ position: "relative" }} ref={orientationRef}>
            <button
              type="button"
              onClick={() => setIsOrientationMenuOpen((prev) => !prev)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                background: "transparent",
                border: "none",
                borderRadius: "var(--radius-sm)",
                color: "#E11D48", // coral/red highlight from the user's screenshot
                fontWeight: 500,
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              <span>{orientation === "vertical" ? "Vertical" : "Horizontal"}</span>
              <ChevronDown size={12} />
            </button>

            {isOrientationMenuOpen && (
              <div
                className="animate-fade-in"
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  width: "150px",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-lg)",
                  padding: "4px",
                  zIndex: 100,
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOrientation("vertical");
                    setIsOrientationMenuOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    background: orientation === "vertical" ? "var(--bg-nav-active)" : "transparent",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>Vertical</span>
                  {orientation === "vertical" && <Check size={12} color="var(--accent)" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrientation("horizontal");
                    setIsOrientationMenuOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    background: orientation === "horizontal" ? "var(--bg-nav-active)" : "transparent",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>Horizontal</span>
                  {orientation === "horizontal" && <Check size={12} color="var(--accent)" />}
                </button>
              </div>
            )}
          </div>

          {/* Filter link */}
          <div style={{ position: "relative" }} ref={filterRef}>
            <button
              type="button"
              onClick={() => setIsFilterMenuOpen((prev) => !prev)}
              style={{
                background: "transparent",
                border: "none",
                color: filterProp ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "12px",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                fontWeight: filterProp ? 600 : 400,
              }}
            >
              Filter{filterProp ? ` (${filterProp})` : ""}
            </button>

            {isFilterMenuOpen && (
              <div
                className="animate-fade-in"
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  width: "220px",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-lg)",
                  padding: "10px",
                  zIndex: 100,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Filter By Field
                </div>
                <select
                  value={filterProp || ""}
                  onChange={(e) => setFilterProp(e.target.value || null)}
                  className="form-control"
                  style={{ fontSize: "12px", padding: "4px 8px" }}
                >
                  <option value="">No Filter</option>
                  <option value="title">Name</option>
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
                {filterProp && (
                  <input
                    type="text"
                    value={filterVal}
                    onChange={(e) => setFilterVal(e.target.value)}
                    placeholder="Search value..."
                    className="form-control"
                    style={{ fontSize: "12px", padding: "4px 8px" }}
                    autoFocus
                  />
                )}
                {filterProp && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterProp(null);
                      setFilterVal("");
                      setIsFilterMenuOpen(false);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--danger)",
                      fontSize: "11px",
                      cursor: "pointer",
                      textAlign: "right",
                    }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sort link */}
          <div style={{ position: "relative" }} ref={sortRef}>
            <button
              type="button"
              onClick={() => setIsSortMenuOpen((prev) => !prev)}
              style={{
                background: "transparent",
                border: "none",
                color: sortBy ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "12px",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                fontWeight: sortBy ? 600 : 400,
              }}
            >
              Sort{sortBy ? ` (${sortDir})` : ""}
            </button>

            {isSortMenuOpen && (
              <div
                className="animate-fade-in"
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  width: "200px",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-lg)",
                  padding: "10px",
                  zIndex: 100,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Sort Records By
                </div>
                <select
                  value={sortBy || ""}
                  onChange={(e) => setSortBy(e.target.value || null)}
                  className="form-control"
                  style={{ fontSize: "12px", padding: "4px 8px" }}
                >
                  <option value="">Default order</option>
                  <option value="title">Name</option>
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
                {sortBy && (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setSortDir("asc")}
                      className={sortDir === "asc" ? "btn-primary" : "btn-secondary"}
                      style={{ flex: 1, padding: "3px 6px", fontSize: "11px" }}
                    >
                      Asc
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortDir("desc")}
                      className={sortDir === "desc" ? "btn-primary" : "btn-secondary"}
                      style={{ flex: 1, padding: "3px 6px", fontSize: "11px" }}
                    >
                      Desc
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search Icon */}
          <div style={{ display: "flex", alignItems: "center" }}>
            {isSearchVisible ? (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search table…"
                  className="form-control"
                  style={{ fontSize: "11px", padding: "2px 6px", width: "100px" }}
                  autoFocus
                />
                <button onClick={() => { setSearch(""); setIsSearchVisible(false); }} className="btn-icon" style={{ width: "20px", height: "20px" }}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSearchVisible(true)}
                className="btn-icon"
                style={{ width: "26px", height: "26px", color: "var(--text-muted)" }}
                title="Search table"
              >
                <Search size={14} />
              </button>
            )}
          </div>

          {/* More options menu */}
          <div style={{ position: "relative" }} ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="btn-icon"
              style={{ width: "26px", height: "26px", color: "var(--text-muted)" }}
              title="More table options"
            >
              <MoreVertical size={14} />
            </button>

            {isMenuOpen && (
              <div
                className="animate-fade-in"
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  width: "210px",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-lg)",
                  padding: "4px",
                  zIndex: 100,
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsEditingDbTitle(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "6px 10px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Table2 size={13} />
                  <span>Rename Database</span>
                </button>

                {onRemoveFromPage && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onRemoveFromPage();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      width: "100%",
                      padding: "6px 10px",
                      background: "transparent",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      fontSize: "12px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <X size={13} />
                    <span>Remove from this page</span>
                  </button>
                )}

                <div style={{ height: "1px", backgroundColor: "var(--border-subtle)", margin: "4px 0" }} />

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleDeleteDatabasePermanently();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "6px 10px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--danger, #ef4444)",
                    fontSize: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Trash2 size={13} />
                  <span>Delete permanently</span>
                </button>
              </div>
            )}
          </div>

          {/* Accent "New v" Button */}
          <button
            type="button"
            onClick={() => handleCreateRecord()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              backgroundColor: "#2383E2",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "4px",
              fontWeight: 500,
              fontSize: "12px",
              cursor: "pointer",
              transition: "opacity 0.15s ease",
            }}
            title="Create new record"
          >
            <span>New</span>
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div
          style={{
            padding: "6px 14px",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            borderBottom: "1px solid rgba(239, 68, 68, 0.2)",
            color: "var(--danger, #ef4444)",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>
            ×
          </button>
        </div>
      )}

      {/* TABLE VIEW CONTAINER */}
      <div style={{ overflowX: "auto", width: "100%" }}>
        {orientation === "vertical" ? (
          /* ========================================================================= */
          /* VERTICAL MODE (Transposed: fields as rows, records as columns) */
          /* ========================================================================= */
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <tbody>
              {/* Row 1: Priority property (if present in schema, or first select property) */}
              {columns.filter((c) => c.name.toLowerCase().includes("priority")).map((column) => (
                <tr key={column.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td
                    style={{
                      width: "150px",
                      minWidth: "140px",
                      padding: "10px 14px",
                      fontWeight: 500,
                      color: "var(--text-secondary)",
                      borderRight: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-surface)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {renderPropertyTypeIcon(column.type, column.name)}
                      <span>{column.name}</span>
                    </div>
                  </td>

                  {/* Values across records */}
                  {processedRecords.map((rec, rIdx) => {
                    const val = rec.properties[column.id] || rIdx + 1;
                    const badge = getPropertyBadgeStyle(String(val));
                    return (
                      <td
                        key={rec.id}
                        style={{
                          padding: "10px 14px",
                          borderRight: "1px solid var(--border-subtle)",
                          minWidth: "160px",
                        }}
                      >
                        <select
                          value={String(val)}
                          onChange={(e) => handleUpdateRecordProperty(rec.id, column.id, e.target.value)}
                          style={{
                            border: "none",
                            backgroundColor: badge.bg,
                            color: badge.text,
                            fontWeight: 600,
                            fontSize: "12px",
                            borderRadius: "4px",
                            padding: "3px 8px",
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          {(column.options || ["1", "2", "3", "4", "5"]).map((opt) => (
                            <option key={opt} value={opt} style={{ color: "var(--text-primary)", background: "var(--bg-surface)" }}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                  <td style={{ width: "40px" }} />
                </tr>
              ))}

              {/* Row 2: Name / Title property */}
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td
                  style={{
                    width: "150px",
                    minWidth: "140px",
                    padding: "10px 14px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    borderRight: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-surface)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: "var(--font-sans)", color: "var(--text-muted)" }}>
                      Aa
                    </span>
                    <span>Name</span>
                  </div>
                </td>

                {/* Values across records */}
                {processedRecords.map((rec) => (
                  <td
                    key={rec.id}
                    style={{
                      padding: "10px 14px",
                      borderRight: "1px solid var(--border-subtle)",
                      minWidth: "160px",
                      fontWeight: 600,
                    }}
                  >
                    {editingTitleId === rec.id ? (
                      <input
                        type="text"
                        value={editingTitleValue}
                        onChange={(e) => setEditingTitleValue(e.target.value)}
                        onBlur={() => handleSaveRecordTitle(rec.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRecordTitle(rec.id);
                          if (e.key === "Escape") setEditingTitleId(null);
                        }}
                        autoFocus
                        className="form-control"
                        style={{ padding: "3px 6px", fontSize: "13px", fontWeight: 600, width: "100%" }}
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditingTitleId(rec.id);
                          setEditingTitleValue(rec.title);
                        }}
                        style={{ cursor: "pointer", display: "inline-block", width: "100%", color: "var(--text-primary)" }}
                        title="Click to edit name"
                      >
                        {rec.title}
                      </span>
                    )}
                  </td>
                ))}
                <td style={{ width: "40px" }} />
              </tr>

              {/* Other Properties as Rows */}
              {columns
                .filter((c) => !c.name.toLowerCase().includes("priority"))
                .map((column) => (
                  <tr key={column.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {/* Header Cell */}
                    <td
                      style={{
                        width: "150px",
                        minWidth: "140px",
                        padding: "10px 14px",
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        borderRight: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-surface)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {renderPropertyTypeIcon(column.type, column.name)}
                          <span>{column.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteColumn(column.id)}
                          className="btn-icon"
                          style={{ width: "16px", height: "16px", opacity: 0.4 }}
                          title={`Delete ${column.name}`}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </td>

                    {/* Record values */}
                    {processedRecords.map((rec) => {
                      const val = rec.properties[column.id];

                      // Select / Multi-Select
                      if (column.type === "select" || column.type === "multi_select") {
                        const tags: string[] = Array.isArray(val)
                          ? val
                          : val !== undefined && val !== null && String(val) !== ""
                          ? [String(val)]
                          : [];

                        return (
                          <td
                            key={rec.id}
                            style={{
                              padding: "8px 14px",
                              borderRight: "1px solid var(--border-subtle)",
                              minWidth: "160px",
                            }}
                          >
                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                              {tags.map((t, idx) => {
                                const badge = getPropertyBadgeStyle(t);
                                return (
                                  <span
                                    key={idx}
                                    style={{
                                      backgroundColor: badge.bg,
                                      color: badge.text,
                                      fontSize: "12px",
                                      fontWeight: 500,
                                      borderRadius: "4px",
                                      padding: "2px 7px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "3px",
                                    }}
                                  >
                                    {t}
                                  </span>
                                );
                              })}

                              {/* Dropdown to add/change tag */}
                              <select
                                value=""
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const next = column.type === "multi_select"
                                    ? [...tags.filter((x) => x !== e.target.value), e.target.value]
                                    : e.target.value;
                                  handleUpdateRecordProperty(rec.id, column.id, next);
                                }}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: "var(--text-muted)",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                  outline: "none",
                                }}
                              >
                                <option value="">+ tag</option>
                                {(column.options || ["Idea", "Retention", "Upgrade", "Share with others"]).map((opt) => (
                                  <option key={opt} value={opt} style={{ color: "var(--text-primary)", background: "var(--bg-surface)" }}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                        );
                      }

                      // Date property
                      if (column.type === "date") {
                        return (
                          <td
                            key={rec.id}
                            style={{
                              padding: "8px 14px",
                              borderRight: "1px solid var(--border-subtle)",
                              minWidth: "160px",
                            }}
                          >
                            <input
                              type="date"
                              value={typeof val === "string" ? val : ""}
                              onChange={(e) => handleUpdateRecordProperty(rec.id, column.id, e.target.value)}
                              style={{
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "4px",
                                backgroundColor: "transparent",
                                color: "var(--text-primary)",
                                padding: "3px 6px",
                                fontSize: "12px",
                                cursor: "pointer",
                              }}
                            />
                          </td>
                        );
                      }

                      // Text / Number property
                      const isEditingThisCell =
                        editingCell?.recordId === rec.id && editingCell?.propId === column.id;

                      return (
                        <td
                          key={rec.id}
                          style={{
                            padding: "8px 14px",
                            borderRight: "1px solid var(--border-subtle)",
                            minWidth: "160px",
                            color: "var(--text-primary)",
                          }}
                        >
                          {isEditingThisCell ? (
                            <input
                              type={column.type === "number" ? "number" : "text"}
                              value={editingCellValue}
                              onChange={(e) => setEditingCellValue(e.target.value)}
                              onBlur={() => {
                                handleUpdateRecordProperty(
                                  rec.id,
                                  column.id,
                                  column.type === "number" ? Number(editingCellValue) : editingCellValue
                                );
                                setEditingCell(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleUpdateRecordProperty(
                                    rec.id,
                                    column.id,
                                    column.type === "number" ? Number(editingCellValue) : editingCellValue
                                  );
                                  setEditingCell(null);
                                }
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              autoFocus
                              className="form-control"
                              style={{ padding: "3px 6px", fontSize: "12px" }}
                            />
                          ) : (
                            <span
                              onClick={() => {
                                setEditingCell({ recordId: rec.id, propId: column.id });
                                setEditingCellValue(val !== undefined && val !== null ? String(val) : "");
                              }}
                              style={{
                                cursor: "pointer",
                                display: "inline-block",
                                minWidth: "60px",
                                color: val ? "var(--text-primary)" : "var(--text-muted)",
                              }}
                              title="Click to edit"
                            >
                              {val !== undefined && val !== null && String(val) !== "" ? String(val) : "—"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ width: "40px" }} />
                  </tr>
                ))}

              {/* Bottom Row: "+" button to add new property */}
              <tr>
                <td
                  style={{
                    padding: "8px 14px",
                    borderRight: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-surface)",
                  }}
                >
                  <div style={{ position: "relative" }} ref={addColumnRef}>
                    <button
                      type="button"
                      onClick={() => setIsAddColumnOpen((prev) => !prev)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "12px",
                      }}
                    >
                      <Plus size={14} />
                    </button>

                    {isAddColumnOpen && (
                      <div
                        className="animate-fade-in"
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          width: "240px",
                          backgroundColor: "var(--bg-surface)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-md)",
                          boxShadow: "var(--shadow-lg)",
                          padding: "10px",
                          zIndex: 100,
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                          Add Property Field
                        </div>
                        <input
                          type="text"
                          value={newColumnName}
                          onChange={(e) => setNewColumnName(e.target.value)}
                          placeholder="Property name (e.g. Channel)"
                          className="form-control"
                          style={{ fontSize: "12px", padding: "4px 8px" }}
                          autoFocus
                        />
                        <select
                          value={newColumnType}
                          onChange={(e: any) => setNewColumnType(e.target.value)}
                          className="form-control"
                          style={{ fontSize: "12px", padding: "4px 8px" }}
                        >
                          <option value="select">Select</option>
                          <option value="multi_select">Multi-select</option>
                          <option value="text">Text</option>
                          <option value="date">Date</option>
                          <option value="number">Number</option>
                        </select>
                        {(newColumnType === "select" || newColumnType === "multi_select") && (
                          <input
                            type="text"
                            value={newColumnOptions}
                            onChange={(e) => setNewColumnOptions(e.target.value)}
                            placeholder="Options (comma-separated)"
                            className="form-control"
                            style={{ fontSize: "11px", padding: "4px 8px" }}
                          />
                        )}
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => setIsAddColumnOpen(false)}
                            className="btn-secondary"
                            style={{ padding: "3px 8px", fontSize: "11px" }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddColumn}
                            disabled={!newColumnName.trim()}
                            className="btn-primary"
                            style={{ padding: "3px 10px", fontSize: "11px" }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>

                {/* Empty cells across records */}
                {processedRecords.map((rec) => (
                  <td
                    key={rec.id}
                    style={{
                      padding: "8px 14px",
                      borderRight: "1px solid var(--border-subtle)",
                    }}
                  >
                    <button
                      type="button"
                      aria-label={`Delete ${rec.title}`}
                      onClick={() => handleDeleteRecord(rec.id)}
                      className="btn-icon"
                      style={{ width: "20px", height: "20px", opacity: 0.3, color: "var(--danger)" }}
                      title="Delete record"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                ))}
                <td style={{ width: "40px" }} />
              </tr>
            </tbody>
          </table>
        ) : (
          /* ========================================================================= */
          /* HORIZONTAL MODE (Classic: properties as columns, records as rows) */
          /* ========================================================================= */
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 14px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    borderRight: "1px solid var(--border-subtle)",
                    width: "30%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: "var(--font-sans)", color: "var(--text-muted)" }}>
                      Aa
                    </span>
                    <span>Name</span>
                  </div>
                </th>

                {columns.map((column) => (
                  <th
                    key={column.id}
                    style={{
                      textAlign: "left",
                      padding: "8px 14px",
                      fontWeight: 500,
                      color: "var(--text-secondary)",
                      fontSize: "12px",
                      borderRight: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {renderPropertyTypeIcon(column.type, column.name)}
                        <span>{column.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn(column.id)}
                        className="btn-icon"
                        style={{ width: "16px", height: "16px", opacity: 0.4 }}
                        title={`Delete ${column.name}`}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                ))}

                {/* Add column header */}
                <th style={{ width: "40px", padding: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setIsAddColumnOpen(true)}
                    className="btn-icon"
                    style={{ width: "22px", height: "22px", color: "var(--text-muted)" }}
                    title="Add column"
                  >
                    <Plus size={13} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {processedRecords.map((record) => (
                <tr
                  key={record.id}
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {/* Name cell */}
                  <td style={{ padding: "8px 14px", borderRight: "1px solid var(--border-subtle)" }}>
                    {editingTitleId === record.id ? (
                      <input
                        type="text"
                        value={editingTitleValue}
                        onChange={(e) => setEditingTitleValue(e.target.value)}
                        onBlur={() => handleSaveRecordTitle(record.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRecordTitle(record.id);
                          if (e.key === "Escape") setEditingTitleId(null);
                        }}
                        autoFocus
                        className="form-control"
                        style={{ padding: "3px 6px", fontSize: "13px", fontWeight: 600, width: "100%" }}
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditingTitleId(record.id);
                          setEditingTitleValue(record.title);
                        }}
                        style={{ cursor: "pointer", fontWeight: 500, color: "var(--text-primary)", display: "inline-block", width: "100%" }}
                        title="Click to edit name"
                      >
                        {record.title}
                      </span>
                    )}
                  </td>

                  {/* Properties */}
                  {columns.map((column) => {
                    const val = record.properties[column.id];

                    if (column.type === "select" || column.type === "multi_select") {
                      const tags: string[] = Array.isArray(val)
                        ? val
                        : val !== undefined && val !== null && String(val) !== ""
                        ? [String(val)]
                        : [];

                      return (
                        <td key={column.id} style={{ padding: "6px 14px", borderRight: "1px solid var(--border-subtle)" }}>
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                            {tags.map((t, idx) => {
                              const badge = getPropertyBadgeStyle(t);
                              return (
                                <span
                                  key={idx}
                                  style={{
                                    backgroundColor: badge.bg,
                                    color: badge.text,
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    borderRadius: "4px",
                                    padding: "2px 7px",
                                  }}
                                >
                                  {t}
                                </span>
                              );
                            })}
                            <select
                              value=""
                              onChange={(e) => {
                                if (!e.target.value) return;
                                const next = column.type === "multi_select"
                                  ? [...tags.filter((x) => x !== e.target.value), e.target.value]
                                  : e.target.value;
                                handleUpdateRecordProperty(record.id, column.id, next);
                              }}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "var(--text-muted)",
                                fontSize: "11px",
                                cursor: "pointer",
                                outline: "none",
                              }}
                            >
                              <option value="">+ tag</option>
                              {(column.options || ["1", "2", "3", "4", "5"]).map((opt) => (
                                <option key={opt} value={opt} style={{ color: "var(--text-primary)", background: "var(--bg-surface)" }}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                      );
                    }

                    if (column.type === "date") {
                      return (
                        <td key={column.id} style={{ padding: "6px 14px", borderRight: "1px solid var(--border-subtle)" }}>
                          <input
                            type="date"
                            value={typeof val === "string" ? val : ""}
                            onChange={(e) => handleUpdateRecordProperty(record.id, column.id, e.target.value)}
                            style={{
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "4px",
                              backgroundColor: "transparent",
                              color: "var(--text-primary)",
                              padding: "2px 6px",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={column.id} style={{ padding: "6px 14px", borderRight: "1px solid var(--border-subtle)" }}>
                        <span
                          onClick={() => {
                            setEditingCell({ recordId: record.id, propId: column.id });
                            setEditingCellValue(val !== undefined && val !== null ? String(val) : "");
                          }}
                          style={{ cursor: "pointer", color: val ? "var(--text-primary)" : "var(--text-muted)" }}
                        >
                          {val !== undefined && val !== null && String(val) !== "" ? String(val) : "—"}
                        </span>
                      </td>
                    );
                  })}

                  {/* Delete row button */}
                  <td style={{ padding: "6px 10px", textAlign: "right" }}>
                    <button
                      aria-label={`Delete ${record.title}`}
                      onClick={() => handleDeleteRecord(record.id)}
                      className="btn-icon"
                      style={{ width: "20px", height: "20px", opacity: 0.3, color: "var(--danger)" }}
                      title="Delete row"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick "+ New" row at bottom */}
      <div
        onClick={() => handleCreateRecord()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 14px",
          color: "var(--text-muted)",
          fontSize: "12px",
          cursor: "pointer",
          borderTop: "1px solid var(--border-subtle)",
          transition: "background 0.1s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <Plus size={13} />
        <span>New</span>
      </div>
    </div>
  );
};
