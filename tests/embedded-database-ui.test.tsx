import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Sidebar } from "../src/components/Sidebar.tsx";
import { EmbeddedDatabase } from "../src/components/EmbeddedDatabase.tsx";
import { MarkdownRenderer } from "../src/components/MarkdownRenderer.tsx";
import { UserProfile, TreeNode, UserWorkspaceReference } from "../src/types.ts";

const mockUser: UserProfile = {
  id: "user-1",
  name: "Marcus Vance",
  email: "marcus@clocean.co",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
};

const mockWorkspace: UserWorkspaceReference = {
  id: "ws-acme",
  name: "Clocean Workspace",
  icon: "layers",
  role: "owner",
};

const mockTree: TreeNode[] = [
  { id: "doc-1", name: "Quick Notes", type: "doc", parentId: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "doc-2", name: "Tasks & Roadmap", type: "doc", parentId: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "doc-3", name: "Deadlines & Milestones", type: "doc", parentId: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "doc-4", name: "Music Playlists", type: "doc", parentId: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "doc-5", name: "Engineering Spec", type: "doc", parentId: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
];

describe("Workspace UX & Sidebar Tests", () => {
  it("renders the top workspace switcher with workspace name and role", () => {
    const html = renderToString(
      React.createElement(Sidebar, {
        currentView: "home",
        onSelectView: () => {},
        currentUser: mockUser,
        theme: "dark",
        onToggleTheme: () => {},
        currentWorkspace: mockWorkspace,
        tree: mockTree,
      })
    );

    expect(html).toContain("Clocean Workspace");
    expect(html).toContain("owner");
  });

  it("renders the 'Workspace' section with document items, emoji icons, and '+' create button", () => {
    const html = renderToString(
      React.createElement(Sidebar, {
        currentView: "notes",
        activeDocId: "doc-1",
        onSelectView: () => {},
        currentUser: mockUser,
        theme: "dark",
        onToggleTheme: () => {},
        currentWorkspace: mockWorkspace,
        tree: mockTree,
      })
    );

    expect(html).toContain("Workspace");
    expect(html).toContain("Quick Notes");
    expect(html).toContain("Tasks &amp; Roadmap");
    expect(html).toContain("Engineering Spec");
    expect(html).toContain("aria-label=\"Create page\"");
  });

  it("renders secondary Quick Actions (Templates, Import, Trash)", () => {
    const html = renderToString(
      React.createElement(Sidebar, {
        currentView: "home",
        onSelectView: () => {},
        currentUser: mockUser,
        theme: "dark",
        onToggleTheme: () => {},
        currentWorkspace: mockWorkspace,
        tree: mockTree,
      })
    );

    expect(html).toContain("Quick actions");
    expect(html).toContain("Templates");
    expect(html).toContain("Import");
    expect(html).toContain("Trash");
  });

  it("keeps file upload in Files and links to bug reporting", () => {
    const html = renderToString(
      React.createElement(Sidebar, {
        currentView: "home",
        onSelectView: () => {},
        currentUser: mockUser,
        theme: "dark",
        onToggleTheme: () => {},
        currentWorkspace: mockWorkspace,
        tree: mockTree,
      })
    );

    expect(html).not.toContain('aria-label="Upload file"');
    expect(html).toContain('href="https://github.com/waystilos/clocean/issues/new/choose"');
  });

  it("renders bottom user profile section with user avatar and name", () => {
    const html = renderToString(
      React.createElement(Sidebar, {
        currentView: "home",
        onSelectView: () => {},
        currentUser: mockUser,
        theme: "dark",
        onToggleTheme: () => {},
        currentWorkspace: mockWorkspace,
        tree: mockTree,
      })
    );

    expect(html).toContain("Marcus Vance");
    expect(html).toContain("marcus@clocean.co");
  });
});

/* Embedded Database Component Tests temporarily commented out
describe("Embedded Database Component Tests", () => {
  const initialSchema = {
    id: "db-test-custom",
    workspaceId: "ws-acme",
    name: "Growth Sprints",
    properties: [
      { id: "priority", name: "Priority", type: "select" as const, options: ["1", "2", "3", "4", "5"] },
      { id: "name", name: "Name", type: "text" as const },
      { id: "text", name: "Text", type: "text" as const },
      {
        id: "multi_select",
        name: "Multi select",
        type: "multi_select" as const,
        options: ["Share with others", "Retention", "10+ pageviews", "Upgrade", "Spends more time"],
      },
    ],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };

  const initialRecords = [
    {
      id: "rec-1",
      databaseId: "db-test-custom",
      title: "Feature name",
      properties: {
        priority: "1",
        text: "Short",
        multi_select: "Retention",
      },
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
    {
      id: "rec-2",
      databaseId: "db-test-custom",
      title: "Your cool text",
      properties: {
        priority: "5",
        text: "Longer description",
        multi_select: "Share with others",
      },
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
  ];

  it("renders database table top bar with tabs, Vertical dropdown, Filter, Sort, Search, and New button", () => {
    const html = renderToString(
      React.createElement(EmbeddedDatabase, {
        databaseId: "db-test-custom",
        initialName: "Growth Sprints",
        initialSchema,
        initialRecords,
        workspaceId: "ws-acme",
        getAuthHeaders: () => ({}),
      })
    );

    expect(html).toContain("Growth Sprints");
    expect(html).toContain("Vertical");
    expect(html).toContain("Filter");
    expect(html).toContain("Sort");
    expect(html).toContain("New");
  });

  it("renders table columns with property badges and multi-select tags", () => {
    const html = renderToString(
      React.createElement(EmbeddedDatabase, {
        databaseId: "db-test-custom",
        initialName: "Growth Sprints",
        initialSchema,
        initialRecords,
        workspaceId: "ws-acme",
        getAuthHeaders: () => ({}),
      })
    );

    expect(html).toContain("Priority");
    expect(html).toContain("Multi select");
    expect(html).toContain("Feature name");
    expect(html).toContain("Short");
    expect(html).toContain("Your cool text");
    expect(html).toContain("Share with others");
    expect(html).toContain("Retention");
  });
});
*/

describe("Document Canvas & Checklist Tests", () => {
  it("renders circular task items with circular checkbox circles and strike-through", () => {
    const content = `# Quick Notes
#morning #ideas #todos

- [x] Setting up research meeting
- [ ] Make the logo bigger
- [ ] Check to-do's
- [x] Get feedback on website design
`;

    const html = renderToString(
      React.createElement(MarkdownRenderer, { content })
    );

    expect(html).toContain("circular-task-item");
    expect(html).toContain("circular-checkbox-circle");
    expect(html).toContain("Setting up research meeting");
    expect(html).toContain("Make the logo bigger");
    expect(html).toContain("Check to-do&#x27;s");
    expect(html).toContain("Get feedback on website design");
    expect(html).toContain("line-through");
  });
});
