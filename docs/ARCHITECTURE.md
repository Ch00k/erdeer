# ERDeer architecture

The module-by-module map, the tech decisions and the reasoning behind them. `CLAUDE.md` carries only the rules a
change must not break and points here for the why. Moved out of `CLAUDE.md` on 2026-10-08.

## Architecture

- **Monorepo** with pnpm workspaces
- `packages/frontend` - React + TypeScript + Vite + CSS Modules
- `packages/backend` - Node.js + TypeScript + Fastify + Drizzle ORM + SQLite
- `packages/shared` - Code shared by frontend, backend, and CLI: the `Schema` types, `validateAml` (the single source of AML validation, used by both the MCP `validate_aml` tool and the CLI), `parseAml` (adapter from @azimutt/aml parser output to our `Schema` types, including default grid positions), the diagram layout format (`DiagramLayout`, `parseLayout`/`serializeLayout`, `relationKey`), and the HTML-export payload/injection (`ExportData`, `renderExportHtml`, `exportFilename`). The package exposes subpath exports (`/layout`, `/export`, `/export-html`) besides the barrel: the frontend's export viewer entry may only import from `/layout` and `/export`, which keeps both the AML parser (~630 kB) and the payload placeholder literal (in `/export-html`) out of the viewer bundle
- `packages/cli` - `erdeer` command-line tool (local AML validation, diagram upload/export against a server), shipped as a Bun-compiled binary via GitHub Releases

### Frontend structure

