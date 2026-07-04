import type {} from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import { validateSession } from "./session.js";
import { requireTokenAuth } from "./token.js";

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
  (req as any).sessionId = sessionId;
}

// Attaches the requester's identity when a valid credential is present: a
// session cookie, or an API bearer token (the CLI and agents). A missing or
// invalid session cookie falls through to the bearer token check, so a stale
// cookie cannot mask a valid token; an invalid bearer token is rejected
// outright. With neither credential the request passes through
// unauthenticated.
export async function optionalAuth(req: FastifyRequest, reply: FastifyReply) {
  const sessionId = req.cookies.session;
  if (sessionId) {
    const result = await validateSession(sessionId);
    if (result) {
      (req as any).userId = result.user.id;
      (req as any).sessionId = sessionId;
      return;
    }
  }

  if (req.headers.authorization) {
    return requireTokenAuth(req, reply);
  }
}

// Session cookie or API bearer token. Guards the diagram CRUD routes; token
// management, teams, and account deletion stay on requireAuth (session only)
// so a leaked token cannot mint further credentials or manage membership.
export async function requireAnyAuth(req: FastifyRequest, reply: FastifyReply) {
  await optionalAuth(req, reply);
  if (reply.sent) return;

  if (!(req as any).userId) {
    return reply.status(401).send({ error: "Not authenticated" });
  }
}
