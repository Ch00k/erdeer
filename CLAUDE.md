# ERDeer

Browser-based database schema designer using AML (Azimutt Markup Language).

## Project lifecycle

Version 0.1.0 - **beta**.

## Architecture

- **Monorepo** with pnpm workspaces
- `packages/frontend` - React + TypeScript + Vite + CSS Modules
- `packages/backend` - Node.js + TypeScript + Fastify + Drizzle ORM + SQLite
- `packages/shared` - Shared types

### Frontend structure

- `App.tsx` - router setup with auth-protected routes
- `auth.tsx` - AuthContext provider, fetches current user on load
- `theme.tsx` - ThemeProvider/useTheme. Stores `light`/`dark`/`system` in `localStorage["erdeer_theme"]`, applies `data-theme` attribute to `<html>`, follows OS prefers-color-scheme when in `system` mode. An inline script in `index.html` applies the saved value before first paint to avoid FOUC.
- `api.ts` - API client functions (auth, diagrams CRUD, teams, invitations, tokens)
- `pages/LoginPage.tsx` - OAuth login buttons (GitHub, Google, GitLab) plus a "Try without an account" link to the sandbox
- `pages/DashboardPage.tsx` - diagram list with personal/team tabs, create/delete
- `pages/DesignerPage.tsx` - AML editor + diagram canvas, auto-saves to API. Renders read-only when the viewer can't write (anon viewer, or non-member). Owners get a Public/Private visibility toggle.
- `pages/SandboxPage.tsx` - public, anonymous-only editor backed by `localStorage`. Single sandbox doc with title field and Reset button. Logged-in users get redirected to `/`.
- `pages/TeamsPage.tsx` - team management: create teams, invite/remove members, accept/decline invitations, team roles (owner/member)
- `pages/TokensPage.tsx` - API token management (list, create, revoke)
- `pages/SchemaPage.tsx` - read-only view of the app's own database schema
- `sandbox.ts` - `localStorage` helpers + seed for the anonymous sandbox
- `components/Navbar.tsx` - shared navbar with theme toggle (sun/moon) and user dropdown menu (Teams, API Tokens, Sign out, Delete account)
- `components/Footer.tsx` - shared footer with copyright and Schema link
- `components/ConfirmDialog.tsx` - modal confirmation dialog (replaces native confirm())
- `components/AmlReference.tsx` - toggleable AML language reference panel for the designer; code blocks are syntax-highlighted via `monaco.editor.colorize` using the same theme as the editor.
- `components/ResizeHandle.tsx` - draggable divider for resizing editor pane
- `components/Editor.tsx` - Monaco-based AML editor with word wrap toggle and theme picker. Reads theme state from `useMonaco()`.
- `components/monacoContext.tsx` - `MonacoProvider`/`useMonaco`. Initializes Monaco via `loader.init()`, registers the AML language once, owns the theme picker selection (persisted to `localStorage["erdeer_monaco_theme"]`), and lazy-applies the resolved theme via `monaco.editor.setTheme`. "Auto" resolves to IDLE in light mode and GitHub Dark in dark mode.
- `components/monacoThemes.ts` - Lists community themes from `monaco-themes/themes/themelist.json`, lazy-loads each theme JSON via dynamic `import()` and registers it with `monaco.editor.defineTheme`. Caches each theme's editor.background/foreground in a map exposed via `getThemeColors(id)` so the AML reference panel can match its code-block backgrounds to the active theme.
- `components/Diagram.tsx` - React Flow canvas, computes edges from schema relations
- `components/TableNode.tsx` - custom React Flow node for database tables
- `aml.ts` - adapter between @azimutt/aml parser output and our Schema types

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
- `src/auth/dev.ts` - Dev mode auto-login: seeds a dev user and stable session on startup
- `src/auth/providers.ts` - Arctic OAuth provider setup (GitHub, Google, GitLab)
- `src/auth/session.ts` - Session creation, validation (with auto-extend), deletion
- `src/auth/routes.ts` - OAuth login/callback routes, logout, /auth/me, /auth/providers endpoints
- `src/auth/middleware.ts` - `requireAuth` hook (rejects unauth) and `optionalAuth` hook (attaches userId if a session exists, otherwise passes through)
- `src/auth/token.ts` - API token creation, hashing, and bearer token auth middleware
- `src/diagrams/routes.ts` - Diagram CRUD API (personal/team list, get, create, update, delete). `GET /api/diagrams/:id` and the per-diagram SSE endpoint use `optionalAuth`: anonymous reads succeed when `visibility = 'public'`. The GET response includes a `canEdit` flag derived from session + ownership/team membership. `PUT` accepts a `visibility` field but only the owner can change it.
- `src/teams/routes.ts` - Team CRUD API (list, create, members, invitations, user search, account deletion)
- `src/tokens/routes.ts` - API token management (list, create, revoke) - session-auth protected
- `src/events.ts` - In-memory event bus for diagram update notifications (used by SSE endpoint)
- `src/mcp/server.ts` - MCP server with Streamable HTTP transport, diagram CRUD tools, AML spec resource
- `drizzle.config.ts` - Drizzle Kit config for migrations
- `drizzle/` - Generated SQL migration files
- `data/` - SQLite database files (gitignored)

## Tech decisions

