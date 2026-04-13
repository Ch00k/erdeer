import type {} from "@fastify/cookie";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { createApiToken } from "../auth/token.js";
import { db } from "../db/connection.js";
import { apiTokens } from "../db/schema.js";

export async function registerTokenRoutes(app: FastifyInstance) {
  await app.register(async (scoped) => {
    scoped.addHook("onRequest", requireAuth);

    // List tokens for the current user (without hashes)
    scoped.get("/api/tokens", async (req) => {
      const userId = (req as any).userId as string;
      const tokens = await db
        .select({
          id: apiTokens.id,
          name: apiTokens.name,
          lastUsedAt: apiTokens.lastUsedAt,
          createdAt: apiTokens.createdAt,
        })
        .from(apiTokens)
        .where(eq(apiTokens.userId, userId))
        .all();
      return tokens;
    });

    // Create a new token
    scoped.post("/api/tokens", async (req) => {
      const userId = (req as any).userId as string;
      const { name } = req.body as { name: string };
      const { id, token } = await createApiToken(userId, name);
      return { id, name, token };
    });

    // Revoke a token
    scoped.delete("/api/tokens/:id", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { id } = req.params as { id: string };

      const existing = await db.select().from(apiTokens).where(eq(apiTokens.id, id)).get();

      if (!existing) {
        return reply.status(404).send({ error: "Token not found" });
      }

      if (existing.userId !== userId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      await db.delete(apiTokens).where(eq(apiTokens.id, id));
      return { ok: true };
    });
  });
}
