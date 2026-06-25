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

Deployed to [Fly.io](https://fly.io) as a single machine backed by one persistent volume (SQLite is a local file, so the app must not be scaled beyond one machine). Config lives in `fly.toml`.

Deploys run from GitHub Actions (`.github/workflows/ci.yml`): on every push to `main` the workflow lints, builds the Docker image in the runner, pushes it to Fly's registry (`registry.fly.io`), and runs `fly deploy --image`. Fly's own builder is not used.

First-time setup:

```bash
fly apps create erdeer
fly volumes create erdeer_data --region fra --size 1
fly secrets set \
  BASE_URL=https://erdeer.dev \
  GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=... \
  GITLAB_CLIENT_ID=... GITLAB_CLIENT_SECRET=... \
  ALLOWED_DOMAINS=zytlyn.com,vorsee.ai
```

Create a scoped deploy token and add its output as the `FLY_API_TOKEN` repository secret (Settings -> Secrets and variables -> Actions) so the workflow can authenticate:

```bash
fly tokens create deploy -a erdeer
```

For a custom domain, point DNS at the app and provision a certificate:

```bash
fly ips allocate-v4 --shared
fly ips allocate-v6
fly certs add erdeer.dev
```

Then add the DNS records Fly prints (an `A`/`AAAA` or `CNAME` to the app, plus the ACME `CNAME` for the cert).

OAuth callback URLs registered with each provider must match `BASE_URL`:

- GitHub: `https://erdeer.dev/auth/github/callback`
- GitLab: `https://erdeer.dev/auth/gitlab/callback`
- Google: `https://erdeer.dev/auth/google/callback`

Subsequent deploys happen automatically on push to `main` (or manually via the workflow's "Run workflow" button). Migrations run automatically on startup.

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
