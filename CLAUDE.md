# ERDeer

Browser-based database schema designer using AML (Azimutt Markup Language).

## Project lifecycle

Version 0.1.0 - **beta**.

## Where things are

pnpm monorepo: `packages/frontend` (React + TypeScript + Vite + CSS Modules), `packages/backend` (Fastify + Drizzle
ORM + SQLite), `packages/shared` (code all three share) and `packages/cli` (the `erdeer` binary).

The module-by-module map, every tech decision and the reasoning behind the rules below are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Read the matching section before changing an area. User-facing setup,
deployment and environment variables: [README.md](README.md). The AML spec served as `aml://spec`:
[docs/aml-spec.md](docs/aml-spec.md).

## Rules

### Shared code

- **`validateAml` in `@erdeer/shared` is the single source of AML validation**, used by the MCP `validate_aml` tool
  and the CLI; the CLI has no parsing logic of its own. The MCP tools and the CLI share logic and REST endpoints so
  their results are identical - keep it that way.
- `parseAml`, the layout format and the HTML-export payload live in `@erdeer/shared`; the frontend's `aml.ts`,
  `layout.ts` and `types.ts` only re-export them.

### The export viewer (`packages/frontend/src/export/`)

- **The viewer entry may import only `@erdeer/shared/layout` and `@erdeer/shared/export`** - never the barrel or
  `/export-html`. That keeps the AML parser (~630 kB) and the payload placeholder literal out of the viewer bundle.
- **`download.ts` and `@erdeer/shared/export-html` must stay out of the viewer's import graph**: a copy of the
  placeholder inside the template's inlined JS could be hit by the injection instead of the payload tag. That is why
  `Workspace`, not `DiagramControls`, owns the export handler.
- `elkStub.ts` replaces elkjs in the viewer build (auto-layout is unreachable read-only; ELK is ~1.4 MB).
- `AmlCode.tsx`'s tokenizer rules are copied from @azimutt/aml's Monarch grammar, because importing the grammar
  pulls in the whole parser. Keep them in sync with upstream `src/extensions/monaco.ts`.
- The viewer template (`export-viewer.html`) is built by `vite.export.config.ts` into the gitignored `public/`, via
  `build:export`, before `vite`/`vite build`.

### Diagram rendering

- **`Diagram` always passes a no-op `onNodeMouseEnter`**: without it React Flow sets `pointer-events: none` on nodes
  that are neither selectable nor draggable, which kills hover tooltips in read-only views.
- Edge drawing and React Flow selection stay off; an edge is clickable only to highlight it. Edge ids are
  `relationKey(rel)`.
- **`parseLayout` must keep reading the old node-only format** (a bare map). The backend stores the layout as an
  opaque JSON string.
- A stored auto-layout `route` is valid only while its handle anchors match the live handles; `RelationEdge` falls
  back to smooth-step otherwise. Moving a table or flipping a connector invalidates only that edge's route.

### Backend auth and access

- **Diagram CRUD uses `requireAnyAuth`** (session or API token, so the CLI and agents can write); **token
  management, teams and account deletion stay on `requireAuth`**, so a leaked token cannot mint further credentials
  or manage membership. An invalid bearer token is a 401 even on a public diagram.
- Read and write checks go through `userCanRead`/`userCanEdit` in `src/diagrams/access.ts`, shared by REST and MCP.
  Only the owner may change a diagram's `visibility`.
- There is deliberately no user-search or enumeration endpoint; invitations are addressed by typed email.
- **The MCP transport is stateless**: a server and transport per request, nothing kept between requests. Clients
  rarely end sessions, so stored sessions leak memory.
- `export_diagram` returns the export URL and filename, never the HTML (~400 kB would flood the calling agent's
  context).
- Live updates: every diagram write emits on the event bus from **both** the REST and the MCP paths; the frontend
  filters out its own session by `sourceSessionId`.
- OAuth state is kept in an in-memory Map, not cookies (cookies break through the Vite proxy in dev).
- The rate limiter keys on `Fly-Client-IP`, and `trustProxy` trusts only loopback/private hops, so a client cannot
  spoof its address.
- `DEV_CLIENT_ID`/`DEV_CLIENT_SECRET` enable a dev login with no external IdP. Never set them in production.

### CLI (`packages/cli`)

- Built with **Bun, not Node**: `@azimutt/aml` imports its `package.json` without a JSON import attribute, which Node
  23+ rejects (the backend sidesteps it by bundling with esbuild).
- Exit codes are a contract: `0` success, `1` operation rejected (invalid AML, HTTP error), `2` usage/I-O/network
  error.

### Deployment

- **One Fly.io machine with one volume, never more**: SQLite is a local file. Production deploys only from an
  `X.Y.Z` tag.
- The version comes from git, not `package.json` (`ERDEER_VERSION` > `git describe` > `"dev"`).

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

Migrations run automatically on startup.
