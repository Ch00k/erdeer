import { EventEmitter } from "node:events";
import { eq } from "drizzle-orm";
import { db } from "./db/connection.js";
import { teamMembers } from "./db/schema.js";

export interface DiagramUpdateEvent {
  diagramId: string;
  sourceSessionId: string | null;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function emitDiagramUpdate(event: DiagramUpdateEvent) {
  emitter.emit(`diagram:${event.diagramId}`, event);
}

export function onDiagramUpdate(
  diagramId: string,
  listener: (event: DiagramUpdateEvent) => void,
): () => void {
  const eventName = `diagram:${diagramId}`;
  emitter.on(eventName, listener);
  return () => emitter.off(eventName, listener);
}

export async function getAffectedUserIds(
  ownerUserId: string,
  teamId: string | null,
): Promise<string[]> {
  if (!teamId) return [ownerUserId];
  const members = db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
    .all();
  const userIds = members.map((m) => m.userId);
  if (!userIds.includes(ownerUserId)) userIds.push(ownerUserId);
  return userIds;
}

export interface DiagramListEvent {
  sourceSessionId: string | null;
}

export function emitDiagramListChanged(userId: string, event: DiagramListEvent) {
  emitter.emit(`diagrams:${userId}`, event);
}

export function onDiagramListChanged(
  userId: string,
  listener: (event: DiagramListEvent) => void,
): () => void {
  const eventName = `diagrams:${userId}`;
  emitter.on(eventName, listener);
  return () => emitter.off(eventName, listener);
}

export interface CommentEvent {
  diagramId: string;
  sourceSessionId: string | null;
  type:
    | "thread:created"
    | "thread:resolved"
    | "thread:unresolved"
    | "thread:deleted"
    | "comment:created"
    | "comment:updated"
    | "comment:deleted";
  payload: Record<string, unknown>;
}

export function emitCommentEvent(event: CommentEvent) {
  emitter.emit(`diagram:${event.diagramId}:comments`, event);
}

export function onCommentEvent(
  diagramId: string,
  listener: (event: CommentEvent) => void,
): () => void {
  const eventName = `diagram:${diagramId}:comments`;
  emitter.on(eventName, listener);
  return () => emitter.off(eventName, listener);
}
