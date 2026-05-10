import type {} from "@fastify/cookie";
import * as arctic from "arctic";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/connection.js";
import { oauthAccounts, users } from "../db/schema.js";
import { createSession, generateId } from "./session.js";

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
};

// In-memory store for OAuth state (short-lived, only needs to survive the redirect)
const pendingStates = new Map<string, { codeVerifier?: string; expiresAt: number }>();

function storeState(state: string, codeVerifier?: string) {
  pendingStates.set(state, {
    codeVerifier,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
}

function consumeState(state: string) {
  const entry = pendingStates.get(state);
  if (!entry) return null;
  pendingStates.delete(state);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

interface ProviderUserInfo {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

async function fetchGitHubUser(accessToken: string): Promise<ProviderUserInfo> {
  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);
  const user = await userRes.json();
  const emails: Array<{ email: string; primary: boolean; verified: boolean }> =
    await emailsRes.json();
  const verified = emails.filter((e) => e.verified);
  const primaryEmail = verified.find((e) => e.primary)?.email ?? verified[0]?.email;

  return {
    id: String(user.id),
    email: primaryEmail,
    name: user.name || user.login,
    avatarUrl: user.avatar_url,
  };
}

async function fetchGoogleUser(idToken: string): Promise<ProviderUserInfo> {
  const claims = arctic.decodeIdToken(idToken) as {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  };
  return {
    id: claims.sub,
    email: claims.email,
    name: claims.name,
    avatarUrl: claims.picture ?? null,
  };
}

async function fetchGitLabUser(accessToken: string): Promise<ProviderUserInfo> {
  const userRes = await fetch("https://gitlab.com/api/v4/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const user = await userRes.json();
  return {
    id: String(user.id),
    email: user.email,
    name: user.name || user.username,
    avatarUrl: user.avatar_url,
  };
}

async function findOrCreateUser(
  provider: string,
  providerUserId: string,
  info: ProviderUserInfo,
): Promise<string> {
  // Check if this OAuth account already exists
  const existing = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(
      and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerUserId)),
    )
    .get();

  if (existing) {
    return existing.userId;
  }

  const userId = generateId();
  await db.insert(users).values({
    id: userId,
    email: info.email,
    name: info.name,
    avatarUrl: info.avatarUrl,
  });

  await db.insert(oauthAccounts).values({
    provider,
    providerUserId,
    userId,
  });

  return userId;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  providers: Record<string, arctic.GitHub | arctic.Google | arctic.GitLab>,
) {
  // Available providers
  app.get("/auth/providers", async () => {
    return {
      github: "github" in providers,
      google: "google" in providers,
      gitlab: "gitlab" in providers,
    };
  });

  // GitHub
  if (providers.github) {
    const github = providers.github as arctic.GitHub;

    app.get("/auth/github/login", async (_req, reply) => {
      const state = arctic.generateState();
      const url = github.createAuthorizationURL(state, ["user:email"]);
      storeState(state);
      return reply.redirect(url.toString());
    });

    app.get("/auth/github/callback", async (req, reply) => {
      const { code, state } = req.query as { code: string; state: string };
      const entry = consumeState(state);

      if (!entry) {
        return reply.status(400).send({ error: "Invalid state" });
      }

      let userId: string;
      try {
        const tokens = await github.validateAuthorizationCode(code);
        const info = await fetchGitHubUser(tokens.accessToken());
        userId = await findOrCreateUser("github", info.id, info);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Login failed";
        return reply.redirect(`/login?error=${encodeURIComponent(msg)}`);
      }

      const sessionId = await createSession(userId);
      reply.setCookie("session", sessionId, {
        ...COOKIE_OPTIONS,
        maxAge: 30 * 24 * 60 * 60,
      });
      return reply.redirect("/");
    });
  }

  // Google
  if (providers.google) {
    const google = providers.google as arctic.Google;

    app.get("/auth/google/login", async (_req, reply) => {
      const state = arctic.generateState();
      const codeVerifier = arctic.generateCodeVerifier();
      const url = google.createAuthorizationURL(state, codeVerifier, [
        "openid",
        "profile",
        "email",
      ]);
      storeState(state, codeVerifier);
      return reply.redirect(url.toString());
    });

    app.get("/auth/google/callback", async (req, reply) => {
      const { code, state } = req.query as { code: string; state: string };
      const entry = consumeState(state);

      if (!entry) {
        return reply.status(400).send({ error: "Invalid state" });
      }

      let userId: string;
      try {
        const tokens = await google.validateAuthorizationCode(code, entry.codeVerifier!);
        const info = await fetchGoogleUser(tokens.idToken());
        userId = await findOrCreateUser("google", info.id, info);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Login failed";
        return reply.redirect(`/login?error=${encodeURIComponent(msg)}`);
      }

      const sessionId = await createSession(userId);
      reply.setCookie("session", sessionId, {
        ...COOKIE_OPTIONS,
        maxAge: 30 * 24 * 60 * 60,
      });
      return reply.redirect("/");
    });
  }

  // GitLab
  if (providers.gitlab) {
    const gitlab = providers.gitlab as arctic.GitLab;

    app.get("/auth/gitlab/login", async (_req, reply) => {
      const state = arctic.generateState();
      const url = gitlab.createAuthorizationURL(state, ["read_user"]);
      storeState(state);
      return reply.redirect(url.toString());
    });

    app.get("/auth/gitlab/callback", async (req, reply) => {
      const { code, state } = req.query as { code: string; state: string };
      const entry = consumeState(state);

      if (!entry) {
        return reply.status(400).send({ error: "Invalid state" });
      }

      let userId: string;
      try {
        const tokens = await gitlab.validateAuthorizationCode(code);
        const info = await fetchGitLabUser(tokens.accessToken());
        userId = await findOrCreateUser("gitlab", info.id, info);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Login failed";
        return reply.redirect(`/login?error=${encodeURIComponent(msg)}`);
      }

      const sessionId = await createSession(userId);
      reply.setCookie("session", sessionId, {
        ...COOKIE_OPTIONS,
        maxAge: 30 * 24 * 60 * 60,
      });
      return reply.redirect("/");
    });
  }

  // Logout
  app.get("/auth/logout", async (req, reply) => {
    const sessionId = (req.cookies as Record<string, string>).session;
    if (sessionId) {
      const { deleteSession } = await import("./session.js");
      await deleteSession(sessionId);
    }
    reply.clearCookie("session", COOKIE_OPTIONS);
    return reply.redirect("/");
  });

  // Current user
  app.get("/auth/me", async (req, reply) => {
    const sessionId = (req.cookies as Record<string, string>).session;
    if (!sessionId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const { validateSession } = await import("./session.js");
    const result = await validateSession(sessionId);
    if (!result) {
      reply.clearCookie("session", COOKIE_OPTIONS);
      return reply.status(401).send({ error: "Not authenticated" });
    }

    return {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      avatarUrl: result.user.avatarUrl,
    };
  });
}
