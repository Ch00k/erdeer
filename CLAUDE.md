# ERDeer

Browser-based database schema designer using AML (Azimutt Markup Language).

## Project lifecycle

Version 0.0.1 - **alpha** (not yet used by users).

## Architecture

- **Monorepo** with pnpm workspaces
- `packages/frontend` - React + TypeScript + Vite + CSS Modules
- `packages/backend` - Node.js + TypeScript + Fastify + Drizzle ORM + SQLite
- `packages/shared` - Shared types

### Frontend structure

- `App.tsx` - router setup with auth-protected routes
- `auth.tsx` - AuthContext provider, fetches current user on load
- `api.ts` - API client functions (auth, diagrams CRUD, teams, tokens)
- `pages/LoginPage.tsx` - OAuth login buttons (GitHub, Google, GitLab)
- `pages/DashboardPage.tsx` - diagram list with personal/team tabs, create/delete
- `pages/DesignerPage.tsx` - AML editor + diagram canvas, auto-saves to API
- `pages/TeamsPage.tsx` - create teams, view/add/remove members
- `pages/TokensPage.tsx` - API token management (list, create, revoke)
- `pages/SchemaPage.tsx` - read-only view of the app's own database schema
- `components/Navbar.tsx` - shared navbar with user dropdown menu (Teams, API Tokens, Sign out, Delete account)
- `components/Footer.tsx` - shared footer with copyright and Schema link
- `components/ConfirmDialog.tsx` - modal confirmation dialog (replaces native confirm())
- `components/AmlReference.tsx` - toggleable AML language reference panel for the designer
- `components/ResizeHandle.tsx` - draggable divider for resizing editor pane
- `components/Editor.tsx` - Monaco-based AML editor with word wrap toggle
- `components/Diagram.tsx` - React Flow canvas, computes edges from schema relations
- `components/TableNode.tsx` - custom React Flow node for database tables
- `aml.ts` - adapter between @azimutt/aml parser output and our Schema types

### Frontend routes

- `/login` - login page (public, redirects to `/` if authenticated)
- `/` - dashboard (protected)
- `/teams` - team management (protected)
- `/tokens` - API token management (protected)
- `/schema` - editable app database schema diagram (public, session-only, not persisted)
- `/diagrams/:id` - designer (protected)

### Backend structure

- `src/db/schema.ts` - Drizzle ORM table definitions (users, oauth_accounts, sessions, teams, team_members, role_permissions, diagrams, api_tokens)
- `src/db/connection.ts` - SQLite connection via better-sqlite3 with WAL mode
- `src/auth/dev.ts` - Dev mode auto-login: seeds a dev user and stable session on startup
- `src/auth/providers.ts` - Arctic OAuth provider setup (GitHub, Google, GitLab)
- `src/auth/session.ts` - Session creation, validation (with auto-extend), deletion
- `src/auth/routes.ts` - OAuth login/callback routes, logout, /auth/me, /auth/providers endpoints
- `src/auth/middleware.ts` - requireAuth hook, attaches userId and userRole to request
- `src/auth/permissions.ts` - hasPermission check (default-allow when no permissions defined for a role)
- `src/auth/token.ts` - API token creation, hashing, and bearer token auth middleware
- `src/diagrams/routes.ts` - Diagram CRUD API (personal/team list, get, create, update, delete)
- `src/teams/routes.ts` - Team CRUD API (list, create, members, add/remove member)
- `src/tokens/routes.ts` - API token management (list, create, revoke) - session-auth protected
- `src/mcp/server.ts` - MCP server with Streamable HTTP transport, diagram CRUD tools, AML spec resource
- `drizzle.config.ts` - Drizzle Kit config for migrations
- `drizzle/` - Generated SQL migration files
- `data/` - SQLite database files (gitignored)

## Tech decisions

- **AML** as the schema language (over DBML) - more expressive, inline relations, nested columns
- **React Flow** (@xyflow/react) for diagram rendering - handles nodes, edges, pan/zoom, drag
- **CSS Modules** for styling (not Tailwind - app is IDE-like, not content/responsive)
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
- Interactive features disabled: no edge drawing, no edge selection, no element selection
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
- `ALLOWED_DOMAINS` - Comma-separated email domains to restrict signups (empty = allow all)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - GitHub OAuth (optional)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth (optional)
- `GITLAB_CLIENT_ID` / `GITLAB_CLIENT_SECRET` - GitLab OAuth (optional)
- `DATABASE_PATH` - SQLite database path (default: `data/db.sqlite`)
- `PORT` - Server port (default: `3001`)
- `HOST` - Bind address (default: `127.0.0.1`)
- `DEV_MODE` - Set to any value to auto-create a dev user and session, bypassing OAuth login

At least one OAuth provider must be configured in production. In dev, set `DEV_MODE=1` to skip OAuth entirely.

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
