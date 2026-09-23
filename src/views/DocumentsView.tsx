import React, { useState, useRef } from "react";
import {
  Upload,
  File,
  FileText,
  FileCode,
  Folder,
  FolderPlus,
  FolderOpen,
  FolderInput,
  ChevronRight,
  ArrowLeft,
  Download,
  Trash2,
  Eye,
  CheckCircle,
  X,
  CornerDownRight,
} from "lucide-react";
import { TreeNode } from "../types.ts";

interface DocumentsViewProps {
  files: TreeNode[];
  onUploadFile: (file: File, parentId?: string | null) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
  onPreviewFile: (file: TreeNode) => void;
  onCreateFolder?: (name: string, parentId?: string | null) => Promise<TreeNode | null>;
  onMoveNode?: (nodeId: string, targetParentId: string | null) => Promise<void>;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  files,
  onUploadFile,
  onDeleteFile,
  onPreviewFile,
  onCreateFolder,
  onMoveNode,
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [movingItem, setMovingItem] = useState<TreeNode | null>(null);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

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

  const handleFiles = async (fileList: FileList | null, parentId: string | null = currentFolderId) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        await onUploadFile(fileList[i], parentId);
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

  // Build breadcrumb trail from root to current folder
  const breadcrumbTrail: TreeNode[] = [];
  let cursorId = currentFolderId;
  const visited = new Set<string>();
  while (cursorId && !visited.has(cursorId)) {
    visited.add(cursorId);
    const folder = files.find((f) => f.id === cursorId && f.type === "folder");
    if (folder) {
      breadcrumbTrail.unshift(folder);
      cursorId = folder.parentId || null;
    } else {
      break;
    }
  }

  const currentFolder = currentFolderId
    ? files.find((f) => f.id === currentFolderId && f.type === "folder") || null
    : null;

  // Filter items in active folder
  const currentItems = files.filter(
    (f) => (f.parentId || null) === (currentFolderId || null) && (f.type === "file" || f.type === "folder")
  );

  const foldersAtLevel = currentItems
    .filter((f) => f.type === "folder")
    .sort((a, b) => a.name.localeCompare(b.name));

  const filesAtLevel = currentItems
    .filter((f) => f.type === "file")
    .sort((a, b) => a.name.localeCompare(b.name));

  // Count items inside a given folder
  const getFolderItemCount = (folderId: string) => {
    return files.filter((f) => f.parentId === folderId).length;
  };

  // All folders in workspace for move destination picker
  const allWorkspaceFolders = files.filter((f) => f.type === "folder");

