import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  Check,
  CheckSquare,
  Square,
  ChevronRight,
  Minus,
  Code,
  Table as TableIcon,
  Lightbulb,
  AlertTriangle,
  Info,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";
import { WorkspaceMember } from "../types.ts";
import { renderInline, getCalloutConfig, CalloutConfig } from "./MarkdownRenderer.tsx";
import { EmbeddedDatabase } from "./EmbeddedDatabase.tsx";

export interface LiveMarkdownEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  members?: WorkspaceMember[];
  onSlashTrigger?: (query: string, lineIndex: number, caretPos: number) => void;
  onMentionTrigger?: (query: string, lineIndex: number, caretPos: number) => void;
  onCursorMove?: (lineIndex: number, ch: number) => void;
  placeholder?: string;
  activeLineIndex?: number | null;
  onActiveLineChange?: (lineIndex: number | null) => void;
  slashMenuVisible?: boolean;
  onSlashKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  activeOverlay?: React.ReactNode;
  workspaceId?: string;
  getAuthHeaders?: (extra?: Record<string, string>) => Record<string, string>;
}

interface LineMeta {
  isCodeFence: boolean;
  isCodeBlock: boolean;
  codeLang?: string;
  isCalloutHeader: boolean;
  isCalloutBody: boolean;
  calloutType?: string;
  isLastCalloutLine?: boolean;
  isTable: boolean;
  isTableHeader: boolean;
  isTableDivider: boolean;
  isDatabaseStart?: boolean;
  isDatabaseBody?: boolean;
  databaseId?: string;
  databaseName?: string;
  databaseBlockStartLine?: number;
  databaseBlockEndLine?: number;
}

