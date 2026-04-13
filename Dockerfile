# TODO: upgrade to node:25 when @azimutt/aml supports JSON import attributes
FROM node:22-alpine AS build

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/
COPY packages/backend/package.json packages/backend/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm -r run build

# ---

FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

ENV CI=true
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/backend/dist packages/backend/dist
COPY --from=build /app/packages/backend/drizzle packages/backend/drizzle
COPY --from=build /app/packages/frontend/dist packages/frontend/dist
COPY --from=build /app/docs docs
COPY --from=build /app/node_modules/.pnpm/better-sqlite3@12.8.0/node_modules/better-sqlite3/build node_modules/.pnpm/better-sqlite3@12.8.0/node_modules/better-sqlite3/build

WORKDIR /app/packages/backend
CMD ["node", "--import", "tsx/esm", "dist/server.js"]
