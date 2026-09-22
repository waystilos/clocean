import React, { useState, useRef } from "react";
import {
  Upload,
  File,
  FileText,
  FileCode,
  Folder,
  Download,
  Trash2,
  Eye,
  CheckCircle,
} from "lucide-react";
import { TreeNode } from "../types.ts";

interface DocumentsViewProps {
  files: TreeNode[];
  onUploadFile: (file: File) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
  onPreviewFile: (file: TreeNode) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  files,
  onUploadFile,
  onDeleteFile,
  onPreviewFile,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 B";
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  };

  const getFileIcon = (mimeType?: string, name: string = "") => {
    if (name.endsWith(".zip") || name.endsWith(".tar") || name.endsWith(".gz"))
      return <Folder size={18} color="var(--text-secondary)" />;
    if (name.endsWith(".pdf") || mimeType?.includes("pdf"))
      return <FileText size={18} color="var(--text-secondary)" />;
    if (name.endsWith(".xlsx") || name.endsWith(".csv"))
      return <FileCode size={18} color="var(--accent)" />;
    if (name.endsWith(".docx") || name.endsWith(".doc"))
      return <FileText size={18} color="var(--text-secondary)" />;
    return <File size={18} color="var(--text-secondary)" />;
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        await onUploadFile(fileList[i]);
      }
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload to Cloudflare R2.");
    } finally {
      setIsUploading(false);
    }
  };

  const onlyFiles = files.filter((f) => f.type === "file");

  return (
    <div
      className="animate-fade-in documents-view"
      style={{
        maxWidth: "1060px",
        margin: "0 auto",
        padding: "48px 32px",
        border: isDragging ? "2px dashed var(--accent)" : "2px solid transparent",
        borderRadius: "var(--radius-lg)",
        background: isDragging ? "var(--accent-light)" : "transparent",
        boxShadow: isDragging ? "0 0 0 4px var(--accent-light)" : "none",
        transition: "background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
      }}
      aria-label="Document upload drop zone"
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      {/* Header Row */}
      <div
        className="documents-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "32px",
        }}
      >
        <div>
          <h1
            className="font-serif"
            style={{
              fontSize: "28px",
              fontWeight: 500,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            Documents
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Zero-egress object storage powered by Cloudflare R2
          </p>
        </div>

        {/* Upload Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
            multiple
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn-primary"
          >
            <Upload size={16} />
            {isUploading ? "Uploading to R2..." : "+ Upload"}
          </button>
        </div>
      </div>

      {/* Drag & Drop Overlay Indicator */}
      {isDragging && (
        <div
          style={{
            padding: "32px",
            border: "2px dashed var(--accent)",
            borderRadius: "var(--radius-lg)",
            backgroundColor: "var(--accent-light)",
            textAlign: "center",
            marginBottom: "24px",
            color: "var(--accent-text)",
          }}
        >
          Drop files here to stream directly to Cloudflare R2
        </div>
      )}

      {/* Upload Success Feedback Toast */}
      {uploadSuccess && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            backgroundColor: "var(--accent-light)",
            border: "1px solid var(--accent)",
            borderRadius: "var(--radius-md)",
            color: "var(--accent-text)",
            fontSize: "13px",
            marginBottom: "20px",
          }}
        >
          <CheckCircle size={16} />
          File successfully saved to R2 storage.
        </div>
      )}

      {/* Documents Table (Matching Figma Table Layout) */}
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}
      >
        {/* Table Header */}
        <div
          className="documents-table-header"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 120px 140px 80px",
            padding: "14px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--text-secondary)",
            letterSpacing: "0.02em",
          }}
        >
          <div>Name</div>
          <div className="documents-table-meta" style={{ textAlign: "right" }}>Size</div>
          <div className="documents-table-meta" style={{ textAlign: "right" }}>Modified</div>
          <div style={{ textAlign: "center" }}>Actions</div>
        </div>

        {/* Table Body */}
        {onlyFiles.map((file, idx) => (
          <div
            className="documents-table-row"
            key={file.id || idx}
            onClick={() => onPreviewFile(file)}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 140px 80px",
              alignItems: "center",
              padding: "16px 24px",
              borderBottom:
                idx < onlyFiles.length - 1 ? "1px solid var(--border-subtle)" : "none",
              cursor: "pointer",
              transition: "background 0.12s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            {/* Name Column */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                {getFileIcon(file.mimeType, file.name)}
              </div>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 400,
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {file.name}
              </span>
            </div>

            {/* Size Column */}
            <div
              className="documents-table-meta"
              style={{
                textAlign: "right",
                fontSize: "13px",
                color: "var(--text-secondary)",
              }}
            >
              {formatFileSize(file.size)}
            </div>

            {/* Modified Column */}
            <div
              className="documents-table-meta"
              style={{
                textAlign: "right",
                fontSize: "13px",
                color: "var(--text-secondary)",
              }}
            >
              {file.updatedAt}
            </div>

            {/* Actions Column */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onPreviewFile(file)}
                className="btn-icon"
                title="Preview"
                style={{ width: "28px", height: "28px" }}
              >
                <Eye size={14} />
              </button>
              <a
                href={file.r2Key ? `/api/files/${file.id}/${encodeURIComponent(file.name)}` : "#"}
                download={file.name}
                className="btn-icon"
                title="Download from R2"
                style={{ width: "28px", height: "28px" }}
              >
                <Download size={14} />
              </a>
              <button
                onClick={() => {
                  if (confirm(`Delete ${file.name} from R2?`)) {
                    onDeleteFile(file.id);
                  }
                }}
                className="btn-icon"
                title="Delete"
                style={{ width: "28px", height: "28px", color: "var(--danger)" }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
