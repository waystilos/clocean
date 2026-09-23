import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MarkdownRenderer } from "../src/components/MarkdownRenderer.tsx";

describe("MarkdownRenderer & Table Engine", () => {
  it("should render markdown tables with columns, headers, and rows correctly", () => {
    const markdownWithTable = `# Project Deliverables

| Milestone | Assignee | Status |
| :--- | :---: | ---: |
| Cloudflare R2 Database | @Alex | Complete |
| Interactive Kanban Board | @Marcus | Complete |
| Markdown Table Engine | @Elena | In Progress |
`;

    const html = renderToString(
      React.createElement(MarkdownRenderer, { content: markdownWithTable })
    );

    expect(html).toContain("<table");
    expect(html).toContain("Milestone");
    expect(html).toContain("Assignee");
    expect(html).toContain("Status");
    expect(html).toContain("Cloudflare R2 Database");
    expect(html).toContain("Complete");
    expect(html).toContain("Interactive Kanban Board");
    expect(html).toContain("Markdown Table Engine");
  });

  it("should render interactive checklists with checkbox states", () => {
    const checklistMarkdown = `# Sprint Tasks
- [x] Configure Zero Trust Access
- [ ] Connect durable objects room
`;

    const html = renderToString(
      React.createElement(MarkdownRenderer, { content: checklistMarkdown })
    );

    expect(html).toContain("Configure Zero Trust Access");
    expect(html).toContain("Connect durable objects room");
    expect(html).toContain("line-through");
  });

  it("should render code blocks with syntax styling", () => {
    const codeMarkdown = "```typescript\nconst edgeUrl = 'https://clocean.co';\n```";

    const html = renderToString(
      React.createElement(MarkdownRenderer, { content: codeMarkdown })
    );

    expect(html).toContain("typescript");
    expect(html).toContain("const edgeUrl = &#x27;https://clocean.co&#x27;;");
    expect(html).toContain("Copy");
  });

  it("should highlight @ teammate mentions with pill badge", () => {
    const mentionMarkdown = "Please review this @Elena Rostova and notify @Marcus!";

    const html = renderToString(
      React.createElement(MarkdownRenderer, { content: mentionMarkdown })
    );

    expect(html).toContain("Elena Rostova");
    expect(html).toContain("Marcus");
  });

  it("should render GitHub alert callouts ([!NOTE], [!TIP], [!WARNING], [!IMPORTANT], [!CAUTION])", () => {
    const calloutMarkdown = `> [!NOTE]
> This is an important system note.

> [!TIP]
> Use keyboard shortcuts to speed up editing.

> [!WARNING]
> Proceed with caution when deleting workspaces.

> [!IMPORTANT]
> Keep your R2 credentials secure.
`;

    const html = renderToString(
      React.createElement(MarkdownRenderer, { content: calloutMarkdown })
    );

    expect(html).toContain("This is an important system note.");
    expect(html).toContain("Use keyboard shortcuts to speed up editing.");
    expect(html).toContain("Proceed with caution when deleting workspaces.");
    expect(html).toContain("Keep your R2 credentials secure.");
  });

  it("should render toggle accordions for expandable details", () => {
    const toggleMarkdown = `> [toggle] Advanced Edge Architecture
> Everything runs on Cloudflare Workers and Durable Objects.
`;

    const html = renderToString(
      React.createElement(MarkdownRenderer, { content: toggleMarkdown })
    );

    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Advanced Edge Architecture");
    expect(html).toContain("Everything runs on Cloudflare Workers and Durable Objects.");
  });

  it("should render auto-generated Table of Contents with jump anchors", () => {
    const tocMarkdown = `[TOC]

# Introduction
First section overview.

## Architecture
Second section details.

### Storage Layer
Third section deep dive.
`;

    const html = renderToString(
      React.createElement(MarkdownRenderer, { content: tocMarkdown })
    );

    expect(html).toContain("Table of Contents");
    expect(html).toContain('href="#introduction"');
    expect(html).toContain('href="#architecture"');
    expect(html).toContain('href="#storage-layer"');
  });

  it("should defensively sanitize malicious links against javascript: and data: XSS attacks", () => {
    const maliciousMarkdown = `
[Safe HTTPS Link](https://clocean.co)
[Safe Mailto Link](mailto:security@clocean.co)
[Safe Anchor Link](#section-1)
[Safe Relative Link](/docs/manifesto)
[Malicious JavaScript Link](javascript:alert(document.domain))
[Malicious Data URI Link](data:text/html,<script>alert(1)</script>)
[Malicious VBScript Link](vbscript:msgbox(1))
`;

    const html = renderToString(
      React.createElement(MarkdownRenderer, { content: maliciousMarkdown })
    );

    // Safe links must be preserved
    expect(html).toContain('href="https://clocean.co"');
    expect(html).toContain('href="mailto:security@clocean.co"');
    expect(html).toContain('href="#section-1"');
    expect(html).toContain('href="/docs/manifesto"');

    // Malicious links MUST NOT contain the payload in href and must be neutralized to "#"
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('href="data:');
    expect(html).not.toContain('href="vbscript:');
    expect(html).toContain('href="#"');
  });
});
import { LiveMarkdownEditor } from "../src/components/LiveMarkdownEditor.tsx";

