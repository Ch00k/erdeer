import { and, eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { type diagrams, teamMembers } from "../db/schema.js";

export type Diagram = typeof diagrams.$inferSelect;

export function userCanEdit(diagram: Diagram, userId: string | undefined): boolean {
  if (!userId) return false;
  if (diagram.ownerUserId === userId) return true;
  if (!diagram.teamId) return false;

  const membership = db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, diagram.teamId), eq(teamMembers.userId, userId)))
    .get();

  return !!membership;
}

export function userCanRead(diagram: Diagram, userId: string | undefined): boolean {
  return diagram.visibility === "public" || userCanEdit(diagram, userId);
}
