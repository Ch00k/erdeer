import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportFilename, validateAml } from "@erdeer/shared";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { generateId } from "../auth/session.js";
import { requireTokenAuth } from "../auth/token.js";
import { db } from "../db/connection.js";
import { diagrams, teamMembers, teams } from "../db/schema.js";
import { userCanEdit, userCanRead } from "../diagrams/access.js";
import { emitDiagramListChanged, emitDiagramUpdate, getAffectedUserIds } from "../events.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const amlSpecPath = resolve(__dirname, "../../../../docs/aml-spec.md");

function createMcpServer(userId: string, baseUrl: string): McpServer {
  const server = new McpServer(
    {
      name: "erdeer",
      version: "0.1.0",
    },
    {
      instructions: `Prefer the local \`erdeer\` CLI if it is on PATH over the equivalent tools here: \`erdeer validate <file>\` (faster and offline) over validate_aml, \`erdeer upload <file>\` (validates locally first) over create_diagram, \`erdeer update <diagram-id> <file>\` (validates locally first) over update_diagram, and \`erdeer export <diagram-id>\` (downloads and saves in one step) over export_diagram. For upload, update, and export, pass the same bearer token via --token or ERDEER_TOKEN and this instance's URL via --server ${baseUrl} or ERDEER_SERVER (the CLI otherwise defaults to https://erdeer.dev). Use the tools when the CLI is unavailable or the content is not in a file.`,
    },
  );

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

      if (!userCanEdit(diagram, userId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }], isError: true };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(diagram, null, 2) }],
      };
    },
  );

  // Tool: create_diagram
  server.tool(
    "create_diagram",
    "Create a new diagram with AML content. If the content is in a file and the local `erdeer` CLI is on PATH, prefer `erdeer upload <file> --token <bearer token>`, which validates locally first; use this tool when the CLI is unavailable.",
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
    "Update a diagram's title and/or AML content. If the new content is in a file and the local `erdeer` CLI is on PATH, prefer `erdeer update <diagram-id> <file> --token <bearer token>`, which validates locally first; use this tool when the CLI is unavailable.",
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

      if (!userCanEdit(diagram, userId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }], isError: true };
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (amlContent !== undefined) updates.amlContent = amlContent;

      await db.update(diagrams).set(updates).where(eq(diagrams.id, id));
      emitDiagramUpdate({ diagramId: id, sourceSessionId: null });
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

  // Tool: export_diagram
  server.tool(
    "export_diagram",
    "Export a diagram as a self-contained interactive HTML file (diagram + AML source, works offline, ~400 kB). If the local `erdeer` CLI is on PATH, prefer `erdeer export <diagram-id> --token <bearer token>`, which downloads and saves in one step. This tool returns the download URL; fetch it with the same bearer token and save the response to a file rather than reading it, e.g. `curl -H 'Authorization: Bearer erd_...' -o <filename> <url>`.",
    { id: z.string().describe("Diagram ID") },
    async ({ id }) => {
      const diagram = await db.select().from(diagrams).where(eq(diagrams.id, id)).get();

      if (!diagram) {
        return { content: [{ type: "text" as const, text: "Diagram not found" }], isError: true };
      }

      if (!userCanRead(diagram, userId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }], isError: true };
      }

      const result = {
        url: `${baseUrl}/api/diagrams/${id}/export`,
        filename: exportFilename(diagram.title),
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // Tool: validate_aml
  server.tool(
    "validate_aml",
    "Validate AML content and return any parse errors. Prefer the local `erdeer` CLI if it is on PATH (`erdeer validate <file>`), which is faster and works offline; use this tool only when the CLI is unavailable.",
    { amlContent: z.string().describe("AML content to validate") },
    async ({ amlContent }) => {
      const result = validateAml(amlContent);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: !result.valid,
      };
    },
  );

  return server;
}

export async function registerMcpRoutes(app: FastifyInstance, baseUrl: string) {
  // MCP endpoint - token auth, then handle via a stateless MCP transport: each
  // request gets its own server and transport, released when the response
  // closes, so nothing outlives the request.
  app.post("/mcp", async (req, reply) => {
    await requireTokenAuth(req, reply);
    if (reply.sent) return;

    const userId = (req as any).userId as string;
    const mcpServer = createMcpServer(userId, baseUrl);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    reply.raw.on("close", () => {
      transport.close();
      mcpServer.close();
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req.raw, reply.raw, req.body);
  });

  // A stateless server has no server-initiated SSE stream and no session to
  // terminate.
  const methodNotAllowed = async (_req: FastifyRequest, reply: FastifyReply) =>
    reply.status(405).send({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);
}
