.PHONY: install dev build lint clean db-generate db-migrate db-reset

install:
	pnpm install

dev:
	pnpm --parallel -r run dev

build:
	pnpm -r run build

lint:
	pnpm -r run typecheck
	pnpm exec biome check --write .

db-generate:
	pnpm --filter @erdeer/backend run db:generate

db-migrate:
	pnpm --filter @erdeer/backend run db:migrate

db-reset:
	rm -f packages/backend/data/db.sqlite*
	$(MAKE) db-migrate

clean:
	rm -rf packages/*/dist packages/*/node_modules node_modules
