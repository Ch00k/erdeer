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
// Requests are logged by the onResponse hook below, one line each. Anything else
// that logs a request, an error among them, shows it through the req serializer,
// which keeps no client address and no query string either.
const app = Fastify({
  logger: {
    serializers: {
      req: (request) => ({ method: request.method, path: pathOf(request.url) }),
    },
  },
  disableRequestLogging: true,
  trustProxy: "loopback, linklocal, uniquelocal",
});

// One line per request: method, path, status, bytes, time taken and user agent,
// which is how to tell what woke the suspended machine. No client address and no
// query string.
app.addHook("onResponse", async (request, reply) => {
  const length = reply.getHeader("content-length");
  request.log.info(
    {
      method: request.method,
      path: pathOf(request.url),
      status: reply.statusCode,
      bytes: length === undefined ? null : Number(length),
      ms: Math.round(reply.elapsedTime),
      userAgent: request.headers["user-agent"] ?? null,
    },
    "request",
  );
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
