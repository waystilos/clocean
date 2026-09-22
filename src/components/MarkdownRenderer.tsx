import React, { useState } from "react";
import {
  CheckSquare,
  Square,
  Copy,
  Check,
  AtSign,
  Info,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  ChevronRight,
  ListOrdered,
  List,
} from "lucide-react";
import { WorkspaceMember } from "../types.ts";

interface MarkdownRendererProps {
  content: string;
  onToggleCheckbox?: (lineIndex: number) => void;
  members?: WorkspaceMember[];
}

export interface CalloutConfig {
  type: "tip" | "note" | "warning" | "important" | "caution";
  label: string;
  icon: React.ReactNode;
  bg: string;
  border: string;
  color: string;
}

export const getCalloutConfig = (alertType: string): CalloutConfig => {
  const norm = alertType.toUpperCase();
  if (norm === "TIP") {
    return {
      type: "tip",
      label: "Tip",
      icon: <Lightbulb size={16} color="#1E7D6B" />,
      bg: "rgba(30, 125, 107, 0.12)",
      border: "rgba(30, 125, 107, 0.4)",
      color: "#1E7D6B",
    };
  }
  if (norm === "WARNING") {
    return {
      type: "warning",
      label: "Warning",
      icon: <AlertTriangle size={16} color="#D97706" />,
      bg: "rgba(217, 119, 6, 0.12)",
      border: "rgba(217, 119, 6, 0.4)",
      color: "#D97706",
    };
  }
  if (norm === "IMPORTANT") {
    return {
      type: "important",
      label: "Important",
      icon: <AlertCircle size={16} color="#8B5CF6" />,
      bg: "rgba(139, 92, 246, 0.12)",
      border: "rgba(139, 92, 246, 0.4)",
      color: "#8B5CF6",
    };
  }
  if (norm === "CAUTION") {
    return {
      type: "caution",
      label: "Caution",
      icon: <ShieldAlert size={16} color="#EF4444" />,
      bg: "rgba(239, 68, 68, 0.12)",
      border: "rgba(239, 68, 68, 0.4)",
      color: "#EF4444",
    };
  }
  return {
    type: "note",
    label: "Note",
    icon: <Info size={16} color="#0284C7" />,
    bg: "rgba(2, 132, 199, 0.12)",
    border: "rgba(2, 132, 199, 0.4)",
    color: "#0284C7",
  };
};

