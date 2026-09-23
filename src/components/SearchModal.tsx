import React, { useEffect, useRef, useState } from "react";
import { Search, X, FileText, Folder, ListCheck } from "lucide-react";
import { TreeNode, TaskItem } from "../types.ts";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: TreeNode[];
  tasks: TaskItem[];
  onSelectDoc: (id: string) => void;
  onSelectView: (view: "documents" | "tasks") => void;
  onSelectFile?: (file: TreeNode) => void;
  onSelectTask?: (task: TaskItem) => void;
}
export function SearchModal({ isOpen, onClose, files, tasks, onSelectDoc, onSelectView, onSelectFile, onSelectTask }: SearchModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (isOpen) { setQuery(""); element.showModal(); }
    else element.close();
  }, [isOpen]);
  const term = query.trim().toLowerCase();
  const matches = files.filter((file) => file.type !== "folder" && [file.name, ...(file.tags || [])].join(" ").toLowerCase().includes(term));
  const matchingTasks = tasks.filter((task) => task.title.toLowerCase().includes(term));
  const choose = (action: () => void) => { onClose(); action(); };
  return <dialog ref={dialog} className="search-dialog" aria-label="Search workspace" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="search-dialog-content">
      <div className="search-dialog-header"><Search size={18} /><input autoFocus aria-label="Search workspace" placeholder="Search pages, files, and loaded tasks…" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="btn-icon" aria-label="Close search" onClick={onClose}><X size={18} /></button></div>
      <div className="search-results">
        {matches.length > 0 && <h2>Pages and files</h2>}
        {matches.map((file) => <button className="search-result" key={file.id} onClick={() => choose(() => file.type === "doc" ? onSelectDoc(file.id) : onSelectFile ? onSelectFile(file) : onSelectView("documents"))}>{file.type === "doc" ? <FileText size={16} /> : <Folder size={16} />}<span>{file.name}</span><small>{file.type === "doc" ? "Page" : "File"}</small></button>)}
        {matchingTasks.length > 0 && <h2>Loaded tasks</h2>}
        {matchingTasks.map((task) => <button className="search-result" key={task.id} onClick={() => choose(() => onSelectTask ? onSelectTask(task) : onSelectView("tasks"))}><ListCheck size={16} /><span>{task.title}</span><small>{task.status}</small></button>)}
        {!matches.length && !matchingTasks.length && <p className="view-description">No results for “{query}”. Try another name or tag.</p>}
      </div>
      <p className="search-help">Tab to a result · Enter to open · Esc to close</p>
    </div>
  </dialog>;
}
