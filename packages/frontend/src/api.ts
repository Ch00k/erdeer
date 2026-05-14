export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export type Visibility = "private" | "public";

export interface Diagram {
  id: string;
  title: string;
  amlContent: string;
  layout: string;
  ownerUserId: string;
  teamId: string | null;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramView extends Diagram {
  canEdit: boolean;
  teamName: string | null;
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

export async function fetchDiagram(id: string): Promise<DiagramView> {
  return request<DiagramView>(`/api/diagrams/${id}`);
}

export async function createDiagram(data: {
  title: string;
  amlContent?: string;
  layout?: string;
  teamId?: string;
}): Promise<Diagram> {
  return request<Diagram>("/api/diagrams", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDiagram(
  id: string,
  data: { title?: string; amlContent?: string; layout?: string; visibility?: Visibility },
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
  role: "owner" | "member";
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

export async function searchUsers(
  query: string,
): Promise<{ id: string; email: string; name: string }[]> {
  return request(`/api/users/search?email=${encodeURIComponent(query)}`);
}

export async function removeTeamMember(teamId: string, memberId: string): Promise<void> {
  await request(`/api/teams/${teamId}/members/${memberId}`, {
    method: "DELETE",
  });
}

// Team invitations

export interface TeamInvitation {
  id: string;
  invitedEmail: string;
  invitedBy: string;
  status: string;
  createdAt: string;
}

export interface PendingInvitation {
  id: string;
  teamId: string;
  teamName: string;
  invitedBy: string;
  inviterName: string;
  createdAt: string;
}

export async function createInvitation(teamId: string, email: string): Promise<TeamInvitation> {
  return request(`/api/teams/${teamId}/invitations`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function fetchTeamInvitations(teamId: string): Promise<TeamInvitation[]> {
  return request(`/api/teams/${teamId}/invitations`);
}

export async function cancelInvitation(teamId: string, id: string): Promise<void> {
  await request(`/api/teams/${teamId}/invitations/${id}`, { method: "DELETE" });
}

export async function fetchMyInvitations(): Promise<PendingInvitation[]> {
  return request("/api/invitations");
}

export async function acceptInvitation(id: string): Promise<void> {
  await request(`/api/invitations/${id}/accept`, { method: "POST" });
}

export async function declineInvitation(id: string): Promise<void> {
  await request(`/api/invitations/${id}/decline`, { method: "POST" });
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
