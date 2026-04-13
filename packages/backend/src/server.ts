import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Fastify from "fastify";
import { createProviders } from "./auth/providers.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { db } from "./db/connection.js";
import { registerDiagramRoutes } from "./diagrams/routes.js";
import { registerMcpRoutes } from "./mcp/server.js";
import { registerTeamRoutes } from "./teams/routes.js";
import { registerTokenRoutes } from "./tokens/routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Run migrations on startup
const migrationsFolder = resolve(__dirname, "../drizzle");
if (existsSync(migrationsFolder)) {
  migrate(db, { migrationsFolder });
}

const app = Fastify({ logger: true });

await app.register(cookie);

app.get("/health", async () => {
  return { status: "ok" };
});

const port = Number(process.env.PORT) || 3001;
const baseUrl = process.env.BASE_URL || "http://localhost:7000";

if (process.env.DEV_MODE) {
  const { ensureDevSession } = await import("./auth/dev.js");
  const devSessionId = await ensureDevSession();
  app.addHook("onRequest", async (req, reply) => {
    if (!req.cookies.session) {
      req.cookies.session = devSessionId;
      reply.setCookie("session", devSessionId, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
      });
    }
  });
  app.log.info("Dev mode: auto-login enabled");
}

const providers = createProviders(baseUrl);
registerAuthRoutes(app, providers);
await registerDiagramRoutes(app);
await registerTeamRoutes(app);
await registerTokenRoutes(app);
await registerMcpRoutes(app);

// Serve frontend static files in production
const frontendDist = resolve(__dirname, "../../frontend/dist");
if (existsSync(frontendDist)) {
  await app.register(fastifyStatic, {
    root: frontendDist,
    wildcard: false,
  });

  // SPA fallback: serve index.html for non-API routes
  app.setNotFoundHandler(async (_req, reply) => {
    return reply.sendFile("index.html");
  });
}

const host = process.env.HOST || "127.0.0.1";
await app.listen({ port, host });
