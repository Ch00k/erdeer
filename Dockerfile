# TODO: upgrade to node:25 when @azimutt/aml supports JSON import attributes
FROM node:22-alpine AS build

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/
COPY packages/backend/package.json packages/backend/
COPY packages/cli/package.json packages/cli/

RUN pnpm install --frozen-lockfile

COPY . .

# .git is not in the build context, so the version cannot be derived here;
# CI passes the release tag.
ARG ERDEER_VERSION
ENV ERDEER_VERSION=$ERDEER_VERSION

RUN pnpm -r run build

# ---

FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

ENV CI=true
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/backend/dist packages/backend/dist
COPY --from=build /app/packages/backend/drizzle packages/backend/drizzle
COPY --from=build /app/packages/frontend/dist packages/frontend/dist
COPY --from=build /app/docs docs
# The pnpm store path embeds the exact better-sqlite3 version; glob it so a
# lockfile bump doesn't break this stage. COPY cannot glob the destination,
# hence the temp dir + RUN.
COPY --from=build /app/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build /tmp/better-sqlite3-build
RUN dest=$(echo node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3) && \
    cp -r /tmp/better-sqlite3-build "$dest/build" && \
    rm -rf /tmp/better-sqlite3-build

WORKDIR /app/packages/backend
CMD ["node", "--import", "tsx/esm", "dist/server.js"]
