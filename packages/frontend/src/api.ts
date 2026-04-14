import type { CommentThread, ThreadComment } from "./types.js";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface Diagram {
  id: string;
  title: string;
  amlContent: string;
  layout: string;
  ownerUserId: string;
  teamId: string | null;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(options?.headers as Record<string, string>) };
  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, {
    ...options,
    headers,
  });
  if (!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export interface Providers {
  github: boolean;
  google: boolean;
  gitlab: boolean;
}

export async function fetchProviders(): Promise<Providers> {
  return request<Providers>("/auth/providers");
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return await request<User>("/auth/me");
  } catch {
    return null;
  }
}

export async function fetchPersonalDiagrams(): Promise<Diagram[]> {
  return request<Diagram[]>("/api/diagrams/personal");
}

export async function fetchTeamDiagrams(): Promise<Diagram[]> {
  return request<Diagram[]>("/api/diagrams/team");
}

export async function fetchDiagram(id: string): Promise<Diagram> {
  return request<Diagram>(`/api/diagrams/${id}`);
}

export async function createDiagram(data: {
  title: string;
  amlContent?: string;
  teamId?: string;
}): Promise<Diagram> {
  return request<Diagram>("/api/diagrams", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDiagram(
  id: string,
  data: { title?: string; amlContent?: string; layout?: string },
): Promise<Diagram> {
  return request<Diagram>(`/api/diagrams/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteDiagram(id: string): Promise<void> {
  await request(`/api/diagrams/${id}`, { method: "DELETE" });
}

export async function deleteAccount(): Promise<void> {
  await request("/api/users/me", { method: "DELETE" });
}

// Teams

export interface Team {
  teamId: string;
  teamName: string;
  createdAt: string;
}

export interface TeamMember {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export async function fetchTeams(): Promise<Team[]> {
  return request<Team[]>("/api/teams");
}

export async function createTeam(name: string): Promise<{ id: string; name: string }> {
  return request("/api/teams", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  return request<TeamMember[]>(`/api/teams/${teamId}/members`);
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
}

export async function fetchUsers(): Promise<UserSummary[]> {
  return request<UserSummary[]>("/api/users");
}

export async function addTeamMember(teamId: string, userId: string): Promise<void> {
  await request(`/api/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function removeTeamMember(teamId: string, memberId: string): Promise<void> {
  await request(`/api/teams/${teamId}/members/${memberId}`, {
    method: "DELETE",
  });
}

// API Tokens

export interface ApiToken {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreatedToken {
  id: string;
  name: string;
  token: string;
}

export async function fetchTokens(): Promise<ApiToken[]> {
  return request<ApiToken[]>("/api/tokens");
}

export async function createToken(name: string): Promise<CreatedToken> {
  return request<CreatedToken>("/api/tokens", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function revokeToken(id: string): Promise<void> {
  await request(`/api/tokens/${id}`, { method: "DELETE" });
}

// Comment Threads

export async function fetchThreads(diagramId: string): Promise<CommentThread[]> {
  return request<CommentThread[]>(`/api/diagrams/${diagramId}/threads`);
}

export async function createThread(
  diagramId: string,
  data: {
    anchorType: "diagram" | "entity" | "column";
    anchorEntity?: string;
    anchorColumn?: string;
    body: string;
  },
): Promise<CommentThread> {
  return request<CommentThread>(`/api/diagrams/${diagramId}/threads`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function resolveThread(
  diagramId: string,
  threadId: string,
  resolved: boolean,
): Promise<CommentThread> {
  return request<CommentThread>(`/api/diagrams/${diagramId}/threads/${threadId}`, {
    method: "PATCH",
    body: JSON.stringify({ resolved }),
  });
}

export async function deleteThread(diagramId: string, threadId: string): Promise<void> {
  await request(`/api/diagrams/${diagramId}/threads/${threadId}`, { method: "DELETE" });
}

export async function addComment(
  diagramId: string,
  threadId: string,
  body: string,
): Promise<ThreadComment> {
  return request<ThreadComment>(`/api/diagrams/${diagramId}/threads/${threadId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function editComment(
  diagramId: string,
  threadId: string,
  commentId: string,
  body: string,
): Promise<ThreadComment> {
  return request<ThreadComment>(
    `/api/diagrams/${diagramId}/threads/${threadId}/comments/${commentId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ body }),
    },
  );
}

export async function deleteComment(
  diagramId: string,
  threadId: string,
  commentId: string,
): Promise<void> {
  await request(`/api/diagrams/${diagramId}/threads/${threadId}/comments/${commentId}`, {
    method: "DELETE",
  });
}