- `App.tsx` - router setup with auth-protected routes
- `auth.tsx` - AuthContext provider, fetches current user on load
- `theme.tsx` - ThemeProvider/useTheme. Stores `light`/`dark`/`system` in `localStorage["erdeer_theme"]`, applies `data-theme` attribute to `<html>`, follows OS prefers-color-scheme when in `system` mode. An inline script in `index.html` applies the saved value before first paint to avoid FOUC.
- `api.ts` - API client functions (auth, diagrams CRUD, teams, invitations, tokens)
- `pages/LoginPage.tsx` - OAuth login buttons (GitHub, Google, GitLab) plus a "Try without an account" link to the sandbox
- `pages/DashboardPage.tsx` - diagram list with personal/team tabs, create/delete. The active tab is stored in the URL (`?tab=team`, personal is the bare `/`) so it survives refresh and can be linked to
- `pages/DesignerPage.tsx` - AML editor + diagram canvas (via `Workspace`), auto-saves to API. Renders read-only when the viewer can't write (anon viewer, or non-member). Owners get a Public/Private visibility toggle. Logged-in viewers get a navbar "Diagrams" back link pointing at the dashboard tab (personal/team) the diagram belongs to.
- `pages/SandboxPage.tsx` - public, anonymous-only editor (via `Workspace`) backed by `localStorage`. Single sandbox doc with title field and Reset button. Logged-in users get redirected to `/`.
- `pages/TeamsPage.tsx` - team management: create teams, invite/remove members, accept/decline invitations, team roles (owner/member)
- `pages/TokensPage.tsx` - API token management (list, create, revoke)
- `pages/SchemaPage.tsx` - editable (session-only) view of the app's own database schema, rendered via `Workspace`
- `sandbox.ts` - `localStorage` helpers + seed for the anonymous sandbox
- `nodes.ts` - `schemaToNodes(schema, layout)` builds the React Flow table nodes; shared by the Designer, Sandbox, and Schema pages and the export viewer
- `export/` - static HTML export (payload shape `ExportData` and injection helpers live in `@erdeer/shared`). `main.tsx` + `Viewer.tsx` are a second Vite entry that renders the JSON embedded in the payload script tag as a title bar (with an ERDeer brand link to `appUrl`), a collapsible/resizable read-only AML pane (`AmlCode.tsx`), and a read-only `Diagram` (no Monaco); `AmlCode.tsx` highlights the AML with a tiny sticky-regex tokenizer whose rules are copied from @azimutt/aml's Monarch grammar (importing the grammar would pull the whole parser, ~630 kB, into the bundle - keep the rules in sync with `src/extensions/monaco.ts` upstream); `download.ts` fetches the prebuilt `/export-viewer.html` template, injects the diagram's JSON via `renderExportHtml`, and triggers the file download; `elkStub.ts` replaces elkjs in the viewer build (auto-layout is unreachable read-only, and ELK is ~1.4 MB). `download.ts` (and `@erdeer/shared/export-html`, which carries the placeholder literal) must stay out of the viewer entry's import graph: a copy of the placeholder inside the template's inlined JS could be hit by the injection instead of the payload tag (which is why `Workspace`, not `DiagramControls`, owns the export handler)
- `vite.export.config.ts` - builds the export viewer entry (`export-viewer.html`) into a single self-contained file via `vite-plugin-singlefile`, output to `public/` (gitignored) so the dev server serves it and the main build copies it into `dist/`. Runs before `vite`/`vite build` in the package's `dev`/`build` scripts (`build:export`)
- `components/Navbar.tsx` - shared navbar with theme toggle (sun/moon), an optional `back` link (`{ to, label }`, rendered next to the logo), and user dropdown menu (Diagrams, Teams, API Tokens, Sign out, Delete account). The dropdown highlights the entry matching the current route
- `components/Footer.tsx` - shared footer with copyright and Schema link
- `components/ConfirmDialog.tsx` - modal confirmation dialog (replaces native confirm())
- `components/Workspace.tsx` - shared editor+diagram layout used by the Designer, Sandbox, and Schema pages. Owns the editor-pane width (resizable), the collapse/expand state (fully hides the editor pane and resize handle, surfacing a top-left expand button over the diagram), and the AML reference toggle. Takes `aml`/`onAmlChange`/`schema`/`nodes`/`onNodesChange`/`readOnly`/`exportTitle`. Owns the HTML-export handler (built from `exportTitle` + schema/nodes/edgeLayout, passed down as `onExport`).
- `components/AmlReference.tsx` - toggleable AML language reference panel; code blocks are syntax-highlighted via `monaco.editor.colorize` using the same theme as the editor.
- `components/ResizeHandle.tsx` - draggable divider for resizing editor pane
- `components/Editor.tsx` - Monaco-based AML editor with word wrap toggle, theme picker, an AML reference toggle (`onToggleReference`), and a collapse button (`onCollapse`). Reads theme state from `useMonaco()`.
- `components/monacoContext.tsx` - `MonacoProvider`/`useMonaco`. Initializes Monaco via `loader.init()`, registers the AML language once, owns the theme picker selection (persisted to `localStorage["erdeer_monaco_theme"]`), and lazy-applies the resolved theme via `monaco.editor.setTheme`. "Auto" resolves to IDLE in light mode and GitHub Dark in dark mode.
- `components/monacoThemes.ts` - Lists community themes from `monaco-themes/themes/themelist.json`, lazy-loads each theme JSON via dynamic `import()` and registers it with `monaco.editor.defineTheme`. Caches each theme's editor.background/foreground in a map exposed via `getThemeColors(id)` so the AML reference panel can match its code-block backgrounds to the active theme.
- `components/DiagramControls.tsx` - the React Flow `<Controls>` bar (zoom in/out and fit-to-view as `ControlButton`s with inlined lucide icons), plus an export-as-HTML `ControlButton` (lucide download icon, shown when an `onExport` callback is provided - all pages pass one; the export viewer doesn't) and, when editable, an auto-layout `ControlButton` (lucide workflow icon). Auto-layout opens a `ConfirmDialog` (warning it can't be undone); on confirm it builds ELK ports from each relation's real handle offsets (via `getInternalNode().internals.handleBounds`), runs `computeAutoLayout`, applies node positions through `onNodesChange` as `dragging: false` position changes and the routed edges through `onEdgeLayoutReplace` (both persist via each page's existing save path), and fits the view.
- `components/Diagram.tsx` - React Flow canvas, computes edges from schema relations. Edge ids are `relationKey(rel)`. Clicking a relation highlights it (tracked in local `selectedEdgeId` state, fed to the edge via `data.highlighted` and an elevated `zIndex`); clicking the pane or the edge again clears it. A no-op `onNodeMouseEnter` is always passed: React Flow otherwise sets `pointer-events: none` on nodes that are neither selectable nor draggable, which would kill hover tooltips in read-only views (public diagrams, the export viewer). `minZoom={0.1}` allows zooming far out; the bottom-left control bar (rendered by `DiagramControls`) provides zoom in/out, fit-to-view, and auto-layout. Each edge's `srcSide`/`refSide` (which left/right column handle the line attaches to) defaults to the facing side based on relative table positions, but is overridden by `edgeLayout[relationKey]`. A relation's stored `route` (auto-layout bend points + handle anchors) is passed to the edge as `data.route`; `RelationEdge` validates the anchors against the live handle positions and falls back to smooth-step when they no longer match.
- `components/RelationEdge.tsx` - custom edge with crow's-foot cardinality markers, derived from the relation's cardinality and the handle side each end attaches to. Draws an orthogonal rounded path through `data.route` when its stored handle anchors still match the live source/target handle positions (within a small tolerance), otherwise a smooth-step path. The anchor check invalidates a route when a table is moved, resized, or has columns added/reordered (any of which shifts a handle). Highlighted relations render in the primary color. When a relation is highlighted (and the viewer can edit), a small flip handle is drawn just beyond each endpoint; clicking one flips that end to the other side of its table via `data.onFlip(relationKey, { srcSide | refSide })`.
- `components/TableNode.tsx` - custom React Flow node for database tables. Hovering a column shows a `ColumnTooltip`; hovering the header (when the table has a comment) shows that comment in the same styled popup. Both share the delayed-hover machinery and side-aware positioning.
- `components/Tooltip.tsx` - shared hover-tooltip shell: absolute positioning, left/right arrow, box styling. Wraps `ColumnTooltip`'s content grid and the table header's comment.
- `components/ColumnTooltip.tsx` - column detail popup (type, constraints, indexes, default, check, enum values, comment) rendered inside `Tooltip`
- `aml.ts` - re-exports `parseAml` from `@erdeer/shared`
- `autoLayout.ts` - `computeAutoLayout({ nodes, edges })` runs ELK's layered algorithm (left-to-right, orthogonal edge routing, `elkjs`). Nodes carry FIXED_POS ports (source on EAST, target on WEST, at the column's handle offset) so routing lines up with the rendered handles. Returns `{ positions, routes }` where `routes` maps each relation key to its orthogonal bend points plus the start/end handle anchors. Self-referential relations are dropped from the graph.
- `layout.ts` - re-exports the diagram layout format and helpers from `@erdeer/shared/layout`. `DiagramLayout` is `{ nodes, edges }`: `nodes` maps table name to position, `edges` maps `relationKey(rel)` to an `EdgeCustomization` (`srcSide`/`refSide`). An `EdgeCustomization` may also carry a `route` (orthogonal bend points plus the source/target handle anchors they were computed for) produced by auto-layout. `parseLayout` reads that shape and falls back to treating a bare map as the old node-only format; `serializeLayout` writes it. The backend stores this as the opaque `layout` JSON string.
- `types.ts` - re-exports the `Schema` types from `@erdeer/shared`

