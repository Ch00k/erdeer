import type {} from "@fastify/cookie";
import { and, eq, inArray } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { generateId } from "../auth/session.js";
import { db } from "../db/connection.js";
import { comments, commentThreads, diagrams, teamMembers, users } from "../db/schema.js";
import { emitCommentEvent } from "../events.js";

async function getDiagramWithAccessCheck(userId: string, diagramId: string, reply: FastifyReply) {
  const diagram = db.select().from(diagrams).where(eq(diagrams.id, diagramId)).get();
  if (!diagram) {
    reply.status(404).send({ error: "Diagram not found" });
    return null;
  }

  if (diagram.ownerUserId !== userId) {
    if (diagram.teamId) {
      const membership = db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, diagram.teamId), eq(teamMembers.userId, userId)))
        .get();
      if (!membership) {
        reply.status(403).send({ error: "Access denied" });
        return null;
      }
    } else {
      reply.status(403).send({ error: "Access denied" });
      return null;
    }
  }

  return diagram;
}

interface CommentUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

function toCommentUser(user: { id: string; name: string; avatarUrl: string | null }): CommentUser {
  return { id: user.id, name: user.name, avatarUrl: user.avatarUrl };
}

function buildThreadResponse(
  thread: typeof commentThreads.$inferSelect,
  threadComments: (typeof comments.$inferSelect)[],
  userMap: Map<string, CommentUser>,
) {
  return {
    id: thread.id,
    diagramId: thread.diagramId,
    anchorType: thread.anchorType,
    anchorEntity: thread.anchorEntity,
    anchorColumn: thread.anchorColumn,
    resolvedAt: thread.resolvedAt?.toISOString() ?? null,
    resolvedBy: thread.resolvedBy,
    createdBy: userMap.get(thread.createdBy) ?? {
      id: thread.createdBy,
      name: "Unknown",
      avatarUrl: null,
    },
    updatedBy: userMap.get(thread.updatedBy) ?? {
      id: thread.updatedBy,
      name: "Unknown",
      avatarUrl: null,
    },
    comments: threadComments.map((c) => ({
      id: c.id,
      threadId: c.threadId,
      user: userMap.get(c.userId) ?? { id: c.userId, name: "Unknown", avatarUrl: null },
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
  };
}

export async function registerCommentRoutes(app: FastifyInstance) {
  await app.register(async (scoped) => {
    scoped.addHook("onRequest", requireAuth);

    // List threads with comments for a diagram
    scoped.get("/api/diagrams/:diagramId/threads", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { diagramId } = req.params as { diagramId: string };

      const diagram = await getDiagramWithAccessCheck(userId, diagramId, reply);
      if (!diagram) return;

      const threads = db
        .select()
        .from(commentThreads)
        .where(eq(commentThreads.diagramId, diagramId))
        .all();

      if (threads.length === 0) return [];

      const threadIds = threads.map((t) => t.id);
      const allComments = db
        .select()
        .from(comments)
        .where(inArray(comments.threadId, threadIds))
        .all();

      // Collect all user IDs
      const userIds = new Set<string>();
      for (const t of threads) {
        userIds.add(t.createdBy);
        userIds.add(t.updatedBy);
      }
      for (const c of allComments) {
        userIds.add(c.userId);
      }

      const userRows = db
        .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(inArray(users.id, [...userIds]))
        .all();
      const userMap = new Map<string, CommentUser>(userRows.map((u) => [u.id, toCommentUser(u)]));

      // Group comments by thread
      const commentsByThread = new Map<string, (typeof comments.$inferSelect)[]>();
      for (const c of allComments) {
        if (!commentsByThread.has(c.threadId)) commentsByThread.set(c.threadId, []);
        commentsByThread.get(c.threadId)!.push(c);
      }

      return threads.map((t) => buildThreadResponse(t, commentsByThread.get(t.id) ?? [], userMap));
    });

    // Create a thread with first comment
    scoped.post("/api/diagrams/:diagramId/threads", async (req, reply) => {
      const userId = (req as any).userId as string;
      const sessionId = (req as any).sessionId as string;
      const { diagramId } = req.params as { diagramId: string };
      const { anchorType, anchorEntity, anchorColumn, body } = req.body as {
        anchorType: "diagram" | "entity" | "column";
        anchorEntity?: string;
        anchorColumn?: string;
        body: string;
      };

      const diagram = await getDiagramWithAccessCheck(userId, diagramId, reply);
      if (!diagram) return;

      // Validate anchor
      if (anchorType === "entity" && !anchorEntity) {
        return reply.status(400).send({ error: "anchorEntity is required for entity anchor" });
      }
      if (anchorType === "column" && (!anchorEntity || !anchorColumn)) {
        return reply
          .status(400)
          .send({ error: "anchorEntity and anchorColumn are required for column anchor" });
      }
      if (!body?.trim()) {
        return reply.status(400).send({ error: "body is required" });
      }

      const now = new Date();
      const threadId = generateId();
      const commentId = generateId();

      db.insert(commentThreads)
        .values({
          id: threadId,
          diagramId,
          anchorType,
          anchorEntity: anchorEntity ?? null,
          anchorColumn: anchorColumn ?? null,
          createdBy: userId,
          updatedBy: userId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(comments)
        .values({
          id: commentId,
          threadId,
          userId,
          body: body.trim(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const user = db
        .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, userId))
        .get()!;
      const userMap = new Map([[userId, toCommentUser(user)]]);

      const thread = db.select().from(commentThreads).where(eq(commentThreads.id, threadId)).get()!;
      const threadComments = db
        .select()
        .from(comments)
        .where(eq(comments.threadId, threadId))
        .all();
      const response = buildThreadResponse(thread, threadComments, userMap);

      emitCommentEvent({
        diagramId,
        sourceSessionId: sessionId,
        type: "thread:created",
        payload: response,
      });

      return response;
    });

    // Resolve/unresolve a thread
    scoped.patch("/api/diagrams/:diagramId/threads/:threadId", async (req, reply) => {
      const userId = (req as any).userId as string;
      const sessionId = (req as any).sessionId as string;
      const { diagramId, threadId } = req.params as { diagramId: string; threadId: string };
      const { resolved } = req.body as { resolved: boolean };

      const diagram = await getDiagramWithAccessCheck(userId, diagramId, reply);
      if (!diagram) return;

      const thread = db
        .select()
        .from(commentThreads)
        .where(and(eq(commentThreads.id, threadId), eq(commentThreads.diagramId, diagramId)))
        .get();
      if (!thread) {
        return reply.status(404).send({ error: "Thread not found" });
      }

      const now = new Date();
      db.update(commentThreads)
        .set({
          resolvedAt: resolved ? now : null,
          resolvedBy: resolved ? userId : null,
          updatedBy: userId,
          updatedAt: now,
        })
        .where(eq(commentThreads.id, threadId))
        .run();

      emitCommentEvent({
        diagramId,
        sourceSessionId: sessionId,
        type: resolved ? "thread:resolved" : "thread:unresolved",
        payload: { threadId },
      });

      const updated = db
        .select()
        .from(commentThreads)
        .where(eq(commentThreads.id, threadId))
        .get()!;
      const threadComments = db
        .select()
        .from(comments)
        .where(eq(comments.threadId, threadId))
        .all();

      const userIds = new Set([
        updated.createdBy,
        updated.updatedBy,
        ...threadComments.map((c) => c.userId),
      ]);
      const userRows = db
        .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(inArray(users.id, [...userIds]))
        .all();
      const userMap = new Map<string, CommentUser>(userRows.map((u) => [u.id, toCommentUser(u)]));

      return buildThreadResponse(updated, threadComments, userMap);
    });

    // Delete a thread
    scoped.delete("/api/diagrams/:diagramId/threads/:threadId", async (req, reply) => {
      const userId = (req as any).userId as string;
      const sessionId = (req as any).sessionId as string;
      const { diagramId, threadId } = req.params as { diagramId: string; threadId: string };

      const diagram = await getDiagramWithAccessCheck(userId, diagramId, reply);
      if (!diagram) return;

      const thread = db
        .select()
        .from(commentThreads)
        .where(and(eq(commentThreads.id, threadId), eq(commentThreads.diagramId, diagramId)))
        .get();
      if (!thread) {
        return reply.status(404).send({ error: "Thread not found" });
      }

      if (thread.createdBy !== userId) {
        return reply.status(403).send({ error: "Only the thread creator can delete it" });
      }

      db.delete(commentThreads).where(eq(commentThreads.id, threadId)).run();

      emitCommentEvent({
        diagramId,
        sourceSessionId: sessionId,
        type: "thread:deleted",
        payload: { threadId },
      });

      return { ok: true };
    });

    // Add a comment to a thread
    scoped.post("/api/diagrams/:diagramId/threads/:threadId/comments", async (req, reply) => {
      const userId = (req as any).userId as string;
      const sessionId = (req as any).sessionId as string;
      const { diagramId, threadId } = req.params as { diagramId: string; threadId: string };
      const { body } = req.body as { body: string };

      const diagram = await getDiagramWithAccessCheck(userId, diagramId, reply);
      if (!diagram) return;

      const thread = db
        .select()
        .from(commentThreads)
        .where(and(eq(commentThreads.id, threadId), eq(commentThreads.diagramId, diagramId)))
        .get();
      if (!thread) {
        return reply.status(404).send({ error: "Thread not found" });
      }

      if (!body?.trim()) {
        return reply.status(400).send({ error: "body is required" });
      }

      const now = new Date();
      const commentId = generateId();

      db.insert(comments)
        .values({
          id: commentId,
          threadId,
          userId,
          body: body.trim(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(commentThreads)
        .set({ updatedBy: userId, updatedAt: now })
        .where(eq(commentThreads.id, threadId))
        .run();

      const user = db
        .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, userId))
        .get()!;

      const response = {
        id: commentId,
        threadId,
        user: toCommentUser(user),
        body: body.trim(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      emitCommentEvent({
        diagramId,
        sourceSessionId: sessionId,
        type: "comment:created",
        payload: { ...response, threadId },
      });

      return response;
    });

    // Edit a comment
    scoped.patch(
      "/api/diagrams/:diagramId/threads/:threadId/comments/:commentId",
      async (req, reply) => {
        const userId = (req as any).userId as string;
        const sessionId = (req as any).sessionId as string;
        const { diagramId, threadId, commentId } = req.params as {
          diagramId: string;
          threadId: string;
          commentId: string;
        };
        const { body } = req.body as { body: string };

        const diagram = await getDiagramWithAccessCheck(userId, diagramId, reply);
        if (!diagram) return;

        const comment = db
          .select()
          .from(comments)
          .where(and(eq(comments.id, commentId), eq(comments.threadId, threadId)))
          .get();
        if (!comment) {
          return reply.status(404).send({ error: "Comment not found" });
        }

        if (comment.userId !== userId) {
          return reply.status(403).send({ error: "Only the author can edit this comment" });
        }

        if (!body?.trim()) {
          return reply.status(400).send({ error: "body is required" });
        }

        const now = new Date();
        db.update(comments)
          .set({ body: body.trim(), updatedAt: now })
          .where(eq(comments.id, commentId))
          .run();

        db.update(commentThreads)
          .set({ updatedBy: userId, updatedAt: now })
          .where(eq(commentThreads.id, threadId))
          .run();

        const user = db
          .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.id, userId))
          .get()!;

        const response = {
          id: commentId,
          threadId,
          user: toCommentUser(user),
          body: body.trim(),
          createdAt: comment.createdAt.toISOString(),
          updatedAt: now.toISOString(),
        };

        emitCommentEvent({
          diagramId,
          sourceSessionId: sessionId,
          type: "comment:updated",
          payload: response,
        });

        return response;
      },
    );

    // Delete a comment
    scoped.delete(
      "/api/diagrams/:diagramId/threads/:threadId/comments/:commentId",
      async (req, reply) => {
        const userId = (req as any).userId as string;
        const sessionId = (req as any).sessionId as string;
        const { diagramId, threadId, commentId } = req.params as {
          diagramId: string;
          threadId: string;
          commentId: string;
        };

        const diagram = await getDiagramWithAccessCheck(userId, diagramId, reply);
        if (!diagram) return;

        const comment = db
          .select()
          .from(comments)
          .where(and(eq(comments.id, commentId), eq(comments.threadId, threadId)))
          .get();
        if (!comment) {
          return reply.status(404).send({ error: "Comment not found" });
        }

        if (comment.userId !== userId) {
          return reply.status(403).send({ error: "Only the author can delete this comment" });
        }

        // If this is the last comment, delete the entire thread
        const commentCount = db
          .select({ id: comments.id })
          .from(comments)
          .where(eq(comments.threadId, threadId))
          .all().length;

        if (commentCount <= 1) {
          db.delete(commentThreads).where(eq(commentThreads.id, threadId)).run();

          emitCommentEvent({
            diagramId,
            sourceSessionId: sessionId,
            type: "thread:deleted",
            payload: { threadId },
          });
        } else {
          db.delete(comments).where(eq(comments.id, commentId)).run();

          const now = new Date();
          db.update(commentThreads)
            .set({ updatedBy: userId, updatedAt: now })
            .where(eq(commentThreads.id, threadId))
            .run();

          emitCommentEvent({
            diagramId,
            sourceSessionId: sessionId,
            type: "comment:deleted",
            payload: { threadId, commentId },
          });
        }

        return { ok: true };
      },
    );
  });
}
