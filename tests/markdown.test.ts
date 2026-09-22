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