### Frontend routes

- `/login` - login page (public, redirects to `/` if authenticated)
- `/` - dashboard (protected)
- `/teams` - team management (protected)
- `/tokens` - API token management (protected)
- `/schema` - editable app database schema diagram (public, session-only, not persisted)
- `/sandbox` - anonymous sandbox editor (public, `localStorage`-backed; redirects to `/` for logged-in users)
- `/diagrams/:id` - designer (public route; backend gates by `visibility` and team membership)

### Backend structure

- `src/db/schema.ts` - Drizzle ORM table definitions (users, oauth_accounts, sessions, teams, team_members, team_invitations, diagrams, api_tokens)
- `src/db/connection.ts` - SQLite connection via better-sqlite3 with WAL mode
- `src/auth/providers.ts` - Arctic OAuth provider setup (GitHub, Google, GitLab), plus `devLoginEnabled()` (the dev login is on outside production when `DEV_CLIENT_ID`/`DEV_CLIENT_SECRET` are both set)
- `src/auth/session.ts` - Session creation, validation (with auto-extend), deletion
- `src/auth/routes.ts` - OAuth login/callback routes, logout (POST), /auth/me, /auth/providers endpoints. When `devLoginEnabled()`, also registers `GET /auth/dev/login`, which mints a session for a fixed `dev@localhost` user (provider `dev`) with no external OAuth; `/auth/providers` reports it as `dev: true`
- `src/auth/middleware.ts` - auth hooks: `requireAuth` (session cookie only), `optionalAuth` (attaches userId from a session cookie or an API bearer token; an invalid bearer token is rejected with 401, no/invalid session passes through), and `requireAnyAuth` (session or token, 401 otherwise). Diagram CRUD uses `requireAnyAuth` so the CLI and agents can write with a token; token management, teams, and account deletion stay on `requireAuth` so a leaked token cannot mint further credentials or manage membership
- `src/auth/token.ts` - API token creation, hashing, and bearer token auth middleware
- `src/diagrams/routes.ts` - Diagram CRUD API (personal/team list, get, create, update, delete), authenticated by session or API bearer token (`requireAnyAuth`). `GET /api/diagrams/:id` and the per-diagram SSE endpoint use `optionalAuth`: anonymous reads succeed when `visibility = 'public'`. The GET response includes a `canEdit` flag derived from session + ownership/team membership. `PUT` accepts a `visibility` field but only the owner can change it. `GET /api/diagrams/:id/export` downloads the diagram as a self-contained HTML file (read access: session, API bearer token, or anonymous when public; an invalid bearer token is rejected even for public diagrams).
- `src/diagrams/access.ts` - `userCanEdit` (owner or team member) and `userCanRead` (public or can edit), shared by the REST routes and MCP tools
- `src/diagrams/export.ts` - `buildExportHtml(diagram, appUrl)`: reads the viewer template (frontend `public/` first - the fresher copy in dev - falling back to `dist/`), parses the stored AML and layout, and injects them via the shared `renderExportHtml`
- `src/teams/routes.ts` - Team CRUD API (list, create, members, invitations, account deletion). Invitations are addressed by typed email; there is no user-search/enumeration endpoint.
- `src/tokens/routes.ts` - API token management (list, create, revoke) - session-auth protected
- `src/events.ts` - In-memory event bus for diagram update notifications (used by SSE endpoint)
- `src/mcp/server.ts` - MCP server with Streamable HTTP transport, diagram CRUD tools, AML spec resource
- `drizzle.config.ts` - Drizzle Kit config for migrations
- `drizzle/` - Generated SQL migration files
- `data/` - SQLite database files (gitignored)

