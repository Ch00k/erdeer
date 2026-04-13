import type {} from "@fastify/cookie";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { generateId } from "../auth/session.js";
import { db } from "../db/connection.js";
import { diagrams, oauthAccounts, sessions, teamMembers, teams, users } from "../db/schema.js";

export async function registerTeamRoutes(app: FastifyInstance) {
  await app.register(async (scoped) => {
    scoped.addHook("onRequest", requireAuth);

    // List teams the user belongs to
    scoped.get("/api/teams", async (req) => {
      const userId = (req as any).userId as string;
      return db
        .select({
          teamId: teams.id,
          teamName: teams.name,
          createdAt: teams.createdAt,
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(eq(teamMembers.userId, userId))
        .all();
    });

    // Create a team (creator is added as member)
    scoped.post("/api/teams", async (req) => {
      const userId = (req as any).userId as string;
      const { name } = req.body as { name: string };

      const id = generateId();
      db.insert(teams).values({ id, name }).run();
      db.insert(teamMembers).values({ teamId: id, userId }).run();

      return { id, name };
    });

    // Get team members
    scoped.get("/api/teams/:teamId/members", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { teamId } = req.params as { teamId: string };

      const membership = db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .get();
      if (!membership) {
        return reply.status(403).send({ error: "Not a team member" });
      }

      return db
        .select({
          userId: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, teamId))
        .all();
    });

    // List all users (for member picker)
    scoped.get("/api/users", async () => {
      return db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
        })
        .from(users)
        .all();
    });

    // Delete current user's account and all related data
    scoped.delete("/api/users/me", async (req, reply) => {
      const userId = (req as any).userId as string;
      db.delete(diagrams).where(eq(diagrams.ownerUserId, userId)).run();
      db.delete(teamMembers).where(eq(teamMembers.userId, userId)).run();
      db.delete(sessions).where(eq(sessions.userId, userId)).run();
      db.delete(oauthAccounts).where(eq(oauthAccounts.userId, userId)).run();
      db.delete(users).where(eq(users.id, userId)).run();
      reply.clearCookie("session", { path: "/" });
      return { ok: true };
    });

    // Add a member by user ID
    scoped.post("/api/teams/:teamId/members", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { teamId } = req.params as { teamId: string };
      const { userId: targetUserId } = req.body as { userId: string };

      const membership = db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .get();
      if (!membership) {
        return reply.status(403).send({ error: "Not a team member" });
      }

      const existing = db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)))
        .get();
      if (existing) {
        return reply.status(409).send({ error: "User is already a member" });
      }

      db.insert(teamMembers).values({ teamId, userId: targetUserId }).run();

      return { ok: true };
    });

    // Remove a member
    scoped.delete("/api/teams/:teamId/members/:memberId", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { teamId, memberId } = req.params as {
        teamId: string;
        memberId: string;
      };

      const membership = db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .get();
      if (!membership) {
        return reply.status(403).send({ error: "Not a team member" });
      }

      db.delete(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberId)))
        .run();

      return { ok: true };
    });
  });
}
