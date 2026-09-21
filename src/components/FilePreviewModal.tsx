import React from "react";
import { X, Download, FileText, ExternalLink } from "lucide-react";
import { TreeNode, DocAttachment } from "../types.ts";

interface FilePreviewModalProps {
  file: TreeNode | DocAttachment | null;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  if (!file) return null;

  const fileUrl =
    "url" in file && file.url
      ? file.url
      : `/api/files/${file.id}/${encodeURIComponent(file.name)}`;

  const isImage =
    file.name.endsWith(".png") ||
    file.name.endsWith(".jpg") ||
    file.name.endsWith(".jpeg") ||
    file.name.endsWith(".webp") ||
    file.name.endsWith(".svg");

  const isPdf = file.name.endsWith(".pdf");

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
              href={fileUrl}
              download={file.name}
              className="btn-secondary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              <Download size={14} /> Download
            </a>
            <a
              href={fileUrl}
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
          {isImage ? (
            <img
              src={fileUrl}
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
              src={fileUrl}
              title={file.name}
              style={{
                width: "100%",
                height: "65vh",
                border: "none",
                borderRadius: "var(--radius-md)",
              }}
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
                href={fileUrl}
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