export const LiveMarkdownEditor: React.FC<LiveMarkdownEditorProps> = ({
  content,
  onChange,
  members = [],
  onSlashTrigger,
  onMentionTrigger,
  onCursorMove,
  placeholder = "Type '/' for slash commands, '@' to mention a teammate, or click to start typing...",
  activeLineIndex: externalActiveLineIndex,
  onActiveLineChange,
  slashMenuVisible = false,
  onSlashKeyDown,
  activeOverlay,
  workspaceId = "default",
  getAuthHeaders = (extra) => extra || {},
}) => {
  const [internalActiveLineIndex, setInternalActiveLineIndex] = useState<number | null>(0);
  const activeLineIndex =
    externalActiveLineIndex !== undefined ? externalActiveLineIndex : internalActiveLineIndex;

  const setActiveLineIndex = (index: number | null) => {
    if (onActiveLineChange) {
      onActiveLineChange(index);
    } else {
      setInternalActiveLineIndex(index);
    }
  };

  const [cursorTargetPos, setCursorTargetPos] = useState<number | null>(null);
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const lines = content.split("\n");

  // Pre-calculate document line metadata (callouts, code fences, tables)
  const lineMetadata: LineMeta[] = (() => {
    let inCode = false;
    let codeLang = "";
    let activeCallout: string | null = null;
    const metas: LineMeta[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Database block detection: ```database
      if (trimmed.startsWith("```database")) {
        let endIdx = i + 1;
        let jsonContent = "";
        while (endIdx < lines.length && !lines[endIdx].trim().startsWith("```")) {
          jsonContent += lines[endIdx] + "\n";
          endIdx++;
        }
        let dbId = "";
        let dbName = "Database";
        try {
          const parsed = JSON.parse(jsonContent);
          dbId = parsed.id || "";
          dbName = parsed.name || "Database";
        } catch {
          const match = jsonContent.match(/"id"\s*:\s*"([^"]+)"/);
          if (match) dbId = match[1];
        }

        if (dbId) {
          metas.push({
            isCodeFence: false,
            isCodeBlock: false,
            isCalloutHeader: false,
            isCalloutBody: false,
            isTable: false,
            isTableHeader: false,
            isTableDivider: false,
            isDatabaseStart: true,
            isDatabaseBody: false,
            databaseId: dbId,
            databaseName: dbName,
            databaseBlockStartLine: i,
            databaseBlockEndLine: endIdx < lines.length ? endIdx : lines.length - 1,
          });
          for (let k = i + 1; k <= endIdx && k < lines.length; k++) {
            metas.push({
              isCodeFence: false,
              isCodeBlock: false,
              isCalloutHeader: false,
              isCalloutBody: false,
              isTable: false,
              isTableHeader: false,
              isTableDivider: false,
              isDatabaseStart: false,
              isDatabaseBody: true,
            });
          }
          i = endIdx;
          continue;
        }
      }

      // Code fence detection
      if (trimmed.startsWith("```")) {
        if (inCode) {
          inCode = false;
          metas.push({
            isCodeFence: true,
            isCodeBlock: true,
            isCalloutHeader: false,
            isCalloutBody: false,
            isTable: false,
            isTableHeader: false,
            isTableDivider: false,
          });
          continue;
        } else {
          inCode = true;
          codeLang = trimmed.slice(3).trim();
          metas.push({
            isCodeFence: true,
            isCodeBlock: true,
            codeLang,
            isCalloutHeader: false,
            isCalloutBody: false,
            isTable: false,
            isTableHeader: false,
            isTableDivider: false,
          });
          continue;
        }
      }

      if (inCode) {
        metas.push({
          isCodeFence: false,
          isCodeBlock: true,
          codeLang,
          isCalloutHeader: false,
          isCalloutBody: false,
          isTable: false,
          isTableHeader: false,
          isTableDivider: false,
        });
        continue;
      }

      // Callout alerts: > [!NOTE], > [!TIP], etc.
      const calloutMatch = line.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i);
      if (calloutMatch) {
        activeCallout = calloutMatch[1].toUpperCase();
        metas.push({
          isCodeFence: false,
          isCodeBlock: false,
          isCalloutHeader: true,
          isCalloutBody: false,
          calloutType: activeCallout,
          isTable: false,
          isTableHeader: false,
          isTableDivider: false,
        });
        continue;
      }

      if (line.startsWith(">") && activeCallout) {
        // Look ahead to see if the next line is also a callout body line
        const nextLine = i < lines.length - 1 ? lines[i + 1] : "";
        const isNextCallout = nextLine.startsWith(">") && !/^>\s*\[!/i.test(nextLine);
        metas.push({
          isCodeFence: false,
          isCodeBlock: false,
          isCalloutHeader: false,
          isCalloutBody: true,
          calloutType: activeCallout,
          isLastCalloutLine: !isNextCallout,
          isTable: false,
          isTableHeader: false,
          isTableDivider: false,
        });
        continue;
      } else {
        activeCallout = null;
      }

      // Markdown Tables
      if (/^\|.*\|\s*$/.test(trimmed)) {
        const isDivider = /^\|\s*[-:]+[-| :]*\|\s*$/.test(trimmed);
        const prevLine = i > 0 ? lines[i - 1].trim() : "";
        const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : "";
        const isHeader = !isDivider && /^\|\s*[-:]+[-| :]*\|\s*$/.test(nextLine);

        metas.push({
          isCodeFence: false,
          isCodeBlock: false,
          isCalloutHeader: false,
          isCalloutBody: false,
          isTable: true,
          isTableHeader: isHeader,
          isTableDivider: isDivider,
        });
        continue;
      }

      metas.push({
        isCodeFence: false,
        isCodeBlock: false,
        isCalloutHeader: false,
        isCalloutBody: false,
        isTable: false,
        isTableHeader: false,
        isTableDivider: false,
      });
    }

    return metas;
  })();

  // Auto-resize active textarea height on content changes
  useLayoutEffect(() => {
    if (activeTextareaRef.current) {
      activeTextareaRef.current.style.height = "auto";
      activeTextareaRef.current.style.height = `${Math.max(
        28,
        activeTextareaRef.current.scrollHeight
      )}px`;

      if (cursorTargetPos !== null) {
        const safePos = Math.min(cursorTargetPos, activeTextareaRef.current.value.length);
        activeTextareaRef.current.setSelectionRange(safePos, safePos);
        setCursorTargetPos(null);
      }
    }
  }, [activeLineIndex, lines[activeLineIndex ?? -1], cursorTargetPos]);

  // Focus textarea when active line changes
  useEffect(() => {
    if (activeLineIndex !== null && activeTextareaRef.current) {
      activeTextareaRef.current.focus();
    }
  }, [activeLineIndex]);

  const updateContent = (newLines: string[]) => {
    const nextContent = newLines.join("\n");
    onChange(nextContent);
  };

  const handleLineChange = (e: React.ChangeEvent<HTMLTextAreaElement>, lineIdx: number) => {
    const val = e.target.value;
    const newLines = [...lines];
    newLines[lineIdx] = val;
    updateContent(newLines);

    const pos = e.target.selectionStart;
    if (onCursorMove) onCursorMove(lineIdx, pos);

    const textBefore = val.slice(0, pos);

    // Slash command trigger
    const slashMatch = textBefore.match(/(?:^|\n|\s)\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch && onSlashTrigger) {
      onSlashTrigger(slashMatch[1].toLowerCase(), lineIdx, pos - slashMatch[1].length - 1);
    }

    // Mention trigger
    const atMatch = textBefore.match(/@([a-zA-Z0-9._ ]*)$/);
    if (atMatch && onMentionTrigger) {
      onMentionTrigger(atMatch[1].toLowerCase(), lineIdx, pos);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, lineIdx: number) => {
    const target = e.currentTarget;
    const selStart = target.selectionStart;
    const selEnd = target.selectionEnd;
    const currentLine = lines[lineIdx] || "";

    // If slash menu popup is open, delegate to parent
    if (slashMenuVisible && ["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(e.key)) {
      if (onSlashKeyDown) {
        onSlashKeyDown(e);
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      // If pressing Enter on an empty bullet/checklist, turn into empty paragraph
      if (
        currentLine.trim() === "-" ||
        currentLine.trim() === "*" ||
        currentLine.trim() === "- [ ]" ||
        currentLine.trim() === "- [x]"
      ) {
        const newLines = [...lines];
        newLines[lineIdx] = "";
        updateContent(newLines);
        return;
      }

      let nextPrefix = "";
      const left = currentLine.slice(0, selStart);
      const right = currentLine.slice(selEnd);

      // Auto-continue lists or quotes
      if (selStart === currentLine.length) {
        if (/^-\s*\[([ xX])\]\s+/.test(currentLine)) {
          nextPrefix = "- [ ] ";
        } else if (/^[-*]\s+/.test(currentLine)) {
          nextPrefix = "- ";
        } else if (/^(\d+)\.\s+/.test(currentLine)) {
          const match = currentLine.match(/^(\d+)\.\s+/);
          if (match) {
            const nextNum = parseInt(match[1], 10) + 1;
            nextPrefix = `${nextNum}. `;
          }
        } else if (/^>\s+/.test(currentLine) && !/^>\s*\[!/.test(currentLine)) {
          nextPrefix = "> ";
        }
      }

      const newLines = [
        ...lines.slice(0, lineIdx),
        left,
        nextPrefix + right,
        ...lines.slice(lineIdx + 1),
      ];

      updateContent(newLines);
      setActiveLineIndex(lineIdx + 1);
      setCursorTargetPos(nextPrefix.length);
      return;
    }

    if (e.key === "Backspace") {
      if (selStart === 0 && selEnd === 0) {
        // Strip markdown prefix first
        const prefixMatch = currentLine.match(/^(#{1,3}\s+|-\s*\[[ xX]\]\s+|[-*]\s+|\d+\.\s+|>\s*)/);
        if (prefixMatch && currentLine.length > 0) {
          e.preventDefault();
          const newLines = [...lines];
          newLines[lineIdx] = currentLine.slice(prefixMatch[0].length);
          updateContent(newLines);
          setCursorTargetPos(0);
          return;
        }

        // Merge with previous line if lineIdx > 0
        if (lineIdx > 0) {
          e.preventDefault();
          const prevLine = lines[lineIdx - 1];
          const prevLen = prevLine.length;
          const newLines = [
            ...lines.slice(0, lineIdx - 1),
            prevLine + currentLine,
            ...lines.slice(lineIdx + 1),
          ];
          updateContent(newLines);
          setActiveLineIndex(lineIdx - 1);
          setCursorTargetPos(prevLen);
          return;
        }
      }
    }

    if (e.key === "ArrowUp") {
      const textBefore = target.value.slice(0, selStart);
      if (!textBefore.includes("\n") && lineIdx > 0) {
        e.preventDefault();
        const prevIdx = lineIdx - 1;
        const targetCol = Math.min(selStart, lines[prevIdx].length);
        setActiveLineIndex(prevIdx);
        setCursorTargetPos(targetCol);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      const textAfter = target.value.slice(selEnd);
      if (!textAfter.includes("\n") && lineIdx < lines.length - 1) {
        e.preventDefault();
        const nextIdx = lineIdx + 1;
        const targetCol = Math.min(selStart, lines[nextIdx].length);
        setActiveLineIndex(nextIdx);
        setCursorTargetPos(targetCol);
        return;
      }
    }

    if (e.key === "Escape") {
      setActiveLineIndex(null);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>, lineIdx: number) => {
    const text = e.clipboardData.getData("text");
    if (text.includes("\n")) {
      e.preventDefault();
      const target = e.currentTarget;
      const selStart = target.selectionStart;
      const selEnd = target.selectionEnd;
      const currentLine = lines[lineIdx] || "";
      const left = currentLine.slice(0, selStart);
      const right = currentLine.slice(selEnd);

      const pastedLines = text.split("\n");
      pastedLines[0] = left + pastedLines[0];
      pastedLines[pastedLines.length - 1] = pastedLines[pastedLines.length - 1] + right;

      const newLines = [
        ...lines.slice(0, lineIdx),
        ...pastedLines,
        ...lines.slice(lineIdx + 1),
      ];
      updateContent(newLines);
      setActiveLineIndex(lineIdx + pastedLines.length - 1);
      setCursorTargetPos(pastedLines[pastedLines.length - 1].length - right.length);
    }
  };

  const toggleCheckbox = (lineIdx: number) => {
    const targetLine = lines[lineIdx];
    const newLines = [...lines];
    if (targetLine.includes("- [ ]")) {
      newLines[lineIdx] = targetLine.replace("- [ ]", "- [x]");
    } else if (targetLine.includes("- [x]") || targetLine.includes("- [X]")) {
      newLines[lineIdx] = targetLine.replace(/- \[[xX]\]/, "- [ ]");
    }
    updateContent(newLines);
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current) {
      if (lines.length === 0) {
        updateContent([""]);
        setActiveLineIndex(0);
      } else {
        const lastIdx = lines.length - 1;
        if (lines[lastIdx].trim() !== "") {
          updateContent([...lines, ""]);
          setActiveLineIndex(lines.length);
        } else {
          setActiveLineIndex(lastIdx);
        }
      }
    }
  };

  const renderInactiveLine = (line: string, idx: number): React.ReactNode => {
    const meta = lineMetadata[idx] || {};
    const trimmed = line.trim();

    // 1. Empty line
    if (trimmed === "") {
      return (
        <div
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(0);
          }}
          className="live-line-empty"
          style={{
            height: "24px",
            cursor: "text",
            borderRadius: "4px",
            transition: "background 0.1s ease",
          }}
          title="Click to add content"
        />
      );
    }

    // 2. Code fence ```
    if (meta.isCodeFence) {
      return (
        <div
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "12px",
            color: "var(--accent)",
            backgroundColor: "var(--bg-sidebar)",
            padding: "4px 12px",
            borderRadius: "4px",
            margin: "2px 0",
            borderLeft: "3px solid var(--accent)",
            cursor: "text",
          }}
        >
          {line}
        </div>
      );
    }

    // 3. Inside code block
    if (meta.isCodeBlock) {
      return (
        <div
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "13px",
            color: "var(--text-primary)",
            backgroundColor: "var(--bg-sidebar)",
            padding: "2px 12px",
            borderLeft: "3px solid var(--accent)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            lineHeight: 1.5,
            cursor: "text",
          }}
        >
          {line || " "}
        </div>
      );
    }

    // 4. Headings
    if (line.startsWith("# ")) {
      return (
        <h1
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "30px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "18px 0 6px 0",
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
            cursor: "text",
          }}
        >
          {renderInline(line.slice(2))}
        </h1>
      );
    }

    if (line.startsWith("## ")) {
      return (
        <h2
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "24px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "16px 0 6px 0",
            lineHeight: 1.3,
            letterSpacing: "-0.015em",
            cursor: "text",
          }}
        >
          {renderInline(line.slice(3))}
        </h2>
      );
    }

    if (line.startsWith("### ")) {
      return (
        <h3
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "19px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "14px 0 4px 0",
            lineHeight: 1.35,
            cursor: "text",
          }}
        >
          {renderInline(line.slice(4))}
        </h3>
      );
    }

    // 5. Callout Alert Header: > [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT], > [!CAUTION]
    if (meta.isCalloutHeader && meta.calloutType) {
      const config = getCalloutConfig(meta.calloutType);
      return (
        <div
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 14px",
            backgroundColor: config.bg,
            borderLeft: `3px solid ${config.border}`,
            borderRadius: "4px 4px 0 0",
            marginTop: "14px",
            color: config.color,
            fontSize: "13px",
            fontWeight: 600,
            cursor: "text",
          }}
        >
          {config.icon}
          <span>{config.label}</span>
        </div>
      );
    }

    // 6. Callout continuation line
    if (meta.isCalloutBody && meta.calloutType) {
      const config = getCalloutConfig(meta.calloutType);
      const quoteText = line.replace(/^>\s?/, "");
      return (
        <div
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            padding: "4px 14px 8px 14px",
            backgroundColor: config.bg,
            borderLeft: `3px solid ${config.border}`,
            borderRadius: meta.isLastCalloutLine ? "0 0 4px 4px" : "0",
            marginBottom: meta.isLastCalloutLine ? "14px" : "0",
            fontSize: "15px",
            color: "var(--text-primary)",
            lineHeight: 1.6,
            cursor: "text",
          }}
        >
          {renderInline(quoteText)}
        </div>
      );
    }

    // 7. General Blockquote: > Text
    if (line.startsWith(">")) {
      const quoteText = line.replace(/^>\s?/, "");
      return (
        <div
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            borderLeft: "3px solid var(--accent)",
            padding: "4px 14px",
            margin: "4px 0",
            color: "var(--text-secondary)",
            fontSize: "15px",
            lineHeight: 1.6,
            fontStyle: "italic",
            cursor: "text",
          }}
        >
          {renderInline(quoteText)}
        </div>
      );
    }

    // 8. Checklist: - [ ] or - [x]
    const checkMatch = line.match(/^-\s*\[([ xX])\]\s*(.*)$/);
    if (checkMatch) {
      const isChecked = checkMatch[1].toLowerCase() === "x";
      const itemText = checkMatch[2];
      return (
        <div
          key={`line-${idx}`}
          className={`circular-task-item ${isChecked ? "checked" : ""}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "3px 0",
            cursor: "text",
            borderRadius: "4px",
          }}
        >
          <div
            className="circular-checkbox-circle"
            onClick={(e) => {
              e.stopPropagation();
              toggleCheckbox(idx);
            }}
            style={{
              cursor: "pointer",
              marginTop: "4px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: isChecked ? "var(--text-muted)" : "transparent",
              border: `1.5px solid ${isChecked ? "var(--text-muted)" : "var(--border-subtle)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.1s ease",
            }}
          >
            {isChecked && <Check size={11} color="#FFFFFF" />}
          </div>
          <span
            style={{
              fontSize: "15px",
              color: isChecked ? "var(--text-secondary)" : "var(--text-primary)",
              textDecoration: isChecked ? "line-through" : "none",
              lineHeight: 1.6,
            }}
          >
            {renderInline(itemText)}
          </span>
        </div>
      );
    }

    // 9. Bullet list: - or *
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      return (
        <div
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "10px",
            padding: "3px 0",
            cursor: "text",
          }}
        >
          <span style={{ color: "var(--accent)", fontSize: "14px", lineHeight: 1 }}>•</span>
          <span style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--text-primary)" }}>
            {renderInline(bulletMatch[1])}
          </span>
        </div>
      );
    }

    // 10. Numbered list: 1. Item
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      return (
        <div
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "8px",
            padding: "3px 0",
            cursor: "text",
          }}
        >
          <span
            style={{
              color: "var(--text-muted)",
              fontSize: "13px",
              fontWeight: 600,
              minWidth: "18px",
            }}
          >
            {numMatch[1]}.
          </span>
          <span style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--text-primary)" }}>
            {renderInline(numMatch[2])}
          </span>
        </div>
      );
    }

    // 11. Divider: --- or ***
    if (/^(\*\*\*|---|___)\s*$/.test(line)) {
      return (
        <hr
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            border: "none",
            borderTop: "1px solid var(--border-subtle)",
            margin: "18px 0",
            cursor: "pointer",
          }}
        />
      );
    }

    // 12. Table row
    if (meta.isTable) {
      if (meta.isTableDivider) {
        return (
          <div
            key={`line-${idx}`}
            onClick={() => {
              setActiveLineIndex(idx);
              setCursorTargetPos(line.length);
            }}
            style={{
              borderBottom: "2px solid var(--border-subtle)",
              margin: "2px 0",
              cursor: "text",
            }}
          />
        );
      }
      const cells = line.split("|").slice(1, -1);
      return (
        <div
          key={`line-${idx}`}
          onClick={() => {
            setActiveLineIndex(idx);
            setCursorTargetPos(line.length);
          }}
          style={{
            display: "flex",
            gap: "16px",
            padding: "6px 12px",
            backgroundColor: meta.isTableHeader ? "var(--bg-sidebar)" : "transparent",
            fontWeight: meta.isTableHeader ? 600 : 400,
            fontSize: "14px",
            borderBottom: "1px solid var(--border-subtle)",
            cursor: "text",
          }}
        >
          {cells.map((c, cIdx) => (
            <div key={cIdx} style={{ flex: 1, minWidth: "60px" }}>
              {renderInline(c.trim())}
            </div>
          ))}
        </div>
      );
    }

    // 13. Default regular paragraph line
    return (
      <div
        key={`line-${idx}`}
        onClick={() => {
          setActiveLineIndex(idx);
          setCursorTargetPos(line.length);
        }}
        style={{
          fontSize: "15px",
          lineHeight: 1.75,
          color: "var(--text-primary)",
          padding: "2px 0",
          minHeight: "26px",
          cursor: "text",
        }}
      >
        {renderInline(line)}
      </div>
    );
  };

  const getActiveLineStyles = (line: string): React.CSSProperties => {
    const isH1 = line.startsWith("# ");
    const isH2 = line.startsWith("## ");
    const isH3 = line.startsWith("### ");
    const isCode = line.startsWith("```") || line.startsWith("    ");

    return {
      width: "100%",
      background: "rgba(30, 125, 107, 0.04)",
      border: "none",
      borderLeft: "2.5px solid var(--accent)",
      borderRadius: "2px",
      padding: "2px 0 2px 10px",
      margin: isH1 ? "14px 0 6px 0" : isH2 ? "12px 0 6px 0" : isH3 ? "10px 0 4px 0" : "2px 0",
      outline: "none",
      resize: "none",
      overflow: "hidden",
      color: "var(--text-primary)",
      fontFamily: isH1 || isH2 || isH3 ? "var(--font-serif)" : isCode ? "var(--font-mono, monospace)" : "var(--font-sans)",
      fontSize: isH1 ? "28px" : isH2 ? "23px" : isH3 ? "19px" : "15px",
      fontWeight: isH1 || isH2 || isH3 ? 600 : 400,
      lineHeight: isH1 || isH2 || isH3 ? 1.3 : 1.75,
      letterSpacing: isH1 ? "-0.02em" : isH2 ? "-0.015em" : "-0.01em",
    };
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      style={{
        minHeight: "450px",
        padding: "8px 0 60px 0",
        cursor: "text",
      }}
    >
      {lines.length === 0 ? (
        <div
          onClick={() => {
            updateContent([""]);
            setActiveLineIndex(0);
          }}
          style={{ color: "var(--text-muted)", fontSize: "16px", fontStyle: "italic", cursor: "text" }}
        >
          {placeholder}
        </div>
      ) : (
        lines.map((line, idx) => {
          const meta = lineMetadata[idx] || {};

                    if (meta.isDatabaseStart) {
            return (
              <div key={`database-block-${idx}`} style={{ cursor: "default" }}>
                <EmbeddedDatabase
                  databaseId={meta.databaseId!}
                  initialName={meta.databaseName}
                  workspaceId={workspaceId}
                  getAuthHeaders={getAuthHeaders}
                  onRemoveFromPage={() => {
                    if (meta.databaseBlockStartLine !== undefined && meta.databaseBlockEndLine !== undefined) {
                      const newLines = [...lines];
                      newLines.splice(
                        meta.databaseBlockStartLine,
                        meta.databaseBlockEndLine - meta.databaseBlockStartLine + 1
                      );
                      updateContent(newLines.length > 0 ? newLines : [""]);
                    }
                  }}
                />
              </div>
            );
          }

          if (meta.isDatabaseBody) {
            return null;
          }


          if (activeLineIndex === idx) {
            return (
              <div key={`active-wrapper-${idx}`} style={{ position: "relative" }}>
                <textarea
                  ref={activeTextareaRef}
                  value={line}
                  onChange={(e) => handleLineChange(e, idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  onPaste={(e) => handlePaste(e, idx)}
                  onSelect={(e) => {
                    if (onCursorMove) onCursorMove(idx, e.currentTarget.selectionStart);
                  }}
                  onKeyUp={(e) => {
                    if (onCursorMove) onCursorMove(idx, e.currentTarget.selectionStart);
                  }}
                  placeholder={idx === 0 ? placeholder : "Type text or '/' for commands..."}
                  rows={1}
                  style={getActiveLineStyles(line)}
                />
                {activeOverlay}
              </div>
            );
          }

          return renderInactiveLine(line, idx);
        })
      )}
    </div>
  );
};
