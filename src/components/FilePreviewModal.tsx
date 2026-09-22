import React, { useEffect, useState } from "react";
import { X, Download, FileText, ExternalLink } from "lucide-react";
import { TreeNode, DocAttachment } from "../types.ts";
import { fetchAuthenticatedFile } from "../lib/filePreview.ts";

interface FilePreviewModalProps {
  file: TreeNode | DocAttachment | null;
  onClose: () => void;
  sessionToken?: string | null;
  userEmail?: string;
  workspaceId?: string;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose, sessionToken = null, userEmail, workspaceId = "default" }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fileUrl = file
    ? "url" in file && file.url
      ? file.url
      : `/api/files/${file.id}/${encodeURIComponent(file.name)}`
    : null;

  useEffect(() => {
    if (!fileUrl) {
      setPreviewUrl(null);
      setPreviewError(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setIsLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);

    fetchAuthenticatedFile(fileUrl, sessionToken, fetch, userEmail, workspaceId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (active) setPreviewError(error instanceof Error ? error.message : "Unable to load file preview");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl, sessionToken, userEmail, workspaceId]);

  if (!file) return null;

  const mimeType = "mimeType" in file ? file.mimeType : file.type;
  const filename = file.name.toLowerCase();
  const isImage =
    mimeType?.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].some((ext) => filename.endsWith(ext));

  const isPdf = mimeType === "application/pdf" || filename.endsWith(".pdf");
  const isText = mimeType?.startsWith("text/") || [".txt", ".md", ".csv", ".json"].some((ext) => filename.endsWith(ext));
  const renderedUrl = previewUrl || fileUrl;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 110,
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "800px",
          maxHeight: "85vh",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FileText size={18} color="var(--accent)" />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
              {file.name}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <a
              href={renderedUrl || undefined}
              download={file.name}
              className="btn-secondary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              <Download size={14} /> Download
            </a>
            <a
              href={renderedUrl || undefined}
              target="_blank"
              rel="noreferrer"
              className="btn-icon"
              title="Open in new tab"
            >
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} className="btn-icon">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div
          style={{
            flex: 1,
            padding: "24px",
            overflow: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--bg-primary)",
          }}
        >
          {isLoading ? (
            <p style={{ color: "var(--text-secondary)" }}>Loading preview…</p>
          ) : previewError ? (
            <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
              <p style={{ color: "var(--text-primary)", fontWeight: 500 }}>Preview unavailable</p>
              <p style={{ marginTop: "6px", fontSize: "13px" }}>{previewError}</p>
              <a href={fileUrl || undefined} download={file.name} className="btn-primary" style={{ marginTop: "16px" }}>
                <Download size={14} /> Download File
              </a>
            </div>
          ) : isImage ? (
            <img
              src={renderedUrl || undefined}
              alt={file.name}
              style={{
                maxWidth: "100%",
                maxHeight: "65vh",
                borderRadius: "var(--radius-md)",
                objectFit: "contain",
              }}
            />
          ) : isPdf ? (
            <iframe
              src={renderedUrl || undefined}
              title={file.name}
              sandbox="allow-scripts"
              style={{
                width: "100%",
                height: "65vh",
                border: "none",
                borderRadius: "var(--radius-md)",
              }}
            />
          ) : isText ? (
            <iframe
              src={renderedUrl || undefined}
              title={file.name}
              sandbox=""
              style={{ width: "100%", height: "65vh", border: "none", backgroundColor: "var(--bg-surface)" }}
            />
          ) : (
            <div
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                color: "var(--text-secondary)",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: "var(--bg-surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileText size={32} color="var(--accent)" />
              </div>
              <div>
                <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)" }}>
                  {file.name}
                </p>
                <p style={{ fontSize: "13px", marginTop: "4px" }}>
                  Stored securely in Cloudflare R2 bucket.
                </p>
              </div>
              <a
                href={renderedUrl || undefined}
                download={file.name}
                className="btn-primary"
                style={{ marginTop: "8px" }}
              >
                <Download size={14} /> Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
