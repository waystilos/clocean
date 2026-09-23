import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderPlus, Plus, PanelLeftClose, PanelLeftOpen, Trash2 } from "lucide-react";
import { TreeNode, UserProfile, DocAttachment } from "../types.ts";
import { EditorView } from "./EditorView.tsx";

interface NotesViewProps {
  tree: TreeNode[];
  activeDocId: string;
  currentUser: UserProfile;
  workspaceId: string;
  sessionToken?: string | null;
  onSelectDoc: (docId: string) => void;
  onCreateNode: (type: "doc" | "folder", parentId: string | null, name: string) => Promise<TreeNode | null>;
  onMoveNode: (nodeId: string, parentId: string | null) => Promise<TreeNode | null>;
  onOpenFilePreview?: (attachment: DocAttachment) => void;
  openSnapsTrigger?: number;
  onDeleteNode?: (nodeId: string) => Promise<void> | void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  tree,
  activeDocId,
  currentUser,
  workspaceId,
  sessionToken,
  onSelectDoc,
  onCreateNode,
  onMoveNode,
  onOpenFilePreview,
  openSnapsTrigger,
  onDeleteNode,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isTreeOpen, setIsTreeOpen] = useState(true);
  const nodes = useMemo(() => tree.filter((node) => node.type === "doc" || node.type === "folder"), [tree]);
  const childrenOf = (parentId: string | null) => nodes.filter((node) => node.parentId === parentId);

  const createNote = async (parentId: string | null = null) => {
    setCreating(true);
    const node = await onCreateNode("doc", parentId, "Untitled document");
    if (node) onSelectDoc(node.id);
    setCreating(false);
  };

  const createFolder = async () => {
    const name = window.prompt("Folder name", "New folder")?.trim();
    if (!name) return;
    await onCreateNode("folder", null, name);
  };

  const moveNode = async (nodeId: string, parentId: string | null) => {
    if (nodeId === parentId) return;
    const targetNode = tree.find((n) => n.id === nodeId);
    if (targetNode && targetNode.parentId === parentId) {
      setDraggedNodeId(null);
      setDropTargetId(null);
      return;
    }
    setMoveError(null);
    const moved = await onMoveNode(nodeId, parentId);
    if (!moved) {
      setMoveError("Could not move that item. Try again.");
    } else {
      setMoveError(null);
    }
    setDraggedNodeId(null);
    setDropTargetId(null);
  };

  const renderTree = (parentId: string | null, depth = 0): React.ReactNode =>
    childrenOf(parentId).map((node) => {
      const children = childrenOf(node.id);
      const isOpen = expanded.has(node.id);
      const isSelected = node.id === activeDocId;
      return (
        <React.Fragment key={node.id}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              borderRadius: 6,
              background: dropTargetId === node.id ? "var(--accent)" : isSelected ? "var(--bg-nav-active)" : "transparent",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget.querySelector(".notes-tree-del-btn") as HTMLElement;
              if (btn) btn.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget.querySelector(".notes-tree-del-btn") as HTMLElement;
              if (btn) btn.style.opacity = "0";
            }}
          >
            <button
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", node.id);
                setDraggedNodeId(node.id);
                setMoveError(null);
              }}
              onDragEnd={() => {
                setDraggedNodeId(null);
                setDropTargetId(null);
              }}
              onDragEnter={(event) => {
                event.stopPropagation();
                if (node.type !== "folder" || node.id === draggedNodeId) return;
                event.preventDefault();
                setDropTargetId(node.id);
              }}
              onDragOver={(event) => {
                event.stopPropagation();
                if (node.type !== "folder" || node.id === draggedNodeId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetId(node.id);
              }}
              onDragLeave={(event) => {
                event.stopPropagation();
                if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                setDropTargetId((current) => current === node.id ? null : current);
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const nodeId = event.dataTransfer.getData("text/plain") || draggedNodeId;
                if (nodeId && node.type === "folder" && nodeId !== node.id) {
                  void moveNode(nodeId, node.id);
                }
              }}
              onClick={() => {
                if (node.type === "folder") setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
                  return next;
                });
                else onSelectDoc(node.id);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, padding: "7px 8px",
                paddingLeft: 8 + depth * 16, border: 0, borderRadius: 6, textAlign: "left", cursor: "pointer",
                background: "transparent",
                color: dropTargetId === node.id ? "#fff" : "var(--text-primary)",
                outline: dropTargetId === node.id ? "2px solid var(--accent-hover)" : "none",
                boxShadow: dropTargetId === node.id ? "0 0 0 3px var(--accent-light)" : "none",
                opacity: draggedNodeId === node.id ? 0.45 : 1,
                transition: "opacity 0.15s ease",
              }}
            >
              {node.type === "folder" ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ width: 14 }} />}
              {node.type === "folder" ? <Folder size={15} color={dropTargetId === node.id ? "#fff" : "var(--accent)"} /> : <FileText size={15} color={dropTargetId === node.id ? "#fff" : "var(--text-secondary)"} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{node.name}</span>
            </button>
            {onDeleteNode && (
              <button
                className="notes-tree-del-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Move ${node.type === "folder" ? "folder and its contents" : "page"} "${node.name}" to Trash? You can restore it later.`)) {
                    Promise.resolve(onDeleteNode(node.id)).catch((err) => setMoveError(err instanceof Error ? err.message : "Could not move item to Trash."));
                  }
                }}
                title={`Delete ${node.name}`}
                aria-label={`Delete ${node.name}`}
                style={{
                  opacity: 0,
                  transition: "opacity 0.15s ease, color 0.15s ease",
                  width: 22,
                  height: 22,
                  marginRight: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--radius-sm)",
                  border: 0,
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--danger, #ef4444)";
                  e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          {node.type === "folder" && isOpen && renderTree(node.id, depth + 1)}
        </React.Fragment>
      );
    });

  return (
    <div className="notes-workspace" style={{ display: "grid", gridTemplateColumns: isTreeOpen ? "250px minmax(0, 1fr)" : "44px minmax(0, 1fr)", minHeight: "calc(100vh - 64px)", width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
      <aside className={isTreeOpen ? "notes-tree" : "notes-tree notes-tree-collapsed"} style={{ borderRight: "1px solid var(--border-subtle)", padding: isTreeOpen ? 16 : 8, background: "var(--bg-sidebar)" }}>
        {!isTreeOpen && <button className="btn-icon" onClick={() => setIsTreeOpen(true)} title="Show documents tree" aria-label="Show documents tree"><PanelLeftOpen size={17} /></button>}
        {isTreeOpen && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong style={{ fontSize: 13 }}>Documents</strong>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn-icon" title="New folder" onClick={createFolder}><FolderPlus size={15} /></button>
            <button className="btn-icon" title="New document" onClick={() => createNote()} disabled={creating}><Plus size={16} /></button>
            <button className="btn-icon" title="Hide documents tree" onClick={() => setIsTreeOpen(false)} aria-label="Hide documents tree"><PanelLeftClose size={15} /></button>
          </div>
        </div>
        {moveError && <div role="alert" style={{ color: "var(--danger, #b42318)", fontSize: 12, marginBottom: 8 }}>{moveError}</div>}
        <div
          onDragEnter={(event) => {
            if (!draggedNodeId) return;
            event.preventDefault();
            setDropTargetId("root");
          }}
          onDragOver={(event) => {
            if (!draggedNodeId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDropTargetId("root");
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) return;
            setDropTargetId((current) => current === "root" ? null : current);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const nodeId = event.dataTransfer.getData("text/plain") || draggedNodeId;
            if (nodeId) void moveNode(nodeId, null);
          }}
          style={{
            minHeight: 80,
            borderRadius: 8,
            padding: dropTargetId === "root" ? 6 : 0,
            background: dropTargetId === "root" ? "var(--accent)" : "transparent",
            outline: dropTargetId === "root" ? "2px solid var(--accent-hover)" : "none",
            boxShadow: dropTargetId === "root" ? "0 0 0 3px var(--accent-light)" : "none",
            transition: "background 0.15s ease, box-shadow 0.15s ease",
          }}
          aria-label="Workspace root drop target"
          aria-dropeffect="move"
        >
          {dropTargetId === "root" && <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, padding: "4px 6px 8px" }}>Move to workspace root</div>}
          {renderTree(null)}
        </div>
        </>}
      </aside>
      <section style={{ minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}>
        {activeDocId ? <EditorView
          key={`${workspaceId}:${activeDocId}`}
          docId={activeDocId}
          currentUser={currentUser}
          workspaceId={workspaceId}
          sessionToken={sessionToken}
          onOpenFilePreview={onOpenFilePreview}
          openSnapsTrigger={openSnapsTrigger}
          onDeleteDoc={onDeleteNode}
        /> : <div className="notes-empty"><h2 className="font-serif">No page open</h2><p>Create a page to start writing, or restore one from Trash.</p><button className="btn-primary" onClick={() => void createNote()}>New page</button></div>}
      </section>
    </div>
  );
};
