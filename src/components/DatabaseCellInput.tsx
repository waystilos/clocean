import React, { useEffect, useState } from "react";

/** Keep partial numbers, URLs and emails local until the user commits the cell. */
export function DatabaseCellInput({ value, type, label, onSave }: {
  value: unknown;
  type: string;
  label: string;
  onSave: (value: unknown) => Promise<boolean | undefined>;
}) {
  const [draft, setDraft] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setDraft(String(value ?? "")); }, [value]);
  const save = async () => {
    if (saving || draft === String(value ?? "")) return;
    setSaving(true);
    setError("");
    try {
      const saved = await onSave(draft === "" ? null : type === "number" ? Number(draft) : draft);
      if (!saved) throw new Error("Could not save. Your edit is kept here; try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally { setSaving(false); }
  };
  return <>
    <input
      type={type === "person" ? "email" : type === "text" ? "text" : type}
      step={type === "number" ? "any" : undefined}
      value={draft}
      disabled={saving}
      aria-label={label}
      aria-invalid={Boolean(error)}
      placeholder={type === "person" ? "name@example.com" : "Empty"}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void save()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") { setDraft(String(value ?? "")); setError(""); }
      }}
      style={{ width: "100%", minHeight: 32, padding: "4px 8px", fontSize: 12, background: "transparent" }}
    />
    {error && <span role="alert" style={{ color: "var(--danger)", fontSize: 12 }}>{error}</span>}
  </>;
}
