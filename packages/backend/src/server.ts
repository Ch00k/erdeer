import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Fastify from "fastify";
import { createProviders } from "./auth/providers.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { db } from "./db/connection.js";
import { registerDiagramRoutes } from "./diagrams/routes.js";
import { registerMcpRoutes } from "./mcp/server.js";
import { packageRoot } from "./paths.js";
import { registerTeamRoutes } from "./teams/routes.js";
import { registerTokenRoutes } from "./tokens/routes.js";

// Run migrations on startup
const migrationsFolder = resolve(packageRoot, "drizzle");
if (existsSync(migrationsFolder)) {
  migrate(db, { migrationsFolder });
}

// The path without its query string, which can carry an OAuth callback's code.
function pathOf(url: string): string {
  return url.split("?")[0];
}

// Trust only loopback/private hops (a co-located Caddy or Fly's proxy) when
// deriving req.ip from X-Forwarded-For, so the client address is the one a
// trusted proxy appended rather than a value the client can spoof.
//
// Fastify logs each request as it arrives and again as it completes, and an
// error with the request it came from. These serializers are what those lines
// show: method, path and user agent, then status and bytes beside the time
// taken, which is how to tell what woke the suspended machine. No client
// address and no query string. Logged on arrival, so a stream that stays open
// for hours, as a tab's SSE connection does, is seen when it starts.
const app = Fastify({
  logger: {
    serializers: {
      req: (request) => ({
        method: request.method,
        path: pathOf(request.url),
        userAgent: request.headers["user-agent"] ?? null,
      }),
      res: (reply) => {
        const length = reply.getHeader?.("content-length");
        return {
          statusCode: reply.statusCode,
          bytes: length === undefined ? null : Number(length),
        };
      },
    },
  },
  trustProxy: "loopback, linklocal, uniquelocal",
});

await app.register(cookie);

await app.register(rateLimit, {
  max: 300,
  timeWindow: "1 minute",
  keyGenerator: (req) => {
    // On Fly the X-Forwarded-For chain is not safe to key on; Fly Proxy sets
    // Fly-Client-IP to the real client address and overwrites any client-supplied
    // value. Fall back to the proxy-trusted req.ip for non-Fly deployments.
    const flyClientIp = req.headers["fly-client-ip"];
    return (typeof flyClientIp === "string" && flyClientIp) || req.ip;
  },
});

app.get("/health", async () => {
  return { status: "ok" };
});

const port = Number(process.env.PORT) || 3001;
const baseUrl = process.env.BASE_URL || "http://localhost:7000";

const providers = createProviders(baseUrl);
registerAuthRoutes(app, providers);
await registerDiagramRoutes(app, baseUrl);
await registerTeamRoutes(app);
await registerTokenRoutes(app);
await registerMcpRoutes(app, baseUrl);

// Serve frontend static files in production
const frontendDist = resolve(packageRoot, "../frontend/dist");
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
