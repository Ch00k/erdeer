import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAml } from "@azimutt/aml";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateId } from "../auth/session.js";
import { requireTokenAuth } from "../auth/token.js";
import { cleanupOrphanedThreads } from "../comments/cleanup.js";
import { db } from "../db/connection.js";
import { diagrams, teamMembers, teams } from "../db/schema.js";
import { emitDiagramListChanged, emitDiagramUpdate, getAffectedUserIds } from "../events.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const amlSpecPath = resolve(__dirname, "../../../../docs/aml-spec.md");

const transports = new Map<string, StreamableHTTPServerTransport>();

function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: "erdeer",
    version: "0.0.1",
  });

  // Resource: AML spec
  server.resource(
    "AML Specification",
    "aml://spec",
    { description: "AML (Azimutt Markup Language) specification and syntax reference" },
    async () => ({
      contents: [
        {
          uri: "aml://spec",
          mimeType: "text/markdown",
          text: readFileSync(amlSpecPath, "utf-8"),
        },
      ],
    }),
  );

  // Tool: list_teams
  server.tool("list_teams", "List teams the authenticated user belongs to", {}, async () => {
    const result = await db
      .select({
        id: teams.id,
        name: teams.name,
        createdAt: teams.createdAt,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId))
      .all();

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  });

  // Tool: list_diagrams
  server.tool(
    "list_diagrams",
    "List diagrams accessible to the authenticated user (personal and team)",
    {},
    async () => {
      const personal = await db
        .select()
        .from(diagrams)
        .where(and(eq(diagrams.ownerUserId, userId), isNull(diagrams.teamId)))
        .all();

      const memberships = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId))
        .all();

      const teamIds = memberships.map((m) => m.teamId);
      const teamDiagrams =
        teamIds.length > 0
          ? (await db.select().from(diagrams).where(isNotNull(diagrams.teamId)).all()).filter(
              (d) => d.teamId && teamIds.includes(d.teamId),
            )
          : [];

      const all = [...personal, ...teamDiagrams].map((d) => ({
        id: d.id,
        title: d.title,
        teamId: d.teamId,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(all, null, 2) }],
      };
    },
  );

  // Tool: get_diagram
  server.tool(
    "get_diagram",
    "Get a diagram by ID, including its AML content",
    { id: z.string().describe("Diagram ID") },
    async ({ id }) => {
      const diagram = await db.select().from(diagrams).where(eq(diagrams.id, id)).get();

      if (!diagram) {
        return { content: [{ type: "text" as const, text: "Diagram not found" }], isError: true };
      }

      if (diagram.ownerUserId !== userId) {
        if (diagram.teamId) {
          const membership = await db
            .select()
            .from(teamMembers)
            .where(and(eq(teamMembers.teamId, diagram.teamId), eq(teamMembers.userId, userId)))
            .get();
          if (!membership) {
            return { content: [{ type: "text" as const, text: "Access denied" }], isError: true };
          }
        } else {
          return { content: [{ type: "text" as const, text: "Access denied" }], isError: true };
        }
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(diagram, null, 2) }],
      };
    },
  );

  // Tool: create_diagram
  server.tool(
    "create_diagram",
    "Create a new diagram with AML content",
    {
      title: z.string().describe("Diagram title"),
      amlContent: z.string().describe("AML schema content"),
      teamId: z.string().optional().describe("Team ID (omit for personal diagram)"),
    },
    async ({ title, amlContent, teamId }) => {
      const id = generateId();
      const now = new Date();
      await db.insert(diagrams).values({
        id,
        title,
        amlContent,
        ownerUserId: userId,
        teamId: teamId ?? null,
        createdAt: now,
        updatedAt: now,
      });

      const diagram = await db.select().from(diagrams).where(eq(diagrams.id, id)).get();
      const affectedUsers = await getAffectedUserIds(userId, teamId ?? null);
      for (const uid of affectedUsers) {
        emitDiagramListChanged(uid, { sourceSessionId: null });
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(diagram, null, 2) }],
      };
    },
  );

  // Tool: update_diagram
  server.tool(
    "update_diagram",
    "Update a diagram's title and/or AML content",
    {
      id: z.string().describe("Diagram ID"),
      title: z.string().optional().describe("New title"),
      amlContent: z.string().optional().describe("New AML content"),
    },
    async ({ id, title, amlContent }) => {
      const diagram = await db.select().from(diagrams).where(eq(diagrams.id, id)).get();

      if (!diagram) {
        return { content: [{ type: "text" as const, text: "Diagram not found" }], isError: true };
      }

      if (diagram.ownerUserId !== userId) {
        if (diagram.teamId) {
          const membership = await db
            .select()
            .from(teamMembers)
            .where(and(eq(teamMembers.teamId, diagram.teamId), eq(teamMembers.userId, userId)))
            .get();
          if (!membership) {
            return { content: [{ type: "text" as const, text: "Access denied" }], isError: true };
          }
        } else {
          return { content: [{ type: "text" as const, text: "Access denied" }], isError: true };
        }
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (amlContent !== undefined) updates.amlContent = amlContent;

      await db.update(diagrams).set(updates).where(eq(diagrams.id, id));
      emitDiagramUpdate({ diagramId: id, sourceSessionId: null });
      if (amlContent !== undefined) {
        setTimeout(() => cleanupOrphanedThreads(id, amlContent), 0);
      }
      const updated = await db.select().from(diagrams).where(eq(diagrams.id, id)).get();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }],
      };
    },
  );

  // Tool: delete_diagram
  server.tool(
    "delete_diagram",
    "Delete a diagram (owner only)",
    { id: z.string().describe("Diagram ID") },
    async ({ id }) => {
      const diagram = await db.select().from(diagrams).where(eq(diagrams.id, id)).get();

      if (!diagram) {
        return { content: [{ type: "text" as const, text: "Diagram not found" }], isError: true };
      }

      if (diagram.ownerUserId !== userId) {
        return {
          content: [{ type: "text" as const, text: "Only the owner can delete a diagram" }],
          isError: true,
        };
      }

      const affectedUsers = await getAffectedUserIds(userId, diagram.teamId);
      await db.delete(diagrams).where(eq(diagrams.id, id));
      for (const uid of affectedUsers) {
        emitDiagramListChanged(uid, { sourceSessionId: null });
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }],
      };
    },
  );

  // Tool: validate_aml
  server.tool(
    "validate_aml",
    "Validate AML content and return any parse errors",
    { amlContent: z.string().describe("AML content to validate") },
    async ({ amlContent }) => {
      const result = parseAml(amlContent);

      if (result.errors && result.errors.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  valid: false,
                  errors: result.errors.map((e: any) => ({
                    message: e.message,
                    position: e.position,
                  })),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      const entityCount = result.result?.entities?.length ?? 0;
      const relationCount = result.result?.relations?.length ?? 0;
      const typeCount = result.result?.types?.length ?? 0;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                valid: true,
                entities: entityCount,
                relations: relationCount,
                types: typeCount,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  return server;
}

export async function registerMcpRoutes(app: FastifyInstance) {
  // MCP endpoint - token auth, then handle via MCP transport
  app.post("/mcp", async (req, reply) => {
    // Authenticate
    await requireTokenAuth(req, reply);
    if (reply.sent) return;

    const userId = (req as any).userId as string;
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
        }
      };

      const mcpServer = createMcpServer(userId);
      await mcpServer.connect(transport);
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } else {
      reply.status(400).send({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID" },
        id: null,
      });
    }
  });

  // Handle GET for SSE streams
  app.get("/mcp", async (req, reply) => {
    await requireTokenAuth(req, reply);
    if (reply.sent) return;

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req.raw, reply.raw);
    } else {
      reply.status(400).send({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID" },
        id: null,
      });
    }
  });

  // Handle DELETE for session cleanup
  app.delete("/mcp", async (req, reply) => {
    await requireTokenAuth(req, reply);
    if (reply.sent) return;

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req.raw, reply.raw);
    } else {
      reply.status(400).send({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID" },
        id: null,
      });
    }
  });
}
