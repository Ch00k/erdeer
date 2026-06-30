# erdeer CLI

Local AML (Azimutt Markup Language) validation, using the same parser and result
format as the ERDeer MCP `validate_aml` tool.

## Install

Download the binary for your platform from the
[GitHub Releases](https://github.com/Ch00k/erdeer/releases) page, make it
executable, and put it on your `PATH`:

```bash
curl -L https://github.com/Ch00k/erdeer/releases/latest/download/erdeer-linux-x64 -o erdeer
chmod +x erdeer
sudo mv erdeer /usr/local/bin/
```

Available targets: `erdeer-linux-x64`, `erdeer-linux-arm64`, `erdeer-darwin-x64`,
`erdeer-darwin-arm64`, `erdeer-windows-x64.exe`.

## Usage

```bash
erdeer validate schema.aml          # validate a file
erdeer validate schema.aml --json   # JSON result
cat schema.aml | erdeer validate    # validate stdin (file omitted, or "-")
erdeer validate <<'EOF'             # validate a heredoc
users
  id uuid pk
EOF
```

Exit codes: `0` valid, `1` invalid AML, `2` usage or I/O error.

## Build from source

Requires [Bun](https://bun.sh) (for the standalone binary) and pnpm.

```bash
pnpm install
pnpm --filter @erdeer/shared run build
pnpm --filter erdeer run build:binary   # produces packages/cli/dist/erdeer
```
