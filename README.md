# ERDeer

Browser-based database schema designer using [AML](https://aml-lang.org/) (Azimutt Markup Language).

## Features

- AML editor with syntax highlighting (Monaco)
- Live diagram rendering with pan, zoom, and drag (React Flow)
- Personal and team-based diagram management
- OAuth sign-in (GitHub, Google, GitLab)
- MCP server for AI-assisted schema editing
- API token management

## Development

Requires Node.js and pnpm.

```bash
cp .env.example .env
# Edit .env: configure at least one OAuth provider

make install
make dev
```

The frontend runs on http://localhost:7000, the backend on port 3001.

### Available commands

```bash
make install      # install dependencies
make dev          # run all services
make build        # production build
make lint         # typecheck + lint + format
make db-generate  # generate migration from schema changes
make db-migrate   # apply pending migrations
make db-reset     # delete database and re-run migrations
```

## Deployment

```bash
cp .env.example .env
# Edit .env: set BASE_URL, OAuth credentials, etc.

docker compose up -d
```

Put a reverse proxy (e.g. Caddy) in front of it. Migrations run automatically on startup. Data is stored in `./data/` via bind mount.

## MCP Server

ERDeer exposes diagram CRUD and AML validation via MCP at `POST /mcp`.

Authenticate with a bearer token (`Authorization: Bearer erd_...`). Tokens are managed in the app under API Tokens.

**Tools**: `list_diagrams`, `get_diagram`, `create_diagram`, `update_diagram`, `delete_diagram`, `validate_aml`

**Resources**: `aml://spec` -- AML language specification

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `BASE_URL` | Public URL for OAuth callbacks | `http://localhost:7000` |
| `PORT` | Server port | `3001` |
| `HOST` | Bind address | `127.0.0.1` |
| `DATABASE_PATH` | SQLite database path | `data/db.sqlite` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth | |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth | |
| `GITLAB_CLIENT_ID` / `GITLAB_CLIENT_SECRET` | GitLab OAuth | |

At least one OAuth provider must be configured.
