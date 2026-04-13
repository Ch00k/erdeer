import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { sessions, users } from "../db/schema.js";

const DEV_USER_ID = "dev-user";
const DEV_SESSION_ID = "dev-session";

export async function ensureDevSession(): Promise<string> {
  const existingUser = await db.select().from(users).where(eq(users.id, DEV_USER_ID)).get();
  if (!existingUser) {
    await db.insert(users).values({
      id: DEV_USER_ID,
      email: "dev@localhost",
      name: "Dev User",
      role: "admin",
    });
  }

  const existingSession = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, DEV_SESSION_ID))
    .get();

  if (existingSession && existingSession.expiresAt > new Date()) {
    return DEV_SESSION_ID;
  }

  if (existingSession) {
    await db.delete(sessions).where(eq(sessions.id, DEV_SESSION_ID));
  }

  // createSession generates a random ID, but we want a stable one
  // so the cookie survives server restarts
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: DEV_SESSION_ID, userId: DEV_USER_ID, expiresAt });
  return DEV_SESSION_ID;
}
