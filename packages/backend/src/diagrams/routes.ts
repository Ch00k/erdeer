import type {} from "@fastify/cookie";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { optionalAuth, requireAuth } from "../auth/middleware.js";
import { generateId } from "../auth/session.js";
import { db } from "../db/connection.js";
import { diagrams, teamMembers, teams } from "../db/schema.js";
import {
  emitDiagramListChanged,
  emitDiagramUpdate,
  getAffectedUserIds,
  onDiagramListChanged,
  onDiagramUpdate,
} from "../events.js";

type Diagram = typeof diagrams.$inferSelect;

function userCanEdit(diagram: Diagram, userId: string | undefined): boolean {
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

export async function registerDiagramRoutes(app: FastifyInstance) {
  // Public-readable: get a single diagram (auth optional; public visibility allows anon read)
  app.get("/api/diagrams/:id", { onRequest: optionalAuth }, async (req: FastifyRequest, reply) => {
    const userId = (req as any).userId as string | undefined;
    const { id } = req.params as { id: string };

    const diagram = db.select().from(diagrams).where(eq(diagrams.id, id)).get();
    if (!diagram) {
      return reply.status(404).send({ error: "Diagram not found" });
    }

    const canEdit = userCanEdit(diagram, userId);
    if (!canEdit && diagram.visibility !== "public") {
      return reply.status(404).send({ error: "Diagram not found" });
    }

    let teamName: string | null = null;
    if (diagram.teamId) {
      const team = db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, diagram.teamId))
        .get();
      teamName = team?.name ?? null;
    }

    return { ...diagram, canEdit, teamName };
  });

  // Public-readable: SSE for a single diagram
  app.get(
    "/api/diagrams/:id/events",
    { onRequest: optionalAuth },
    async (req: FastifyRequest, reply) => {
      const userId = (req as any).userId as string | undefined;
      const sessionId = (req as any).sessionId as string | undefined;
      const { id } = req.params as { id: string };

      const diagram = db.select().from(diagrams).where(eq(diagrams.id, id)).get();
      if (!diagram) {
        return reply.status(404).send({ error: "Diagram not found" });
      }

      const canEdit = userCanEdit(diagram, userId);
      if (!canEdit && diagram.visibility !== "public") {
        return reply.status(404).send({ error: "Diagram not found" });
      }

      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      raw.write(`event: connected\ndata: ${JSON.stringify({ sessionId: sessionId ?? null })}\n\n`);

      const unsubscribe = onDiagramUpdate(id, (event) => {
        const data = JSON.stringify({ sourceSessionId: event.sourceSessionId });
        raw.write(`event: updated\ndata: ${data}\n\n`);
      });

      req.raw.on("close", unsubscribe);
    },
  );

  await app.register(async (scoped) => {
    scoped.addHook("onRequest", requireAuth);

    // List personal diagrams
    scoped.get("/api/diagrams/personal", async (req) => {
      const userId = (req as any).userId as string;
      return db
        .select()
        .from(diagrams)
        .where(and(eq(diagrams.ownerUserId, userId), isNull(diagrams.teamId)))
        .all();
    });

    // List team diagrams (for all teams the user belongs to)
    scoped.get("/api/diagrams/team", async (req) => {
      const userId = (req as any).userId as string;
      const memberships = db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId))
        .all();

      if (memberships.length === 0) {
        return [];
      }

      const teamIds = memberships.map((m) => m.teamId);
      const allTeamDiagrams = db.select().from(diagrams).where(isNotNull(diagrams.teamId)).all();
      return allTeamDiagrams.filter((d) => d.teamId && teamIds.includes(d.teamId));
    });

    // SSE: subscribe to diagram list changes
    scoped.get("/api/diagrams/events", async (req, reply) => {
      const userId = (req as any).userId as string;
      const sessionId = (req as any).sessionId as string;

      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      raw.write(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);

      const unsubscribe = onDiagramListChanged(userId, (event) => {
        const data = JSON.stringify({ sourceSessionId: event.sourceSessionId });
        raw.write(`event: changed\ndata: ${data}\n\n`);
      });

      req.raw.on("close", unsubscribe);
    });

    // Create a diagram
    scoped.post("/api/diagrams", async (req) => {
      const userId = (req as any).userId as string;
      const { title, amlContent, layout, teamId } = req.body as {
        title: string;
        amlContent?: string;
        layout?: string;
        teamId?: string;
      };

      const id = generateId();
      const now = new Date();
      await db.insert(diagrams).values({
        id,
        title,
        amlContent: amlContent ?? "",
        layout: layout ?? "{}",
        ownerUserId: userId,
        teamId: teamId ?? null,
        createdAt: now,
        updatedAt: now,
      });

      const created = db.select().from(diagrams).where(eq(diagrams.id, id)).get();
      const sessionId = (req as any).sessionId as string;
      const affectedUsers = await getAffectedUserIds(userId, teamId ?? null);
      for (const uid of affectedUsers) {
        emitDiagramListChanged(uid, { sourceSessionId: sessionId });
      }
      return created;
    });

    // Update a diagram
    scoped.put("/api/diagrams/:id", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { id } = req.params as { id: string };
      const { title, amlContent, layout, visibility } = req.body as {
        title?: string;
        amlContent?: string;
        layout?: string;
        visibility?: "private" | "public";
      };

      const diagram = db.select().from(diagrams).where(eq(diagrams.id, id)).get();
      if (!diagram) {
        return reply.status(404).send({ error: "Diagram not found" });
      }

      const isOwner = diagram.ownerUserId === userId;
      if (!userCanEdit(diagram, userId)) {
        return reply.status(403).send({ error: "Access denied" });
      }

      if (visibility !== undefined && !isOwner) {
        return reply.status(403).send({ error: "Only the owner can change visibility" });
      }
      if (visibility !== undefined && visibility !== "private" && visibility !== "public") {
        return reply.status(400).send({ error: "Invalid visibility" });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (amlContent !== undefined) updates.amlContent = amlContent;
      if (layout !== undefined) updates.layout = layout;
      if (visibility !== undefined) updates.visibility = visibility;

      await db.update(diagrams).set(updates).where(eq(diagrams.id, id));
      const sessionId = (req as any).sessionId as string;
      emitDiagramUpdate({ diagramId: id, sourceSessionId: sessionId });
      return db.select().from(diagrams).where(eq(diagrams.id, id)).get();
    });

    // Delete a diagram
    scoped.delete("/api/diagrams/:id", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { id } = req.params as { id: string };

      const diagram = db.select().from(diagrams).where(eq(diagrams.id, id)).get();

      if (!diagram) {
        return reply.status(404).send({ error: "Diagram not found" });
      }

      if (diagram.ownerUserId !== userId) {
        return reply.status(403).send({ error: "Only the owner can delete a diagram" });
      }

      const affectedUsers = await getAffectedUserIds(userId, diagram.teamId);
      await db.delete(diagrams).where(eq(diagrams.id, id));
      const sessionId = (req as any).sessionId as string;
      for (const uid of affectedUsers) {
        emitDiagramListChanged(uid, { sourceSessionId: sessionId });
      }
      return { ok: true };
    });
  });
}
