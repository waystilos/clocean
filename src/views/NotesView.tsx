import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderPlus, Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
    const node = await onCreateNode("doc", parentId, "Untitled note");
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
    setMoveError(null);
    const moved = await onMoveNode(nodeId, parentId);
    if (!moved) setMoveError("Could not move that item. Try again.");
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
              if (node.type !== "folder" || node.id === draggedNodeId) return;
              event.preventDefault();
              setDropTargetId(node.id);
            }}
            onDragOver={(event) => {
              if (node.type !== "folder" || node.id === draggedNodeId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTargetId(node.id);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node)) return;
              setDropTargetId((current) => current === node.id ? null : current);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const nodeId = event.dataTransfer.getData("text/plain") || draggedNodeId;
              if (nodeId && node.type === "folder") void moveNode(nodeId, node.id);
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
              display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "7px 8px",
              paddingLeft: 8 + depth * 16, border: 0, borderRadius: 6, textAlign: "left", cursor: "pointer",
              background: dropTargetId === node.id ? "var(--accent)" : isSelected ? "var(--bg-nav-active)" : "transparent",
              color: dropTargetId === node.id ? "#fff" : "var(--text-primary)",
              outline: dropTargetId === node.id ? "2px solid var(--accent-hover)" : "none",
              boxShadow: dropTargetId === node.id ? "0 0 0 3px var(--accent-light)" : "none",
              opacity: draggedNodeId === node.id ? 0.45 : 1,
              transition: "background 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
            }}
          >
            {node.type === "folder" ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ width: 14 }} />}
            {node.type === "folder" ? <Folder size={15} color={dropTargetId === node.id ? "#fff" : "var(--accent)"} /> : <FileText size={15} color={dropTargetId === node.id ? "#fff" : "var(--text-secondary)"} />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{node.name}</span>
          </button>
          {node.type === "folder" && isOpen && renderTree(node.id, depth + 1)}
        </React.Fragment>
      );
    });

  return (
    <div className="notes-workspace" style={{ display: "grid", gridTemplateColumns: isTreeOpen ? "250px minmax(0, 1fr)" : "44px minmax(0, 1fr)", minHeight: "calc(100vh - 64px)" }}>
      <aside className={isTreeOpen ? "notes-tree" : "notes-tree notes-tree-collapsed"} style={{ borderRight: "1px solid var(--border-subtle)", padding: isTreeOpen ? 16 : 8, background: "var(--bg-sidebar)" }}>
        {!isTreeOpen && <button className="btn-icon" onClick={() => setIsTreeOpen(true)} title="Show notes tree" aria-label="Show notes tree"><PanelLeftOpen size={17} /></button>}
        {isTreeOpen && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong style={{ fontSize: 13 }}>Notes</strong>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn-icon" title="New folder" onClick={createFolder}><FolderPlus size={15} /></button>
            <button className="btn-icon" title="New note" onClick={() => createNote()} disabled={creating}><Plus size={16} /></button>
            <button className="btn-icon" title="Hide notes tree" onClick={() => setIsTreeOpen(false)} aria-label="Hide notes tree"><PanelLeftClose size={15} /></button>
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
      <section style={{ minWidth: 0 }}>
        <EditorView docId={activeDocId} currentUser={currentUser} workspaceId={workspaceId} sessionToken={sessionToken} onOpenFilePreview={onOpenFilePreview} />
      </section>
    </div>
  );
};
