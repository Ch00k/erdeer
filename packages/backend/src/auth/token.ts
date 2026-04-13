import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/connection.js";
import { apiTokens, users } from "../db/schema.js";
import { generateId } from "./session.js";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createApiToken(
  userId: string,
  name: string,
): Promise<{ id: string; token: string }> {
  const id = generateId();
  const token = `erd_${generateId()}`;
  const tokenHash = hashToken(token);
  const now = new Date();

  await db.insert(apiTokens).values({
    id,
    userId,
    tokenHash,
    name,
    createdAt: now,
    updatedAt: now,
  });

  return { id, token };
}

export async function requireTokenAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Not authenticated" });
  }

  const token = header.slice(7);
  const tokenHash = hashToken(token);

  const result = await db
    .select({
      apiToken: apiTokens,
      user: users,
    })
    .from(apiTokens)
    .innerJoin(users, eq(apiTokens.userId, users.id))
    .where(eq(apiTokens.tokenHash, tokenHash))
    .get();

  if (!result) {
    return reply.status(401).send({ error: "Not authenticated" });
  }

  // Update last used timestamp (fire and forget)
  db.update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, result.apiToken.id))
    .run();

  (req as any).userId = result.user.id;
  (req as any).userRole = result.user.role;
}
