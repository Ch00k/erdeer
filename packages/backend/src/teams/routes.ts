import type {} from "@fastify/cookie";
import { and, eq, like } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { generateId } from "../auth/session.js";
import { db } from "../db/connection.js";
import {
  diagrams,
  oauthAccounts,
  sessions,
  teamInvitations,
  teamMembers,
  teams,
  users,
} from "../db/schema.js";

function requireOwner(teamId: string, userId: string) {
  const membership = db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .get();
  if (!membership || membership.role !== "owner") {
    return null;
  }
  return membership;
}

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

    // Create a team (creator is added as owner)
    scoped.post("/api/teams", async (req) => {
      const userId = (req as any).userId as string;
      const { name } = req.body as { name: string };

      const id = generateId();
      db.insert(teams).values({ id, name }).run();
      db.insert(teamMembers).values({ teamId: id, userId, role: "owner" }).run();

      return { id, name };
    });

    // Get team members (any member can view)
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
          role: teamMembers.role,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, teamId))
        .all();
    });

    // Remove a member (owner can remove others, anyone can remove self)
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

      const isSelf = userId === memberId;

      if (!isSelf && membership.role !== "owner") {
        return reply.status(403).send({ error: "Only owners can remove other members" });
      }

      if (isSelf) {
        const allMembers = db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.teamId, teamId))
          .all();

        if (allMembers.length === 1) {
          // Last member leaving - delete team and its diagrams
          db.delete(teamInvitations).where(eq(teamInvitations.teamId, teamId)).run();
          db.delete(diagrams).where(eq(diagrams.teamId, teamId)).run();
          db.delete(teamMembers).where(eq(teamMembers.teamId, teamId)).run();
          db.delete(teams).where(eq(teams.id, teamId)).run();
          return { ok: true };
        }

        if (membership.role === "owner") {
          const otherOwners = allMembers.filter((m) => m.userId !== userId && m.role === "owner");
          if (otherOwners.length === 0) {
            return reply
              .status(400)
              .send({ error: "Transfer ownership before leaving (you are the only owner)" });
          }
        }
      }

      db.delete(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberId)))
        .run();

      return { ok: true };
    });

    // Search users by email
    scoped.get("/api/users/search", async (req, reply) => {
      const { email } = req.query as { email?: string };
      if (!email || email.length < 3) {
        return reply.status(400).send({ error: "Query must be at least 3 characters" });
      }

      return db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(like(users.email, `%${email}%`))
        .limit(10)
        .all();
    });

    // Invite a user to a team (owner only)
    scoped.post("/api/teams/:teamId/invitations", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { teamId } = req.params as { teamId: string };
      const { email } = req.body as { email: string };

      if (!requireOwner(teamId, userId)) {
        return reply.status(403).send({ error: "Only owners can invite members" });
      }

      // Check if already a member
      const existingUser = db.select().from(users).where(eq(users.email, email)).get();
      if (existingUser) {
        const existingMember = db
          .select()
          .from(teamMembers)
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, existingUser.id)))
          .get();
        if (existingMember) {
          return reply.status(409).send({ error: "User is already a member" });
        }
      }

      // Check for duplicate pending invitation
      const existingInvite = db
        .select()
        .from(teamInvitations)
        .where(
          and(
            eq(teamInvitations.teamId, teamId),
            eq(teamInvitations.invitedEmail, email),
            eq(teamInvitations.status, "pending"),
          ),
        )
        .get();
      if (existingInvite) {
        return reply.status(409).send({ error: "Invitation already pending for this email" });
      }

      const id = generateId();
      db.insert(teamInvitations)
        .values({ id, teamId, invitedEmail: email, invitedBy: userId })
        .run();

      return { id, teamId, invitedEmail: email, invitedBy: userId, status: "pending" };
    });

    // List pending invitations for a team (owner only)
    scoped.get("/api/teams/:teamId/invitations", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { teamId } = req.params as { teamId: string };

      if (!requireOwner(teamId, userId)) {
        return reply.status(403).send({ error: "Only owners can view invitations" });
      }

      return db
        .select({
          id: teamInvitations.id,
          invitedEmail: teamInvitations.invitedEmail,
          invitedBy: teamInvitations.invitedBy,
          status: teamInvitations.status,
          createdAt: teamInvitations.createdAt,
        })
        .from(teamInvitations)
        .where(and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.status, "pending")))
        .all();
    });

    // Cancel a pending invitation (owner only)
    scoped.delete("/api/teams/:teamId/invitations/:id", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { teamId, id } = req.params as { teamId: string; id: string };

      if (!requireOwner(teamId, userId)) {
        return reply.status(403).send({ error: "Only owners can cancel invitations" });
      }

      db.delete(teamInvitations)
        .where(
          and(
            eq(teamInvitations.id, id),
            eq(teamInvitations.teamId, teamId),
            eq(teamInvitations.status, "pending"),
          ),
        )
        .run();

      return { ok: true };
    });

    // List pending invitations for the current user
    scoped.get("/api/invitations", async (req) => {
      const userId = (req as any).userId as string;
      const user = db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) return [];

      return db
        .select({
          id: teamInvitations.id,
          teamId: teamInvitations.teamId,
          teamName: teams.name,
          invitedBy: teamInvitations.invitedBy,
          inviterName: users.name,
          createdAt: teamInvitations.createdAt,
        })
        .from(teamInvitations)
        .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
        .innerJoin(users, eq(teamInvitations.invitedBy, users.id))
        .where(
          and(eq(teamInvitations.invitedEmail, user.email), eq(teamInvitations.status, "pending")),
        )
        .all();
    });

    // Accept an invitation
    scoped.post("/api/invitations/:id/accept", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { id } = req.params as { id: string };
      const user = db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) return reply.status(401).send({ error: "Not authenticated" });

      const invitation = db
        .select()
        .from(teamInvitations)
        .where(
          and(
            eq(teamInvitations.id, id),
            eq(teamInvitations.invitedEmail, user.email),
            eq(teamInvitations.status, "pending"),
          ),
        )
        .get();
      if (!invitation) {
        return reply.status(404).send({ error: "Invitation not found" });
      }

      db.insert(teamMembers).values({ teamId: invitation.teamId, userId, role: "member" }).run();
      db.update(teamInvitations)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(teamInvitations.id, id))
        .run();

      return { ok: true };
    });

    // Decline an invitation
    scoped.post("/api/invitations/:id/decline", async (req, reply) => {
      const userId = (req as any).userId as string;
      const { id } = req.params as { id: string };
      const user = db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) return reply.status(401).send({ error: "Not authenticated" });

      const invitation = db
        .select()
        .from(teamInvitations)
        .where(
          and(
            eq(teamInvitations.id, id),
            eq(teamInvitations.invitedEmail, user.email),
            eq(teamInvitations.status, "pending"),
          ),
        )
        .get();
      if (!invitation) {
        return reply.status(404).send({ error: "Invitation not found" });
      }

      db.update(teamInvitations)
        .set({ status: "declined", updatedAt: new Date() })
        .where(eq(teamInvitations.id, id))
        .run();

      return { ok: true };
    });

    // Delete current user's account and all related data
    scoped.delete("/api/users/me", async (req, reply) => {
      const userId = (req as any).userId as string;

      // Handle team ownership before deleting
      const memberships = db.select().from(teamMembers).where(eq(teamMembers.userId, userId)).all();

      for (const membership of memberships) {
        const allMembers = db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.teamId, membership.teamId))
          .all();

        if (allMembers.length === 1) {
          // Sole member - delete team and its diagrams
          db.delete(teamInvitations).where(eq(teamInvitations.teamId, membership.teamId)).run();
          db.delete(diagrams).where(eq(diagrams.teamId, membership.teamId)).run();
          db.delete(teamMembers).where(eq(teamMembers.teamId, membership.teamId)).run();
          db.delete(teams).where(eq(teams.id, membership.teamId)).run();
        } else if (membership.role === "owner") {
          const otherOwners = allMembers.filter((m) => m.userId !== userId && m.role === "owner");
          if (otherOwners.length === 0) {
            // Auto-promote longest-standing member
            const otherMembers = allMembers
              .filter((m) => m.userId !== userId)
              .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            if (otherMembers.length > 0) {
              db.update(teamMembers)
                .set({ role: "owner", updatedAt: new Date() })
                .where(
                  and(
                    eq(teamMembers.teamId, membership.teamId),
                    eq(teamMembers.userId, otherMembers[0].userId),
                  ),
                )
                .run();
            }
          }
        }
      }

      db.delete(teamInvitations).where(eq(teamInvitations.invitedBy, userId)).run();
      db.delete(diagrams).where(eq(diagrams.ownerUserId, userId)).run();
      db.delete(teamMembers).where(eq(teamMembers.userId, userId)).run();
      db.delete(sessions).where(eq(sessions.userId, userId)).run();
      db.delete(oauthAccounts).where(eq(oauthAccounts.userId, userId)).run();
      db.delete(users).where(eq(users.id, userId)).run();
      reply.clearCookie("session", { path: "/" });
      return { ok: true };
    });
  });
}
