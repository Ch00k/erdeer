import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { sessions, users } from "../db/schema.js";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function generateId(): string {
  return crypto.randomUUID();
}

export async function createSession(userId: string): Promise<string> {
  const id = generateId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return id;
}

export async function validateSession(sessionId: string) {
  const result = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .get();

  if (!result) {
    return null;
  }

  if (result.session.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  // Extend session if it's past the halfway point
  const halfLife = SESSION_DURATION_MS / 2;
  const remaining = result.session.expiresAt.getTime() - Date.now();
  if (remaining < halfLife) {
    const newExpiry = new Date(Date.now() + SESSION_DURATION_MS);
    await db.update(sessions).set({ expiresAt: newExpiry }).where(eq(sessions.id, sessionId));
  }

  return result;
}

export async function deleteSession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