  // Get descendant IDs to prevent circular move
  const getDescendantIds = (folderId: string): Set<string> => {
    const descendants = new Set<string>([folderId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of files) {
        if (f.parentId && descendants.has(f.parentId) && !descendants.has(f.id)) {
          descendants.add(f.id);
          added = true;
        }
      }
    }
    return descendants;
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !onCreateFolder) return;
    setIsCreatingFolder(true);
    try {
      await onCreateFolder(newFolderName.trim(), currentFolderId);
      setNewFolderName("");
      setIsCreateFolderOpen(false);
    } catch (err) {
      console.error("Create folder failed:", err);
      alert("Failed to create folder");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleExecuteMove = async () => {
    if (!movingItem || !onMoveNode) return;
    setIsMoving(true);
    setMoveError(null);
    try {
      await onMoveNode(movingItem.id, targetMoveFolderId);
      setMovingItem(null);
      setTargetMoveFolderId(null);
    } catch (err: unknown) {
      setMoveError(err instanceof Error ? err.message : "Failed to move item");
    } finally {
      setIsMoving(false);
    }
  };

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
        handleFiles(e.dataTransfer.files, currentFolderId);
      }}
    >
      {/* Header Row */}
      {moveError && !movingItem && <p role="alert" className="feedback-error">{moveError}</p>}
      <div
        className="documents-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          gap: "16px",
          flexWrap: "wrap",
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
              margin: 0,
            }}
          >
            Files
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Upload files, organize them in folders, and preview them with your team.
          </p>
        </div>

        {/* Action Buttons: New Folder & Upload */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {onCreateFolder && (
            <button
              onClick={() => setIsCreateFolderOpen(true)}
              className="btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", fontSize: "13px" }}
              title="Create new folder"
            >
              <FolderPlus size={15} />
              <span>New folder</span>
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files, currentFolderId)}
            multiple
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "13px" }}
          >
            <Upload size={15} />
            <span>{isUploading ? "Uploading to R2..." : "+ Upload"}</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
          padding: "8px 12px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          fontSize: "13px",
        }}
      >
        {currentFolderId && (
          <button
            onClick={() => {
              const parent = currentFolder?.parentId || null;
              setCurrentFolderId(parent);
            }}
            className="btn-icon"
            style={{ width: "26px", height: "26px" }}
            title="Go to parent folder"
          >
            <ArrowLeft size={14} />
          </button>
        )}

        <button
          onClick={() => setCurrentFolderId(null)}
          style={{
            background: "transparent",
            border: "none",
            color: currentFolderId === null ? "var(--text-primary)" : "var(--accent)",
            fontWeight: currentFolderId === null ? 600 : 400,
            cursor: "pointer",
            padding: "2px 4px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <Folder size={14} />
          <span>Files</span>
        </button>

        {breadcrumbTrail.map((folder, index) => {
          const isLast = index === breadcrumbTrail.length - 1;
          return (
            <React.Fragment key={folder.id}>
              <ChevronRight size={13} style={{ color: "var(--text-muted)" }} />
              <button
                onClick={() => setCurrentFolderId(folder.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: isLast ? "var(--text-primary)" : "var(--accent)",
                  fontWeight: isLast ? 600 : 400,
                  cursor: "pointer",
                  padding: "2px 4px",
                  borderRadius: "4px",
                  maxWidth: "180px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {folder.name}
              </button>
            </React.Fragment>
          );
        })}
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
          Drop files here to upload directly to{" "}
          <strong>{currentFolder ? currentFolder.name : "Files"}</strong>
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

      {/* Documents Table */}
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
            gridTemplateColumns: "1fr 120px 140px 100px",
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
        {foldersAtLevel.length === 0 && filesAtLevel.length === 0 ? (
          <div
            style={{
              padding: "54px 24px",
              textAlign: "center",
              color: "var(--text-secondary)",
            }}
          >
            {currentFolder ? (
              <FolderOpen size={38} style={{ margin: "0 auto 12px", opacity: 0.35, display: "block" }} />
            ) : (
              <FileText size={38} style={{ margin: "0 auto 12px", opacity: 0.35, display: "block" }} />
            )}
            <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
              {currentFolder ? `"${currentFolder.name}" is empty` : "No files or folders yet"}
            </div>
            <div style={{ fontSize: "12px", marginTop: "4px", color: "var(--text-secondary)" }}>
              Drag & drop files here, or use "+ Upload" and "New folder" above
            </div>
          </div>
        ) : (
          <>
            {/* Render Folders First */}
            {foldersAtLevel.map((folder, idx) => {
              const itemCount = getFolderItemCount(folder.id);
              const isDragOver = dragOverFolderId === folder.id;
              return (
                <div
                  className="documents-table-row"
                  key={folder.id || idx}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", folder.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverFolderId(folder.id);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverFolderId(null);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverFolderId(null);
                    const draggedId = e.dataTransfer.getData("text/plain");
                    if (draggedId && draggedId !== folder.id && onMoveNode) {
                      await onMoveNode(draggedId, folder.id);
                    }
                  }}
                  onClick={() => setCurrentFolderId(folder.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px 140px 100px",
                    alignItems: "center",
                    padding: "15px 24px",
                    borderBottom: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    transition: "all 0.12s ease",
                    backgroundColor: isDragOver ? "var(--accent-light)" : "transparent",
                    outline: isDragOver ? "2px dashed var(--accent)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDragOver) e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isDragOver) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {/* Name Column */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "var(--accent-light)",
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Folder size={17} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {folder.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Folder</div>
                    </div>
                  </div>

                  {/* Size (Item count) */}
                  <div
                    className="documents-table-meta"
                    style={{
                      textAlign: "right",
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </div>

                  {/* Modified */}
                  <div
                    className="documents-table-meta"
                    style={{
                      textAlign: "right",
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {folder.updatedAt || "—"}
                  </div>

                  {/* Actions */}
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
                      onClick={() => setCurrentFolderId(folder.id)}
                      className="btn-icon"
                      title="Open folder"
                      style={{ width: "28px", height: "28px" }}
                    >
                      <ChevronRight size={15} />
                    </button>
                    {onMoveNode && (
                      <button
                        onClick={() => {
                          setMovingItem(folder);
                          setTargetMoveFolderId(folder.parentId || null);
                        }}
                        className="btn-icon"
                        title="Move folder..."
                        style={{ width: "28px", height: "28px" }}
                      >
                        <FolderInput size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Move folder "${folder.name}" and its contents to Trash? You can restore them later.`)) {
                          onDeleteFile(folder.id).catch((error) => setMoveError(error.message));
                        }
                      }}
                      className="btn-icon"
                      title="Delete folder"
                      style={{ width: "28px", height: "28px", color: "var(--danger)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Render Files */}
            {filesAtLevel.map((file, idx) => (
              <div
                className="documents-table-row"
                key={file.id || idx}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", file.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onPreviewFile(file)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 140px 100px",
                  alignItems: "center",
                  padding: "16px 24px",
                  borderBottom:
                    idx < filesAtLevel.length - 1 ? "1px solid var(--border-subtle)" : "none",
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
                    title="Download file"
                    style={{ width: "28px", height: "28px" }}
                  >
                    <Download size={14} />
                  </a>
                  {onMoveNode && (
                    <button
                      onClick={() => {
                        setMovingItem(file);
                        setTargetMoveFolderId(file.parentId || null);
                      }}
                      className="btn-icon"
                      title="Move to folder..."
                      style={{ width: "28px", height: "28px" }}
                    >
                      <FolderInput size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Move "${file.name}" to Trash? You can restore it later.`)) {
                        onDeleteFile(file.id).catch((error) => setMoveError(error.message));
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
          </>
        )}
      </div>

      {/* Create Folder Modal */}
      {isCreateFolderOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsCreateFolderOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="modal-dialog animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "420px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FolderPlus size={18} color="var(--accent)" />
                <h3 className="font-serif" style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                  Create New Folder
                </h3>
              </div>
              <button onClick={() => setIsCreateFolderOpen(false)} className="btn-icon">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateFolderSubmit} style={{ padding: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                Folder Name
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Assets, Marketing, Releases"
                maxLength={100}
                autoFocus
                className="form-control"
                style={{ width: "100%", marginBottom: "16px" }}
              />

              {currentFolder && (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
                  Will be created inside <strong>{currentFolder.name}</strong>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsCreateFolderOpen(false)}
                  disabled={isCreatingFolder}
                  className="btn-secondary"
                  style={{ padding: "6px 14px", fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="btn-primary"
                  style={{ padding: "6px 16px", fontSize: "13px" }}
                >
                  {isCreatingFolder ? "Creating…" : "Create Folder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move to Folder Modal */}
      {movingItem && (
        <div
          className="modal-overlay"
          onClick={() => setMovingItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="modal-dialog animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "460px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FolderInput size={18} color="var(--accent)" />
                <h3 className="font-serif" style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                  Move "{movingItem.name}"
                </h3>
              </div>
              <button onClick={() => setMovingItem(null)} className="btn-icon">
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
              {moveError && (
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--danger)",
                    fontSize: "12px",
                    marginBottom: "14px",
                  }}
                >
                  {moveError}
                </div>
              )}

              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 12px 0" }}>
                Select the destination folder:
              </p>

              {/* Destination Folder Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {/* Root Option */}
                <button
                  type="button"
                  onClick={() => setTargetMoveFolderId(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    border: targetMoveFolderId === null ? "2px solid var(--accent)" : "1px solid var(--border-subtle)",
                    backgroundColor: targetMoveFolderId === null ? "var(--bg-nav-active)" : "var(--bg-surface)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "13px",
                    fontWeight: targetMoveFolderId === null ? 600 : 400,
                  }}
                >
                  <Folder size={16} color="var(--accent)" />
                  <span>Files (top level)</span>
                </button>

                {/* Available Folders */}
                {(() => {
                  const invalidFolderIds =
                    movingItem.type === "folder" ? getDescendantIds(movingItem.id) : new Set<string>();

                  const validFolders = allWorkspaceFolders.filter((f) => !invalidFolderIds.has(f.id));

                  if (validFolders.length === 0) {
                    return null;
                  }

                  return validFolders.map((folder) => {
                    const isSelected = targetMoveFolderId === folder.id;
                    const isCurrentParent = (movingItem.parentId || null) === folder.id;
                    return (
                      <button
                        type="button"
                        key={folder.id}
                        onClick={() => setTargetMoveFolderId(folder.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "var(--radius-md)",
                          border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border-subtle)",
                          backgroundColor: isSelected ? "var(--bg-nav-active)" : "var(--bg-surface)",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontSize: "13px",
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <CornerDownRight size={14} color="var(--text-muted)" />
                          <Folder size={15} color="var(--accent)" />
                          <span>{folder.name}</span>
                        </div>
                        {isCurrentParent && (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Current location</span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                padding: "16px 20px",
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              <button
                type="button"
                onClick={() => setMovingItem(null)}
                disabled={isMoving}
                className="btn-secondary"
                style={{ padding: "6px 14px", fontSize: "13px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteMove}
                disabled={isMoving || (movingItem.parentId || null) === targetMoveFolderId}
                className="btn-primary"
                style={{ padding: "6px 18px", fontSize: "13px" }}
              >
                {isMoving ? "Moving…" : "Move Here"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
