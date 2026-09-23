# Workspace UX review

This assessment covers the current code and a read-only UX design review. It records shipped interactions and limits, not a claim of complete Notion parity or an accessibility certification.

## Design decisions

- The sidebar names destinations rather than mixing in a file action. Upload lives in Files. The footer links directly to the repository's GitHub issue form. Mobile users open the same navigation through Workspace.
- Destructive page, folder, and file actions say “Move to Trash” and provide restore. Database and record deletion remain permanent and require confirmation.
- Search opens a native modal with focusable results and Escape/focus return. File results open the selected preview; page results open the selected page; task results open the matching task in the loaded board.
- The header no longer claims everything is synced. The editor shows loading, saving, saved, and failed states. Failed workspace refreshes keep existing content and offer Retry. Switching workspaces clears content from the previous workspace while the next one loads. Deleting the last page shows an empty state with New page instead of reopening the deleted page.
- Both themes use the same spacing, typography, focus treatment, and action hierarchy. Databases use a flexible panel and horizontally scrollable table at narrow widths.

## Workflow coverage

| Area | Create / read / update / delete or restore | Current limit |
| --- | --- | --- |
| Pages | Create from Docs, Templates, or Markdown/text Import; read and edit in the collaborative editor; move to Trash and restore | Saving is debounced. Failed saves retain the draft while the page stays open and offer Retry; an unsaved draft is not durable across a crash or navigation. |
| Files and folders | Upload and preview from Files; create folders; rename/move; move to Trash and restore | No file version replacement, permanent purge, or automatic Trash expiry. |
| Tasks and boards | Create, inspect, update, move, and delete tasks; create and manage boards | Search covers loaded tasks; board operations across separate objects are not a multi-object transaction. |
| Databases | Create, rename/configure, read/search/filter/sort, add/edit/delete records, delete databases; embed on pages | Table is the editing surface; Cards is a summary. Database/record deletion is permanent, and an embedded database is linked rather than copied. |
| Photos / snaps | Upload, inspect, and attach visual files; move file nodes to Trash | Metadata editing and albums do not have full CRUD. |
| Templates | Create an editable page from Meeting notes, Project brief, or Weekly plan | These built-in templates cannot be edited or deleted in the UI. |
| Import | Import multiple `.md`, `.markdown`, or `.txt` files as new pages | 1 MB per file; partial success is possible; binaries belong in Files. |
| Trash | List and restore deleted page/file/folder subtrees | No permanent-delete or expiration controls. Restoring a formerly public page re-enables its old public link unless sharing is revoked. |
| Account and team | Workspace switching, profile settings, invites and roster controls | Cloudflare Access provider choices are configured by the deployer; production sign-in needs a protected domain and valid Access secrets. |

## Further design work

The next useful pass is a hands-on keyboard and screen-reader audit of all dialogs, the mobile drawer, database editor, and complex drag-and-drop surfaces. A durable offline draft would make failed document saves safer. Multi-object operations in R2 can partially succeed even where each individual write uses an ETag; their recovery flows deserve dedicated work before claiming transactional behavior.

## Verification

The production build and TypeScript check passed. All 178 Worker and component tests passed against a local development Worker with isolated R2 state, including a folder-and-page Trash restore round trip. All seven mocked-API Cypress journeys passed, including embedded databases, Templates/Trash, and mobile navigation/search. A browser inspection of the local Databases view in the light theme confirmed visible editing controls and the sidebar's Report a bug link. The browser suite verifies UI journeys; the Worker suite verifies local persistence. Neither substitutes for a production Access login test with both configured identity providers.
