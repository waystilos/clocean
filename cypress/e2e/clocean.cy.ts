/// <reference types="cypress" />

describe("Clocean - Workspace Navigation & Embedded Database Suite", () => {
  const mockUser = {
    email: "marcus@clocean.dev",
    name: "Marcus Aurelius",
    role: "owner",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
  };

  const mockWorkspace = {
    id: "default",
    name: "Clocean Main",
    icon: "layers",
    role: "owner",
  };

  const mockTree = {
    nodes: [
      { id: "doc-manifesto", name: "Project Manifesto", type: "doc", parentId: null },
      { id: "doc-arch", name: "Architecture & Edge", type: "doc", parentId: null },
      { id: "doc-design", name: "Design System", type: "doc", parentId: null },
      { id: "doc-roadmap", name: "Product Roadmap", type: "doc", parentId: null },
      { id: "file-spec", name: "Specification.pdf", type: "file", size: 102400, mimeType: "application/pdf" },
    ],
  };

  const mockDocManifesto = {
    id: "doc-manifesto",
    title: "Project Manifesto",
    tags: ["#morning", "#ideas", "#todos"],
    content: `# Project Manifesto\n\nWelcome to Clocean! High performance edge document workspace.\n\n- [ ] Review sprint burndown and outstanding PRs\n- [x] Configure Cloudflare R2 zero-database persistence\n- [ ] Implement document workspace styling\n\n\`\`\`database\n{"id": "db-sprint-tasks", "name": "Sprint Priorities"}\n\`\`\`\n`,
    icon: "file-text",
    attachments: [
      {
        id: "att-1",
        name: "Dashboard Redesign.png",
        url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
        size: 1048576,
        type: "image/png",
        createdAt: "2026-09-22T00:00:00.000Z",
      },
    ],
  };

  const mockDatabasesList = {
    databases: [
      {
        id: "db-sprint-tasks",
        workspaceId: "default",
        name: "Sprint Priorities",
        properties: [
          { id: "priority", name: "Priority", type: "select", options: ["1", "2", "3", "4", "5"] },
          { id: "name", name: "Name", type: "text" },
          { id: "text", name: "Text", type: "text" },
          {
            id: "multi_select",
            name: "Multi select",
            type: "multi_select",
            options: ["Share with others", "Retention", "10+ pageviews", "Upgrade", "Spends more time"],
          },
        ],
        createdAt: "2026-09-22T00:00:00.000Z",
        updatedAt: "2026-09-22T00:00:00.000Z",
      },
    ],
  };

  const mockDatabaseRecords = {
    records: [
      {
        id: "rec-1",
        databaseId: "db-sprint-tasks",
        title: "Design System Tokens",
        properties: {
          priority: "1",
          text: "Obsidian & Parchment themes",
          multi_select: "Retention",
        },
        createdAt: "2026-09-22T00:00:00.000Z",
        updatedAt: "2026-09-22T00:00:00.000Z",
      },
      {
        id: "rec-2",
        databaseId: "db-sprint-tasks",
        title: "Sub-millisecond Edge Latency",
        properties: {
          priority: "2",
          text: "Durable Objects WebSockets",
          multi_select: "10+ pageviews",
        },
        createdAt: "2026-09-22T00:00:00.000Z",
        updatedAt: "2026-09-22T00:00:00.000Z",
      },
    ],
  };

  beforeEach(() => {
    // Mock API requests with wildcards for robust query parameter handling
    cy.intercept("GET", "/api/me*", {
      statusCode: 200,
      body: {
        authenticated: true,
        user: mockUser,
        workspaces: [mockWorkspace],
      },
    }).as("getMe");

    cy.intercept("GET", "/api/workspaces*", {
      statusCode: 200,
      body: [mockWorkspace],
    }).as("getWorkspaces");

    cy.intercept("GET", "/api/tree*", {
      statusCode: 200,
      body: mockTree,
    }).as("getTree");

    cy.intercept("GET", "/api/tasks*", {
      statusCode: 200,
      body: [],
    });

    cy.intercept("GET", "/api/task-boards*", {
      statusCode: 200,
      body: [],
    });

    cy.intercept("GET", "/api/photos*", {
      statusCode: 200,
      body: [],
    });

    cy.intercept("GET", "/api/activity*", {
      statusCode: 200,
      body: [],
    });

    cy.intercept("GET", "/api/notifications*", {
      statusCode: 200,
      body: [],
    });

    cy.intercept("GET", "/api/workspaces/*/favorites*", {
      statusCode: 200,
      body: ["doc-manifesto"],
    });

    cy.intercept("GET", "/api/workspaces/*/members*", {
      statusCode: 200,
      body: [
        { email: mockUser.email, name: mockUser.name, role: mockUser.role, avatarUrl: mockUser.avatar },
      ],
    });

    cy.intercept("GET", "/api/docs/doc-manifesto*", {
      statusCode: 200,
      body: mockDocManifesto,
    }).as("getDoc");

    cy.intercept("GET", "/api/docs/*/revisions*", {
      statusCode: 200,
      body: { revisions: [] },
    });

    cy.intercept("GET", "/api/files/*", {
      statusCode: 200,
      body: "mock-file-content",
    });

    cy.intercept("PUT", "/api/docs/*", {
      statusCode: 200,
      body: { success: true },
    });

    cy.intercept("GET", "/api/docs/doc-manifesto/comments*", {
      statusCode: 200,
      body: [],
    });

    cy.intercept("GET", "/api/databases*", {
      statusCode: 200,
      body: mockDatabasesList,
    }).as("getDatabases");

    cy.intercept("GET", "/api/databases/db-sprint-tasks/records*", {
      statusCode: 200,
      body: mockDatabaseRecords,
    }).as("getDbRecords");

    cy.intercept("POST", "/api/databases/db-sprint-tasks/records*", (req) => {
      req.reply({
        statusCode: 201,
        body: {
          id: `rec-${Date.now()}`,
          databaseId: "db-sprint-tasks",
          title: "New Row Item",
          properties: { priority: "3", text: "", multi_select: "" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }).as("createDbRecord");

    // Seed session in localStorage and mock WebSocket to avoid connection failures
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.setItem("clocean_user", JSON.stringify(mockUser));
        win.localStorage.setItem("clocean_workspace", JSON.stringify(mockWorkspace));
        win.localStorage.setItem("clocean_workspaces", JSON.stringify([mockWorkspace]));
        win.localStorage.setItem("clocean_theme", "dark");

        // Mock WebSocket connection to prevent preview network errors
        class MockSocket {
          readyState = 1;
          onopen: ((ev: any) => void) | null = null;
          onclose: ((ev: any) => void) | null = null;
          onerror: ((ev: any) => void) | null = null;
          onmessage: ((ev: any) => void) | null = null;
          constructor(_url: string) {
            setTimeout(() => {
              if (this.onopen) this.onopen({ type: "open" });
            }, 50);
          }
          send() {}
          close() {
            if (this.onclose) this.onclose({ type: "close" });
          }
        }
        win.WebSocket = MockSocket as any;
      },
    });
  });

  it("1. Renders workspace navigation with custom emojis, quick actions, and theme toggle", () => {
    // Check workspace title
    cy.get(".clocean-sidebar").should("be.visible");
    cy.contains(".clocean-sidebar", "Clocean Main").should("be.visible");

    // Workspace section header and document items with custom emojis
    cy.contains(".clocean-sidebar", "Workspace").should("be.visible");
    cy.contains(".clocean-sidebar", "Project Manifesto").should("be.visible");
    cy.contains(".clocean-sidebar", "Architecture & Edge").should("be.visible");
    cy.contains(".clocean-sidebar", "Design System").should("be.visible");
    cy.contains(".clocean-sidebar", "Product Roadmap").should("be.visible");

    // Inline + add page button
    cy.get('button[aria-label="Create page"]').should("exist");

    // Quick actions (Templates, Import, Trash)
    cy.contains(".clocean-sidebar", "Quick actions").should("be.visible");
    cy.contains(".clocean-sidebar", "Templates").should("be.visible");
    cy.contains(".clocean-sidebar", "Import").should("be.visible");
    cy.contains(".clocean-sidebar", "Trash").should("be.visible");

    cy.get('.clocean-sidebar button[aria-label="Upload file"]').should("not.exist");
    cy.get('.sidebar-report-link').should("have.attr", "href", "https://github.com/waystilos/clocean/issues/new/choose");
    cy.get('.sidebar-report-link').should("have.attr", "target", "_blank");

    // User profile section
    cy.contains(".clocean-sidebar", "Marcus Aurelius").should("be.visible");

    // Theme toggle interaction: switch between Dark (Obsidian) and Light (Parchment)
    cy.get("html").should("have.attr", "data-theme", "dark");
    cy.get('button[title*="Light (Parchment)"]').click();
    cy.get("html").should("have.attr", "data-theme", "light");
    cy.get('button[title*="Dark (Obsidian)"]').click();
    cy.get("html").should("have.attr", "data-theme", "dark");
  });

  it("2. Renders document canvas with amber tag pills, circular task checklists, and floating action bar", () => {
    // Navigate to document via sidebar
    cy.contains(".clocean-sidebar button", "Project Manifesto").click();
    cy.wait("@getDoc");

    // Document title input
    cy.get('input[placeholder="Untitled Document"]').should("have.value", "Project Manifesto");

    // Amber tag pills (#morning, #ideas, #todos)
    cy.get(".amber-tag-pill").should("have.length.at.least", 3);
    cy.contains(".amber-tag-pill", "#morning").should("be.visible");
    cy.contains(".amber-tag-pill", "#ideas").should("be.visible");
    cy.contains(".amber-tag-pill", "#todos").should("be.visible");

    // Circular task checklists
    cy.get(".circular-task-item").should("have.length.at.least", 2);

    // Toggle circular checklist item
    cy.get(".circular-checkbox-circle").first().click();

    // Floating action pills (Aa)
    cy.get(".floating-action-bar").should("be.visible");
    cy.get('.floating-action-pill[aria-label="Format text"]').should("be.visible");
  });

    it("3. Embedded Database supports Vertical/Horizontal views, badges, search, filter, and record creation", () => {
    // Navigate to document
    cy.contains(".clocean-sidebar button", "Project Manifesto").click();

    // Embedded table container
    cy.get(".embedded-table-container", { timeout: 10000 }).should("be.visible");

    // Table view tab
    cy.contains(".embedded-table-container", "Sprint Priorities").should("be.visible");

    // Priority and Multi-select badges
    cy.contains(".embedded-table-container span", "Retention").should("be.visible");
    cy.contains(".embedded-table-container span", "10+ pageviews").should("be.visible");

    // Orientation toggle (Vertical <-> Horizontal)
    cy.contains(".embedded-table-container button", "Vertical").click();
    cy.contains("Horizontal").should("be.visible").click();
    cy.contains(".embedded-table-container button", "Horizontal").should("be.visible");

    // Toggle back to Vertical
    cy.contains(".embedded-table-container button", "Horizontal").click();
    cy.contains("Vertical").should("be.visible").click();
    cy.contains(".embedded-table-container button", "Vertical").should("be.visible");

    // Filter popover
    cy.contains(".embedded-table-container button", "Filter").click();
    cy.contains(/Filter By Field/i).should("be.visible");
    cy.contains(/Filter By Field/i).parent().find("select").select("title");
    cy.get('input[placeholder="Search value..."]').type("Design");
    cy.contains("Design System Tokens").should("be.visible");
    cy.contains("Sub-millisecond Edge Latency").should("not.exist");
    cy.contains("button", "Clear Filter").click();

    // 'New v' record creation button
    cy.get('.embedded-table-container button[title="Create new record"]').click();
    cy.wait("@createDbRecord");
  });


  it("4. Collapsible right Snaps panel displays UI snapshot cards, attachments, and discussion tabs", () => {
    // Navigate to document
    cy.contains(".clocean-sidebar button", "Project Manifesto").click();
    cy.wait("@getDoc");

    // Open right snaps panel
    cy.get('button[aria-label="Show files and discussion"]').click();
    cy.get(".editor-right-panel").should("be.visible");

    // Snaps tab: Visual preview card
    cy.contains(".editor-right-panel", "UI Snapshot").should("be.visible");
    cy.contains(".editor-right-panel", "Design Mockup Preview").should("be.visible");
    cy.contains(".editor-right-panel", "Dashboard Redesign.png").should("be.visible");

    // Switch to Discussion tab
    cy.contains(".editor-right-panel button", "Discussion").click();
    cy.contains("Discussion").should("be.visible");

    // Collapse right panel
    cy.get('button[aria-label="Hide files and discussion"]').click();
    cy.get(".editor-right-panel").should("not.exist");
    cy.get('button[aria-label="Show files and discussion"]').should("be.visible");
  });

  it("5. Opens usable Templates and restores a deleted page from Trash", () => {
    cy.contains(".clocean-sidebar button", "Templates").click();
    cy.contains("h1", "Templates").should("be.visible");
    cy.contains(".template-card", "Meeting notes").find("button").should("be.enabled");

    cy.intercept("GET", "/api/trash*", { items: [{ id: "doc-arch", name: "Architecture & Edge", deletedAt: "2026-09-23T00:00:00.000Z", count: 1 }] }).as("getTrash");
    cy.intercept("POST", "/api/trash/doc-arch/restore*", { success: true }).as("restorePage");
    cy.contains(".clocean-sidebar button", "Trash").click();
    cy.wait("@getTrash");
    cy.contains(".trash-row", "Architecture & Edge").find("button").click();
    cy.wait("@restorePage");
    cy.contains("Restored “Architecture & Edge”.").should("be.visible");
  });

  it("6. Makes workspace navigation and search usable on a phone", () => {
    cy.viewport(390, 844);
    cy.get(".mobile-bottom-nav").contains("button", "Workspace").click();
    cy.contains(".clocean-sidebar button", "Databases").should("be.visible").click();
    cy.contains("h1", "Databases").should("be.visible");
    cy.get(".clocean-sidebar").should("not.be.visible");

    cy.get('button[title^="Search workspace"]').click();
    cy.get('dialog[aria-label="Search workspace"]').should("be.visible");
    cy.get('input[aria-label="Search workspace"]').type("Manifesto");
    cy.contains(".search-result", "Project Manifesto").should("be.visible").click();
    cy.get('dialog[aria-label="Search workspace"]').should("not.be.visible");
    cy.get('input[placeholder="Untitled Document"]').should("have.value", "Project Manifesto");
  });
});