## Tech decisions

- **AML** as the schema language (over DBML) - more expressive, inline relations, nested columns
- **React Flow** (@xyflow/react) for diagram rendering - handles nodes, edges, pan/zoom, drag
- **ELK** (`elkjs`, layered algorithm with orthogonal edge routing) for on-demand auto-layout - positions tables and routes connectors into separated channels to avoid overlap. Auto-layout replaces the whole edge layout (sides forced source-EAST/target-WEST, plus bend-point routes). Dragging a table or flipping a connector invalidates only that edge's route, which reverts to smooth-step until the next auto-layout
- **CSS Modules** for styling (not Tailwind - app is IDE-like, not content/responsive)
- **Theming via CSS variables** - palette tokens defined on `:root` (light) and overridden under `[data-theme="dark"]`. A `prefers-color-scheme: dark` media query inside `:root:not([data-theme])` provides the system fallback when the user has no explicit preference. Monaco's theme is driven by the editor picker - "Auto" resolves to IDLE / GitHub Dark, otherwise the user's chosen community theme is used. React Flow gets `colorMode={resolvedTheme}`.
- **Monaco themes** - the `monaco-themes` package ships theme JSON files but does not expose them via its `exports` map, so `vite.config.ts` aliases `monaco-themes-data` to `node_modules/monaco-themes/themes`. Each community theme is dynamically imported and lazy-registered the first time it's selected.
- **@azimutt/aml** npm package for parsing
- **Drizzle ORM** + **better-sqlite3** for database (lightweight, SQL-like, good TypeScript inference)
- **SQLite** for storage (WAL mode, foreign keys enabled)
- **Arctic** for OAuth (GitHub, Google, GitLab) - lightweight, TypeScript-first OAuth 2.0 clients
- **Server-side sessions** stored in SQLite with HTTP-only cookies (30-day expiry, auto-extend at halfway). The cookie's `Secure` flag is set when `NODE_ENV === "production"`, which the Docker image sets
- **Rate limiting** via `@fastify/rate-limit` (global 300 requests/minute per client IP). The limiter keys on `Fly-Client-IP` (set and overwritten by Fly's proxy, so not client-spoofable), falling back to `req.ip`. `trustProxy` trusts only loopback/private hops, so `req.ip` comes from a proxy-appended `X-Forwarded-For` entry rather than a client-supplied one
- **OAuth state** stored in-memory Map (not cookies) to avoid Vite proxy cookie issues in dev
- **Auto-migration** on startup via drizzle-orm migrator
- **Bundled backend**: `build.mjs` bundles the server and its dependencies with esbuild into one ESM file, `dist/server.js`, run by plain Node. `@azimutt/aml` is not valid Node ESM (extensionless imports, a JSON import without an attribute), so it runs only bundled or through a loader; a runtime loader (`tsx`) cost ~24 MB of RSS. `better-sqlite3` stays external for its native addon. `src/paths.ts` resolves files relative to the package root, since a module's own location differs between source and bundle
- **Static file serving** via @fastify/static in production (backend serves frontend dist)
- **React Router** v7 for client-side routing (login, dashboard, designer pages)
- **@modelcontextprotocol/sdk** for MCP server (Streamable HTTP transport, bearer token auth)
- **API tokens** stored as SHA-256 hashes in SQLite, prefixed with `erd_`, for MCP and API auth
- **Biome** for linting and formatting (configured at root `biome.json`)
- **husky** + **lint-staged** for pre-commit hooks (runs biome on staged files)
- **Vite proxy** forwards `/auth` and `/api` requests to backend in dev
- **SSE for live updates** - Two SSE endpoints: `GET /api/diagrams/:id/events` (diagram content changes) and `GET /api/diagrams/events` (diagram list changes). Backend emits from both REST API and MCP write paths. List events notify all affected team members. Frontend `DesignerPage` and `DashboardPage` subscribe and re-fetch on external changes, filtering out own session via `sourceSessionId`.
- Interactive features disabled: no edge drawing, no element selection. Edges are clickable (via `onEdgeClick`) to highlight a single relation; React Flow's own selection stays off.
- **Connector side-change** - The side (left/right column handle) each relation end attaches to defaults to the facing side but can be overridden. Highlighting a relation reveals a flip handle just past each endpoint; clicking it flips that end. Overrides are stored per relation (`srcSide`/`refSide`) in the diagram `layout` `edges` map and persist alongside node positions (Designer -> API, Sandbox -> localStorage, Schema -> session only).
- **Team roles and invitations** - Team members have roles (owner/member). Only owners can invite, remove members, and manage invitations. Invitations are by email; invitees accept/decline on the Teams page. Account deletion auto-promotes the longest-standing member if the departing user is the sole owner, or deletes the team if they're the last member.
- **Diagram visibility** - Each diagram has a `visibility` column (`private` | `public`, default `private`, with a CHECK constraint). Public diagrams are readable by anyone who has the URL (no auth required); writes still require ownership or team membership; only the owner can flip visibility.
- **Static HTML export** - Every Workspace page has an export button that downloads the diagram as one self-contained HTML file: a prebuilt read-only viewer bundle (the app's own Diagram components, built as a second single-file Vite entry) with the diagram's AML + schema + layout JSON injected into a payload script tag at export time. The viewer shows a collapsible, resizable, syntax-highlighted read-only AML pane beside the diagram. Works offline from `file://`, follows the OS color scheme, and keeps pan/zoom/tooltips. ELK and the AML parser are kept out of the viewer bundle (~400 kB total). Two assembly paths share the payload/injection code from `@erdeer/shared`: client-side in the browser (all Workspace pages, including the server-less Sandbox and Schema pages) and server-side via `GET /api/diagrams/:id/export` (used by the `export_diagram` MCP tool and intended for the CLI).
- **Anonymous sandbox + auto-import** - `/sandbox` is a single-doc editor persisted to `localStorage` under `erdeer_sandbox`. On any successful auth bootstrap (`AuthProvider`), if the localStorage key is present it is POSTed as a new personal diagram and then cleared. No "Save to account" button - the import is silent. Logged-in users visiting `/sandbox` are redirected to `/`.
- IE (crow's foot) markers: TODO - removed for now, to be revisited
- VIEW badge on table header: TODO - parse view property from entity and show badge to distinguish views from tables

## MCP Server

Exposes diagram CRUD and AML validation via MCP (Model Context Protocol) at `POST /mcp`.

**Auth**: Bearer token via `Authorization: Bearer erd_...` header. Tokens are managed via REST API (`/api/tokens`) and scoped to the same permissions as the user.

**Tools**: list_teams, list_diagrams, get_diagram, create_diagram, update_diagram, delete_diagram, export_diagram, validate_aml

**export_diagram** returns the export URL and filename instead of the HTML itself - the ~400 kB file would flood the calling agent's context. Agents download it with the same bearer token.

**Resources**: `aml://spec` - AML language specification (docs/aml-spec.md)

**CLI preference**: The server `instructions` field and the `validate_aml`/`create_diagram`/`update_diagram`/`export_diagram` tool descriptions steer agents to prefer the local `erdeer` CLI when it is on PATH (`erdeer validate <file>`, `erdeer upload <file>`, `erdeer update <diagram-id> <file>`, `erdeer export <diagram-id>`), falling back to the tools when the CLI is unavailable or the content is not in a file. The CLI and the tools share the same shared-package logic and REST endpoints, so their results are identical.

**Transport**: Streamable HTTP in stateless mode. Every POST is authenticated by its bearer token and gets its own `McpServer` and transport, closed when the response closes; GET and DELETE return 405. The server pushes no notifications to clients, so sessions would buy nothing - and clients rarely send DELETE, so a stateful server kept every session (~320 kB of heap each) until the process restarted.

## CLI

`packages/cli` builds the `erdeer` command: local AML validation (so an agent can validate without an MCP round-trip) plus diagram upload, update, and export against a server.

- **Commands**:
  - `erdeer validate [file] [--json]`. Reads AML from the file argument, or from stdin if no file is given (or `-`), matching the string-content model of the MCP `validate_aml` tool. Exit codes: `0` valid, `1` invalid AML, `2` usage or I/O error. Default output is human-readable; `--json` emits the same shape as the MCP tool.
  - `erdeer upload <file> [--title <t>] [--team <id>] [--json]`. Validates locally (invalid AML aborts with exit 1), then `POST /api/diagrams` with the bearer token; prints the new diagram's URL.
  - `erdeer update <diagram-id> [file] [--title <t>] [--json]`. Reads AML from the file (or stdin if none), validates locally (invalid AML aborts with exit 1), then `PUT /api/diagrams/:id` with the bearer token; prints the diagram's URL. Overwrites `amlContent`; `--title` also renames it. Mirrors the `upload` flow for an existing diagram.
  - `erdeer export <diagram-id> [-o <file>]`. Downloads `GET /api/diagrams/:id/export` and saves it (default filename from the `Content-Disposition` header). Public diagrams need no token.
- **Server config**: `--server`/`ERDEER_SERVER` (default `https://erdeer.dev`) and `--token`/`ERDEER_TOKEN`. Exit codes across commands: `0` success, `1` operation rejected (invalid AML, HTTP error), `2` usage/I-O/network error.
- **Version**: `erdeer --version` prints the version baked in at compile time (see the Deployment section's version-stamping notes).
- **Shared logic**: imports `validateAml` from `@erdeer/shared` - no parsing logic of its own.
- **Distribution**: standalone binaries built with `bun build --compile` and attached to GitHub Releases by the `release` job in `.github/workflows/ci.yml`, triggered on `X.Y.Z` tag pushes. Bun cross-compiles all five targets (`linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `windows-x64.exe`) from a single runner. The package is `private` and not published to npm.
- **Why Bun, not Node**: `@azimutt/aml` imports its `package.json` without a `type: json` import attribute, which Node 23+ rejects (the backend sidesteps this by bundling with esbuild). Bun handles attribute-less JSON imports natively, so the compiled binary runs everywhere regardless of the host's Node version.

## Environment variables

- `BASE_URL` - Public URL for OAuth callbacks (e.g., `https://db.example.com`). Defaults to `http://localhost:7000` for dev.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - GitHub OAuth (optional)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth (optional)
- `GITLAB_CLIENT_ID` / `GITLAB_CLIENT_SECRET` - GitLab OAuth (optional)
- `DEV_CLIENT_ID` / `DEV_CLIENT_SECRET` - enable the local "Dev login" button when both are non-empty and `NODE_ENV` is not `production`. The values are only presence flags (there is no external dev IdP). Never set in production
- `DATABASE_PATH` - SQLite database path (default: `data/db.sqlite`)
- `PORT` - Server port (default: `3001`)
- `HOST` - Bind address (default: `127.0.0.1`)
- `NODE_ENV` - Set to `production` by the Docker image. Enables the session cookie's `Secure` flag.

At least one OAuth provider must be configured for login to work in production. In dev, the `DEV_CLIENT_ID`/`DEV_CLIENT_SECRET` dev login is an alternative to configuring an OAuth provider.

## Deployment

Deployed to **Fly.io** (`fly.toml`). The app runs as a **single machine** backed by **one persistent volume** (`erdeer_data`, mounted at `/app/packages/backend/data`) because SQLite is a local file - it must never be scaled beyond one machine. The container listens on internal port 3000; Fly terminates TLS and proxies to it. Secrets (`BASE_URL`, OAuth credentials, `ALLOWED_DOMAINS`) are set via `fly secrets set`. Migrations run automatically on startup. The `[deploy] strategy = "immediate"` setting stops and replaces the machine in place, since a volume can only attach to one machine at a time.

CI and deploys share the single workflow `.github/workflows/ci.yml`: every trigger runs `lint`; pushing an `X.Y.Z` tag additionally runs, in parallel after `lint`, `release` (CLI binaries to a GitHub Release) and `deploy` (builds the Docker image in the runner, pushes it to Fly's registry as `registry.fly.io/erdeer:<tag>`, runs `fly deploy --image`). Fly's own builder is not used. Production only ever deploys from a tag: `release` and `deploy` are gated on a tag ref, so pushes to `main`, PRs, and a `workflow_dispatch` from a branch are lint-only. Authentication uses a scoped deploy token stored as the `FLY_API_TOKEN` repository secret (created with `fly tokens create deploy -a erdeer`).

**Version stamping**: the app version comes from git, not package.json. The frontend footer shows `__ERDEER_VERSION__`, a Vite `define` resolved as `ERDEER_VERSION` env var > `git describe --tags --always` > `"dev"`; the deploy workflow passes the tag as the `ERDEER_VERSION` Docker build-arg since `.git` is dockerignored. The CLI's `--version` (and usage header) reports a compile-time `bun build --define` value: the tag in release builds, `git describe` output from the local `build:binary` script; running from source falls back to the `ERDEER_VERSION` env var, then `"dev"`.

The `Dockerfile` is also runnable standalone via `compose.yaml` (used for local container testing / Caddy-fronted hosting).