describe("LiveMarkdownEditor Hybrid WYSIWYG Engine", () => {
  it("should render formatted elements for inactive lines and raw markdown textarea ONLY for the active line", () => {
    const docContent = `# Welcome to bleacher_labs
> [!NOTE]
> Workspace initialized for **Ardon Bailey**
- **Notes**: Collaborative block authoring
- [ ] Review sprint backlog`;

    // 1. Line 0 (H1) is active: should render textarea for line 0, but regular formatted elements for lines 1..4
    const htmlWithLine0Active = renderToString(
      React.createElement(LiveMarkdownEditor, {
        content: docContent,
        onChange: () => {},
        activeLineIndex: 0,
      })
    );

    // Line 0 is active, so it has a textarea containing "# Welcome to bleacher_labs"
    expect(htmlWithLine0Active).toContain("<textarea");
    expect(htmlWithLine0Active).toContain("# Welcome to bleacher_labs");

    // Inactive lines render regular formatted elements, NOT raw markdown
    expect(htmlWithLine0Active).toContain("Note");
    expect(htmlWithLine0Active).toContain("Workspace initialized for");
    expect(htmlWithLine0Active).toContain("Ardon Bailey");
    expect(htmlWithLine0Active).toContain("Notes");
    expect(htmlWithLine0Active).toContain("Review sprint backlog");
    // Ensure raw markdown syntax for inactive lines is NOT rendered as raw text
    expect(htmlWithLine0Active).not.toContain("&gt; [!NOTE]");
    expect(htmlWithLine0Active).not.toContain("- [ ] Review sprint backlog");
  });

  it("should render regular heading tags (<h1-3>) when heading lines are inactive", () => {
    const docContent = `# Main Title
## Section Title
### Subsection Title`;

    // Line 2 (H3) is active; lines 0 (H1) and 1 (H2) are inactive
    const html = renderToString(
      React.createElement(LiveMarkdownEditor, {
        content: docContent,
        onChange: () => {},
        activeLineIndex: 2,
      })
    );

    // Inactive lines 0 and 1 render as <h1> and <h2>
    expect(html).toContain("<h1");
    expect(html).toContain("Main Title");
    expect(html).toContain("<h2");
    expect(html).toContain("Section Title");

    // Active line 2 renders as textarea with raw markdown ### Subsection Title
    expect(html).toContain("<textarea");
    expect(html).toContain("### Subsection Title");
  });

  it("should render all lines as regular formatted elements when no line is active (activeLineIndex is null)", () => {
    const docContent = `# Bleacher Labs Documentation
- [x] Initial release done
- [ ] Next milestone in progress`;

    const html = renderToString(
      React.createElement(LiveMarkdownEditor, {
        content: docContent,
        onChange: () => {},
        activeLineIndex: null,
      })
    );

    // No textareas exist when activeLineIndex is null
    expect(html).not.toContain("<textarea");
    expect(html).toContain("<h1");
    expect(html).toContain("Bleacher Labs Documentation");
    expect(html).toContain("Initial release done");
    expect(html).toContain("Next milestone in progress");
    expect(html).toContain("line-through");
  });

  it("should render embedded database component for ```database code blocks", () => {
    const docWithDatabase = `# Sprint Planning
Here are the deliverables for this sprint:

\`\`\`database
{
  "id": "db_sprint_deliverables",
  "name": "Sprint 15 Deliverables"
}
\`\`\`

Additional notes follow.`;

    const html = renderToString(
      React.createElement(MarkdownRenderer, {
        content: docWithDatabase,
        workspaceId: "default",
      })
    );

    // MarkdownRenderer should recognize database block and render embedded database structure
    expect(html).toContain("Sprint 15 Deliverables");
    expect(html).not.toContain("```database");
  });

  it("renders database blocks as interactive tables in the live editor", () => {
    const docWithDatabase = `# Project Board

\`\`\`database
{
  "id": "db_project_board",
  "name": "Q4 Feature Tracker"
}
\`\`\`

Done.`;

    const html = renderToString(
      React.createElement(LiveMarkdownEditor, {
        content: docWithDatabase,
        onChange: () => {},
        activeLineIndex: 0,
        workspaceId: "default",
      })
    );

    expect(html).toContain("Q4 Feature Tracker");
    expect(html).not.toContain("```database");
    expect(html).toContain("embedded-table-container");
  });
});