- **AML** as the schema language (over DBML) - more expressive, inline relations, nested columns
- **React Flow** (@xyflow/react) for diagram rendering - handles nodes, edges, pan/zoom, drag
- **CSS Modules** for styling (not Tailwind - app is IDE-like, not content/responsive)
- **Theming via CSS variables** - palette tokens defined on `:root` (light) and overridden under `[data-theme="dark"]`. A `prefers-color-scheme: dark` media query inside `:root:not([data-theme])` provides the system fallback when the user has no explicit preference. Monaco's theme is driven by the editor picker — "Auto" resolves to IDLE / GitHub Dark, otherwise the user's chosen community theme is used. React Flow gets `colorMode={resolvedTheme}`.
- **Monaco themes** - the `monaco-themes` package ships theme JSON files but does not expose them via its `exports` map, so `vite.config.ts` aliases `monaco-themes-data` to `node_modules/monaco-themes/themes`. Each community theme is dynamically imported and lazy-registered the first time it's selected.
- **@azimutt/aml** npm package for parsing
- **Drizzle ORM** + **better-sqlite3** for database (lightweight, SQL-like, good TypeScript inference)
- **SQLite** for storage (WAL mode, foreign keys enabled)
- **Arctic** for OAuth (GitHub, Google, GitLab) - lightweight, TypeScript-first OAuth 2.0 clients
- **Server-side sessions** stored in SQLite with HTTP-only cookies (30-day expiry, auto-extend at halfway)
- **OAuth state** stored in-memory Map (not cookies) to avoid Vite proxy cookie issues in dev
- **Auto-migration** on startup via drizzle-orm migrator
- **Static file serving** via @fastify/static in production (backend serves frontend dist)
- **React Router** v7 for client-side routing (login, dashboard, designer pages)
- **@modelcontextprotocol/sdk** for MCP server (Streamable HTTP transport, bearer token auth)
- **API tokens** stored as SHA-256 hashes in SQLite, prefixed with `erd_`, for MCP and API auth
- **Biome** for linting and formatting (configured at root `biome.json`)
- **husky** + **lint-staged** for pre-commit hooks (runs biome on staged files)
- **Vite proxy** forwards `/auth` and `/api` requests to backend in dev
- **SSE for live updates** - Two SSE endpoints: `GET /api/diagrams/:id/events` (diagram content changes) and `GET /api/diagrams/events` (diagram list changes). Backend emits from both REST API and MCP write paths. List events notify all affected team members. Frontend `DesignerPage` and `DashboardPage` subscribe and re-fetch on external changes, filtering out own session via `sourceSessionId`.
- Interactive features disabled: no edge drawing, no edge selection, no element selection
- **Team roles and invitations** - Team members have roles (owner/member). Only owners can invite, remove members, and manage invitations. Invitations are by email; invitees accept/decline on the Teams page. Account deletion auto-promotes the longest-standing member if the departing user is the sole owner, or deletes the team if they're the last member.
- **Diagram visibility** - Each diagram has a `visibility` column (`private` | `public`, default `private`, with a CHECK constraint). Public diagrams are readable by anyone who has the URL (no auth required); writes still require ownership or team membership; only the owner can flip visibility.
- **Anonymous sandbox + auto-import** - `/sandbox` is a single-doc editor persisted to `localStorage` under `erdeer_sandbox`. On any successful auth bootstrap (`AuthProvider`), if the localStorage key is present it is POSTed as a new personal diagram and then cleared. No "Save to account" button — the import is silent. Logged-in users visiting `/sandbox` are redirected to `/`.
- IE (crow's foot) markers: TODO - removed for now, to be revisited
- VIEW badge on table header: TODO - parse view property from entity and show badge to distinguish views from tables

## MCP Server

Exposes diagram CRUD and AML validation via MCP (Model Context Protocol) at `POST /mcp`.

**Auth**: Bearer token via `Authorization: Bearer erd_...` header. Tokens are managed via REST API (`/api/tokens`) and scoped to the same permissions as the user.

**Tools**: list_teams, list_diagrams, get_diagram, create_diagram, update_diagram, delete_diagram, validate_aml

**Resources**: `aml://spec` - AML language specification (docs/aml-spec.md)

**Transport**: Streamable HTTP (stateful sessions). Supports POST (requests), GET (SSE streams), DELETE (session cleanup).

## Environment variables

- `BASE_URL` - Public URL for OAuth callbacks (e.g., `https://db.example.com`). Defaults to `http://localhost:7000` for dev.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - GitHub OAuth (optional)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth (optional)
- `GITLAB_CLIENT_ID` / `GITLAB_CLIENT_SECRET` - GitLab OAuth (optional)
- `DATABASE_PATH` - SQLite database path (default: `data/db.sqlite`)
- `PORT` - Server port (default: `3001`)
- `HOST` - Bind address (default: `127.0.0.1`)
- `DEV_AUTO_LOGIN` - Set to any value to auto-create a dev user and stamp its session cookie, bypassing OAuth login. Unset it to test as an anonymous visitor (server restart required).

At least one OAuth provider must be configured in production. In dev, set `DEV_AUTO_LOGIN=1` to skip OAuth entirely.

## Development

```bash
make install      # install dependencies
make dev          # run all services
make build        # production build
make lint         # typecheck + lint + format
make db-generate  # generate migration from schema changes
make db-migrate   # apply pending migrations
make db-reset     # delete database and re-run migrations
```

## Docker deployment

```bash
# Create .env with your configuration
cp .env.example .env
# Edit .env: set BASE_URL, PORT, HOST, OAuth credentials, etc.

docker compose up -d
```

The app runs on port 3000. Put Caddy (or another reverse proxy) in front of it. Migrations run automatically on startup. Data is stored in `./data/` via bind mount.
