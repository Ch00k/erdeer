import type {} from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import { validateSession } from "./session.js";

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const sessionId = req.cookies.session;
  if (!sessionId) {
    return reply.status(401).send({ error: "Not authenticated" });
  }

  const result = await validateSession(sessionId);
  if (!result) {
    reply.clearCookie("session", { path: "/" });
    return reply.status(401).send({ error: "Not authenticated" });
  }

  (req as any).userId = result.user.id;
  (req as any).userRole = result.user.role;
  (req as any).sessionId = sessionId;
}
