import type {} from "@fastify/cookie";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { generateId } from "../auth/session.js";
import { cleanupOrphanedThreads } from "../comments/cleanup.js";
import { db } from "../db/connection.js";
import { diagrams, teamMembers } from "../db/schema.js";
import {
  emitDiagramListChanged,
  emitDiagramUpdate,
  getAffectedUserIds,
  onCommentEvent,
  onDiagramListChanged,
  onDiagramUpdate,
} from "../events.js";

export async function registerDiagramRoutes(app: FastifyInstance) {
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
      const memberships = await db
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

    // Get a single diagram
    scoped.get("/api/diagrams/:id", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { id } = req.params as { id: string };

      const diagram = await db.select().from(diagrams).where(eq(diagrams.id, id)).get();

      if (!diagram) {
        return reply.status(404).send({ error: "Diagram not found" });
      }

      // Check access: owner or team member
      if (diagram.ownerUserId !== userId) {
        if (diagram.teamId) {
          const membership = await db
            .select()
            .from(teamMembers)
            .where(and(eq(teamMembers.teamId, diagram.teamId), eq(teamMembers.userId, userId)))
            .get();
          if (!membership) {
            return reply.status(403).send({ error: "Access denied" });
          }
        } else {
          return reply.status(403).send({ error: "Access denied" });
        }
      }

      return diagram;
    });

    // SSE: subscribe to diagram updates
    scoped.get("/api/diagrams/:id/events", async (req, reply) => {
      const userId = (req as any).userId as string;
      const sessionId = (req as any).sessionId as string;
      const { id } = req.params as { id: string };

      const diagram = await db.select().from(diagrams).where(eq(diagrams.id, id)).get();
      if (!diagram) {
        return reply.status(404).send({ error: "Diagram not found" });
      }

      if (diagram.ownerUserId !== userId) {
        if (diagram.teamId) {
          const membership = await db
            .select()
            .from(teamMembers)
            .where(and(eq(teamMembers.teamId, diagram.teamId), eq(teamMembers.userId, userId)))
            .get();
          if (!membership) {
            return reply.status(403).send({ error: "Access denied" });
          }
        } else {
          return reply.status(403).send({ error: "Access denied" });
        }
      }

      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      raw.write(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);

      const unsubDiagram = onDiagramUpdate(id, (event) => {
        const data = JSON.stringify({ sourceSessionId: event.sourceSessionId });
        raw.write(`event: updated\ndata: ${data}\n\n`);
      });

      const unsubComments = onCommentEvent(id, (event) => {
        const data = JSON.stringify({
          sourceSessionId: event.sourceSessionId,
          type: event.type,
          payload: event.payload,
        });
        raw.write(`event: comment\ndata: ${data}\n\n`);
      });

      req.raw.on("close", () => {
        unsubDiagram();
        unsubComments();
      });
    });

    // Create a diagram
    scoped.post("/api/diagrams", async (req) => {
      const userId = (req as any).userId as string;
      const { title, amlContent, teamId } = req.body as {
        title: string;
        amlContent?: string;
        teamId?: string;
      };

      const id = generateId();
      const now = new Date();
      await db.insert(diagrams).values({
        id,
        title,
        amlContent: amlContent ?? "",
        ownerUserId: userId,
        teamId: teamId ?? null,
        createdAt: now,
        updatedAt: now,
      });

      const created = await db.select().from(diagrams).where(eq(diagrams.id, id)).get();
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
      const { title, amlContent, layout } = req.body as {
        title?: string;
        amlContent?: string;
        layout?: string;
      };

      const diagram = await db.select().from(diagrams).where(eq(diagrams.id, id)).get();

      if (!diagram) {
        return reply.status(404).send({ error: "Diagram not found" });
      }

      // Check access: owner or team member
      if (diagram.ownerUserId !== userId) {
        if (diagram.teamId) {
          const membership = await db
            .select()
            .from(teamMembers)
            .where(and(eq(teamMembers.teamId, diagram.teamId), eq(teamMembers.userId, userId)))
            .get();
          if (!membership) {
            return reply.status(403).send({ error: "Access denied" });
          }
        } else {
          return reply.status(403).send({ error: "Access denied" });
        }
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (amlContent !== undefined) updates.amlContent = amlContent;
      if (layout !== undefined) updates.layout = layout;

      await db.update(diagrams).set(updates).where(eq(diagrams.id, id));
      const sessionId = (req as any).sessionId as string;
      emitDiagramUpdate({ diagramId: id, sourceSessionId: sessionId });
      if (amlContent !== undefined) {
        setTimeout(() => cleanupOrphanedThreads(id, amlContent), 0);
      }
      return db.select().from(diagrams).where(eq(diagrams.id, id)).get();
    });

    // Delete a diagram
    scoped.delete("/api/diagrams/:id", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { id } = req.params as { id: string };

      const diagram = await db.select().from(diagrams).where(eq(diagrams.id, id)).get();

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
