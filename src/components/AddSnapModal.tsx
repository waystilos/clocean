import React, { useState, useRef } from "react";
import { X, Image as ImageIcon, Upload, Plus, Sparkles, Check, FileText } from "lucide-react";
import { DocAttachment, TreeNode } from "../types.ts";

interface AddSnapModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDocId: string;
  docs: TreeNode[];
  onAddSnapToDoc: (docId: string, attachment: DocAttachment) => Promise<void>;
  workspaceId: string;
  sessionToken?: string | null;
}

const PRESET_SNAPS = [
  { name: "Mobile App Screen.png", type: "image/png", size: 1450200 },
  { name: "Dashboard UI Spec.png", type: "image/png", size: 2180400 },
  { name: "Design System Palette.png", type: "image/png", size: 980100 },
  { name: "Architecture Blueprint.png", type: "image/png", size: 1750300 },
];

export const AddSnapModal: React.FC<AddSnapModalProps> = ({
  isOpen,
  onClose,
  activeDocId,
  docs,
  onAddSnapToDoc,
  workspaceId,
  sessionToken,
}) => {
  const [targetDocId, setTargetDocId] = useState(activeDocId || (docs.length > 0 ? docs[0].id : ""));
  const [snapName, setSnapName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setSnapName(file.name);
    setError(null);

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_SNAPS[0]) => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSnapName(preset.name);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalDocId = targetDocId || activeDocId;
    if (!finalDocId) {
      setError("Please select a target document for this snap.");
      return;
    }

    const finalName = snapName.trim();
    if (!finalName) {
      setError("Please enter a name for the visual snap.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      let attachmentUrl = `/api/files/sample/${encodeURIComponent(finalName)}`;
      let attachmentSize = 1048576;
      let attachmentType = "image/png";

      if (selectedFile) {
        attachmentSize = selectedFile.size;
        attachmentType = selectedFile.type || "application/octet-stream";

        // Try streaming upload to R2
        try {
          const formData = new FormData();
          formData.append("file", selectedFile);
          const headers: Record<string, string> = { "x-workspace-id": workspaceId };
          const token = sessionToken || localStorage.getItem("clocean_session_token");
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            headers,
            body: formData,
          });

          if (uploadRes.ok) {
            const uploadData = (await uploadRes.json()) as { id?: string; name?: string };
            if (uploadData.id && uploadData.name) {
              attachmentUrl = `/api/files/${uploadData.id}/${encodeURIComponent(uploadData.name)}`;
            }
          }
        } catch {
          // Fallback to sample URL
        }
      }

      const newAttachment: DocAttachment = {
        id: `snap-${Date.now()}`,
        name: finalName,
        type: attachmentType,
        size: attachmentSize,
        url: attachmentUrl,
      };

      await onAddSnapToDoc(finalDocId, newAttachment);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add snap");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
    >
      <div
        className="modal-content animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "rgba(30, 125, 107, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ImageIcon size={18} color="var(--accent)" />
            </div>
            <div>
              <h3 className="font-serif" style={{ fontSize: "17px", fontWeight: 600, margin: 0 }}>
                Attach File or Media
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                Attach design mockups, images, and files alongside your document
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ width: "28px", height: "28px" }}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Explanation Box */}
          <div
            style={{
              padding: "12px 14px",
              backgroundColor: "var(--bg-nav-active)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              gap: "10px",
              fontSize: "12px",
              lineHeight: 1.5,
              color: "var(--text-secondary)",
            }}
          >
            <Sparkles size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <strong style={{ color: "var(--text-primary)" }}>What is a Snap?</strong> A Snap is a design mockup,
              screenshot, or photo pinned to the companion side panel of a document. It keeps visual references
              immediately accessible without cluttering your written text.
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#EF4444",
                borderRadius: "var(--radius-md)",
                fontSize: "12px",
              }}
            >
              {error}
            </div>
          )}

          {/* Target Document Selector */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Target Document
            </label>
            <select
              value={targetDocId}
              onChange={(e) => setTargetDocId(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                fontSize: "13px",
                outline: "none",
              }}
            >
              {docs.filter((d) => d.type === "doc").map((d) => (
                <option key={d.id} value={d.id}>
                  📄 {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* File Upload Area */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Upload Image or Design Mockup
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,.pdf,.svg"
              style={{ display: "none" }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "20px 16px",
                textAlign: "center",
                backgroundColor: previewUrl ? "transparent" : "var(--bg-primary)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
            >
              {previewUrl ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{ maxHeight: "110px", maxWidth: "100%", borderRadius: "6px", objectFit: "contain" }}
                  />
                  <span style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 500 }}>
                    Click to choose a different file
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                  <Upload size={22} color="var(--text-muted)" />
                  <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>
                    Click to browse or drop an image
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    PNG, JPG, SVG, WebP, or PDF specs up to 25MB
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Preset Inspirations */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Or Pick a Sample Mockup
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {PRESET_SNAPS.map((preset) => (
                <button
                  type="button"
                  key={preset.name}
                  onClick={() => handleSelectPreset(preset)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid",
                    borderColor: snapName === preset.name ? "var(--accent)" : "var(--border-subtle)",
                    backgroundColor: snapName === preset.name ? "rgba(30, 125, 107, 0.1)" : "var(--bg-primary)",
                    color: snapName === preset.name ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: "11px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <FileText size={12} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Snap Title Input */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Snap Name
            </label>
            <input
              type="text"
              value={snapName}
              onChange={(e) => setSnapName(e.target.value)}
              placeholder="e.g. Mobile Checkout Screen.png"
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>

          {/* Footer Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "var(--radius-md)",
                border: "none",
                backgroundColor: "var(--accent)",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 600,
                cursor: isUploading ? "not-allowed" : "pointer",
                opacity: isUploading ? 0.7 : 1,
                transition: "all 0.15s ease",
              }}
            >
              <Plus size={15} />
              {isUploading ? "Attaching File..." : "Attach to Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