export const renderInline = (text: string): React.ReactNode => {
  if (!text) return null;

  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

    while (remaining.length > 0) {
      // 1. Teammate Mention: @First Last or @email or @First
      const mentionMatch = remaining.match(
        /^@([A-Z][a-zA-Z]*(?:\s[A-Z][a-zA-Z]*)+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9_-]+)/
      );
      if (mentionMatch) {
        const mentionText = mentionMatch[0];
        tokens.push(
          <span
            key={`mention-${keyIdx++}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              padding: "1px 6px",
              backgroundColor: "var(--accent-light)",
              color: "var(--accent-text)",
              borderRadius: "4px",
              fontWeight: 500,
              fontSize: "13px",
              margin: "0 2px",
            }}
          >
            <AtSign size={11} />
            {mentionText.replace(/^@/, "")}
          </span>
        );
        remaining = remaining.slice(mentionMatch[0].length);
        continue;
      }

      // 2. Bold: **text**
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        tokens.push(
          <strong key={`bold-${keyIdx++}`} style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // 3. Italic: *text*
      const italicMatch = remaining.match(/^\*([^*]+)\*/);
      if (italicMatch) {
        tokens.push(
          <em key={`italic-${keyIdx++}`} style={{ fontStyle: "italic" }}>
            {italicMatch[1]}
          </em>
        );
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // 4. Inline Code: `text`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        tokens.push(
          <code
            key={`code-${keyIdx++}`}
            style={{
              padding: "2px 6px",
              backgroundColor: "var(--bg-surface-hover)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "4px",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--accent-text)",
            }}
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // 5. Link: [label](url) with XSS protection (prevent javascript:)
      const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const rawHref = linkMatch[2].trim();
        const isSafe =
          /^https?:\/\//i.test(rawHref) ||
          /^mailto:/i.test(rawHref) ||
          (rawHref.startsWith("/") && !rawHref.startsWith("//") && !rawHref.startsWith("/\\")) ||
          rawHref.startsWith("#");
        const safeHref = isSafe ? rawHref : "#";

        tokens.push(
          <a
            key={`link-${keyIdx++}`}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--accent)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            {linkMatch[1]}
          </a>
        );
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }

      // Plain character
      const nextSpecial = remaining.slice(1).search(/[@*`\[]/);
      if (nextSpecial === -1) {
        tokens.push(remaining);
        break;
      } else {
        tokens.push(remaining.slice(0, nextSpecial + 1));
        remaining = remaining.slice(nextSpecial + 1);
      }
    }

    return tokens;
  };

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onToggleCheckbox,
  members = [],
}) => {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  // Helper: extract all headings for Table of Contents
  const extractHeadings = () => {
    const rawLines = content.split("\n");
    const headings: { level: number; text: string; id: string }[] = [];
    rawLines.forEach((l) => {
      const match = l.match(/^(#{1,3})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        headings.push({ level, text, id });
      }
    });
    return headings;
  };

  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Block: ```lang
    if (line.trim().startsWith("```")) {
      const lang = line.trim().replace(/^```/, "").trim() || "plaintext";
      const codeLines: string[] = [];
      const codeIdx = i;
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const fullCode = codeLines.join("\n");

      renderedElements.push(
        <div
          key={`codeblock-${codeIdx}`}
          style={{
            margin: "18px 0",
            backgroundColor: "var(--bg-sidebar)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 14px",
              backgroundColor: "var(--bg-surface)",
              borderBottom: "1px solid var(--border-subtle)",
              fontSize: "11px",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              textTransform: "lowercase",
            }}
          >
            <span>{lang}</span>
            <button
              onClick={() => handleCopyCode(fullCode, codeIdx)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "11px",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
              title="Copy code"
            >
              {copiedCodeIdx === codeIdx ? (
                <>
                  <Check size={12} color="var(--accent)" />
                  <span style={{ color: "var(--accent)" }}>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre
            style={{
              padding: "14px 16px",
              margin: 0,
              overflowX: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              lineHeight: 1.6,
              color: "var(--text-primary)",
            }}
          >
            <code>{fullCode}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 2. GFM Markdown Table: | Header 1 | Header 2 |
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines: string[] = [];
      const tableStartIdx = i;
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());

        const sepRow = tableLines[1]
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        const alignments = sepRow.map((col) => {
          if (col.startsWith(":") && col.endsWith(":")) return "center";
          if (col.endsWith(":")) return "right";
          return "left";
        });

        const dataRows = tableLines.slice(2).map((r) =>
          r
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim())
        );

        renderedElements.push(
          <div
            key={`table-${tableStartIdx}`}
            style={{
              margin: "20px 0",
              overflowX: "auto",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "var(--bg-nav-active)" }}>
                  {headerRow.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      style={{
                        padding: "10px 14px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        borderBottom: "1px solid var(--border-subtle)",
                        textAlign: (alignments[hIdx] as any) || "left",
                      }}
                    >
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom: rIdx < dataRows.length - 1 ? "1px solid var(--border-subtle)" : "none",
                      transition: "background 0.1s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          padding: "10px 14px",
                          color: "var(--text-primary)",
                          textAlign: (alignments[cIdx] as any) || "left",
                        }}
                      >
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 3. Table of Contents: [TOC] or /toc
    if (line.trim() === "[TOC]" || line.trim() === "[[TOC]]" || line.trim() === "/toc") {
      const headings = extractHeadings();
      renderedElements.push(
        <div
          key={`toc-${i}`}
          style={{
            margin: "20px 0",
            padding: "16px 20px",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "12px",
            }}
          >
            <List size={14} color="var(--accent)" /> Table of Contents
          </div>
          {headings.length === 0 ? (
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              No headings found in document. Add # H1 or ## H2 to populate outline.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {headings.map((h, hIdx) => (
                <a
                  key={hIdx}
                  href={`#${h.id}`}
                  style={{
                    fontSize: "13px",
                    color: "var(--text-primary)",
                    textDecoration: "none",
                    paddingLeft: `${(h.level - 1) * 16}px`,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                >
                  <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{h.level === 1 ? "●" : "–"}</span>
                  <span>{h.text}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      );
      i++;
      continue;
    }

    // 4. Callout Alert Block: > [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT], > [!CAUTION]
    const alertMatch = line.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i);
    if (alertMatch) {
      const calloutType = alertMatch[1];
      const config = getCalloutConfig(calloutType);
      const calloutLines: string[] = [];
      const calloutIdx = i;

      i++;
      while (i < lines.length && lines[i].startsWith(">")) {
        const contentLine = lines[i].replace(/^>\s?/, "");
        if (contentLine.trim()) calloutLines.push(contentLine);
        i++;
      }

      renderedElements.push(
        <div
          key={`callout-${calloutIdx}`}
          style={{
            margin: "18px 0",
            padding: "14px 18px",
            backgroundColor: config.bg,
            borderLeft: `4px solid ${config.color}`,
            borderRadius: "0 var(--radius-md) var(--radius-md) 0",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "13px", color: config.color }}>
            {config.icon}
            <span>{config.label}</span>
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.6 }}>
            {calloutLines.map((cl, clIdx) => (
              <div key={clIdx}>{renderInline(cl)}</div>
            ))}
          </div>
        </div>
      );
      continue;
    }

    // 5. Toggle Accordion Block: <details><summary>Title</summary>...lines...</details> or > [toggle] Title
    if (line.trim().startsWith("<details>") || line.startsWith("> [toggle] ") || line.startsWith("> [details] ")) {
      const toggleIdx = i;
      let summaryTitle = "Details";
      const toggleContentLines: string[] = [];

      if (line.startsWith("> [toggle] ") || line.startsWith("> [details] ")) {
        summaryTitle = line.replace(/^>\s*\[(toggle|details)\]\s*/, "").trim() || "Details";
        i++;
        while (i < lines.length && lines[i].startsWith(">")) {
          toggleContentLines.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
      } else {
        // HTML <details> block
        i++;
        while (i < lines.length && !lines[i].includes("</details>")) {
          if (lines[i].includes("<summary>")) {
            summaryTitle = lines[i].replace(/<\/?summary>/g, "").trim();
          } else {
            toggleContentLines.push(lines[i]);
          }
          i++;
        }
        i++; // skip </details>
      }

      renderedElements.push(
        <details
          key={`toggle-${toggleIdx}`}
          style={{
            margin: "14px 0",
            padding: "10px 14px",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
          }}
        >
          <summary
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              outline: "none",
              userSelect: "none",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <ChevronRight size={14} color="var(--accent)" />
            <span>{summaryTitle}</span>
          </summary>
          <div
            style={{
              paddingTop: "10px",
              paddingLeft: "20px",
              fontSize: "14px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {toggleContentLines.map((tcl, tIdx) => (
              <div key={tIdx}>{renderInline(tcl)}</div>
            ))}
          </div>
        </details>
      );
      continue;
    }

    // 6. Dividers: --- or ***
    if (line.trim() === "---" || line.trim() === "***") {
      renderedElements.push(
        <hr
          key={`hr-${i}`}
          style={{
            border: "none",
            borderTop: "1px solid var(--border-subtle)",
            margin: "24px 0",
          }}
        />
      );
      i++;
      continue;
    }

    // 7. Headings: #, ##, ###
    if (line.startsWith("# ")) {
      const headingText = line.slice(2);
      const headingId = headingText.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      renderedElements.push(
        <h1
          key={`h1-${i}`}
          id={headingId}
          className="font-serif"
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "24px 0 12px",
            letterSpacing: "-0.01em",
            lineHeight: 1.25,
            scrollMarginTop: "80px",
          }}
        >
          {renderInline(headingText)}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      const headingText = line.slice(3);
      const headingId = headingText.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      renderedElements.push(
        <h2
          key={`h2-${i}`}
          id={headingId}
          className="font-serif"
          style={{
            fontSize: "22px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "20px 0 10px",
            letterSpacing: "-0.01em",
            lineHeight: 1.3,
            scrollMarginTop: "80px",
          }}
        >
          {renderInline(headingText)}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      const headingText = line.slice(4);
      const headingId = headingText.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      renderedElements.push(
        <h3
          key={`h3-${i}`}
          id={headingId}
          className="font-serif"
          style={{
            fontSize: "17px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "16px 0 8px",
            lineHeight: 1.35,
            scrollMarginTop: "80px",
          }}
        >
          {renderInline(headingText)}
        </h3>
      );
      i++;
      continue;
    }

    // 8. Interactive Checklists: - [ ] or - [x]
    if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) {
      const isChecked = line.startsWith("- [x] ");
      const itemText = line.slice(6);
      const lineIdx = i;

      renderedElements.push(
        <div
          key={`check-${lineIdx}`}
          onClick={() => onToggleCheckbox?.(lineIdx)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "4px 0",
            cursor: onToggleCheckbox ? "pointer" : "default",
            userSelect: "none",
          }}
        >
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "3px",
              backgroundColor: isChecked ? "var(--accent)" : "transparent",
              border: `1.5px solid ${isChecked ? "var(--accent)" : "var(--border-subtle)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.1s ease",
              flexShrink: 0,
            }}
          >
            {isChecked && <CheckSquare size={12} color="#FFFFFF" />}
          </div>
          <span
            style={{
              fontSize: "15px",
              color: isChecked ? "var(--text-secondary)" : "var(--text-primary)",
              textDecoration: isChecked ? "line-through" : "none",
              lineHeight: 1.5,
            }}
          >
            {renderInline(itemText)}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // 9. Numbered Lists: 1. item
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      renderedElements.push(
        <div
          key={`num-${i}`}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "3px 0 3px 6px",
            fontSize: "15px",
            color: "var(--text-primary)",
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: "var(--accent)", fontWeight: 600, fontSize: "14px", minWidth: "16px" }}>
            {numMatch[1]}.
          </span>
          <div>{renderInline(numMatch[2])}</div>
        </div>
      );
      i++;
      continue;
    }

    // 10. Standard Blockquote: > quote
    if (line.startsWith("> ")) {
      renderedElements.push(
        <div
          key={`quote-${i}`}
          style={{
            borderLeft: "3px solid var(--accent)",
            backgroundColor: "var(--accent-light)",
            padding: "10px 16px",
            borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
            margin: "12px 0",
            fontSize: "14px",
            fontStyle: "italic",
            color: "var(--text-primary)",
            lineHeight: 1.6,
          }}
        >
          {renderInline(line.slice(2))}
        </div>
      );
      i++;
      continue;
    }

    // 11. Bullet Lists: - item or * item
    if (line.startsWith("- ") || line.startsWith("* ")) {
      renderedElements.push(
        <div
          key={`bullet-${i}`}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            padding: "3px 0 3px 12px",
            fontSize: "15px",
            color: "var(--text-primary)",
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: "var(--accent)", fontSize: "18px", lineHeight: "14px" }}>•</span>
          <div>{renderInline(line.slice(2))}</div>
        </div>
      );
      i++;
      continue;
    }

    // 12. Empty line spacer
    if (!line.trim()) {
      renderedElements.push(<div key={`spacer-${i}`} style={{ height: "12px" }} />);
      i++;
      continue;
    }

    // 13. Normal Paragraph
    renderedElements.push(
      <p
        key={`p-${i}`}
        style={{
          fontSize: "15px",
          lineHeight: 1.75,
          color: "var(--text-primary)",
          margin: "6px 0",
        }}
      >
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return (
    <div
      className="clocean-markdown-body"
      style={{
        width: "100%",
        fontFamily: "var(--font-sans)",
        color: "var(--text-primary)",
      }}
    >
      {renderedElements}
    </div>
  );
};
