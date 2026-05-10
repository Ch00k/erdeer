import { useCallback, useEffect, useState } from "react";
import {
  acceptInvitation,
  cancelInvitation,
  createInvitation,
  createTeam,
  declineInvitation,
  fetchMyInvitations,
  fetchTeamInvitations,
  fetchTeamMembers,
  fetchTeams,
  type PendingInvitation,
  removeTeamMember,
  type Team,
  type TeamInvitation,
  type TeamMember,
} from "../api.js";
import { useAuth } from "../auth.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { Footer } from "../components/Footer.js";
import { Navbar } from "../components/Navbar.js";
import styles from "./TeamsPage.module.css";

type ConfirmAction =
  | { type: "removeMember"; memberId: string; memberName: string }
  | { type: "cancelInvitation"; invitationId: string; email: string }
  | { type: "declineInvitation"; invitationId: string; teamName: string }
  | { type: "leaveTeam"; teamName: string };

export function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [pendingInvitations, setPendingInvitations] = useState<TeamInvitation[]>([]);
  const [myInvitations, setMyInvitations] = useState<PendingInvitation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const loadTeams = useCallback(async () => {
    const result = await fetchTeams();
    setTeams(result);
  }, []);

  const loadMyInvitations = useCallback(async () => {
    const result = await fetchMyInvitations();
    setMyInvitations(result);
  }, []);

  useEffect(() => {
    Promise.all([loadTeams(), loadMyInvitations()]).finally(() => setLoading(false));
  }, [loadTeams, loadMyInvitations]);

  const loadMembers = useCallback(async (teamId: string) => {
    const result = await fetchTeamMembers(teamId);
    setMembers(result);
  }, []);

  const loadPendingInvitations = useCallback(async (teamId: string) => {
    try {
      const result = await fetchTeamInvitations(teamId);
      setPendingInvitations(result);
    } catch {
      setPendingInvitations([]);
    }
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      loadMembers(selectedTeamId);
      loadPendingInvitations(selectedTeamId);
    } else {
      setMembers([]);
      setPendingInvitations([]);
    }
  }, [selectedTeamId, loadMembers, loadPendingInvitations]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const team = await createTeam(newTeamName.trim());
    setNewTeamName("");
    await loadTeams();
    setSelectedTeamId(team.id);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId || !inviteEmail.trim()) return;
    setError("");
    try {
      await createInvitation(selectedTeamId, inviteEmail.trim());
      setInviteEmail("");
      loadPendingInvitations(selectedTeamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    }
  };

  const handleAcceptInvitation = async (id: string) => {
    await acceptInvitation(id);
    loadMyInvitations();
    loadTeams();
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    switch (action.type) {
      case "removeMember":
        if (!selectedTeamId) return;
        await removeTeamMember(selectedTeamId, action.memberId);
        loadMembers(selectedTeamId);
        break;
      case "cancelInvitation":
        if (!selectedTeamId) return;
        await cancelInvitation(selectedTeamId, action.invitationId);
        loadPendingInvitations(selectedTeamId);
        break;
      case "declineInvitation":
        await declineInvitation(action.invitationId);
        loadMyInvitations();
        break;
      case "leaveTeam":
        if (!selectedTeamId || !user) return;
        await removeTeamMember(selectedTeamId, user.id);
        setSelectedTeamId(null);
        loadTeams();
        break;
    }
  };

  const toggleSelected = (teamId: string) => {
    setSelectedTeamId((prev) => (prev === teamId ? null : teamId));
    setError("");
    setInviteEmail("");
  };

  const selectedTeam = teams.find((t) => t.teamId === selectedTeamId);
  const currentMember = members.find((m) => m.userId === user?.id);
  const isOwner = currentMember?.role === "owner";

  const confirmCopy = ((): {
    title: string;
    message: string;
    confirmLabel: string;
    variant?: "danger";
  } | null => {
    if (!confirmAction) return null;
    switch (confirmAction.type) {
      case "removeMember":
        return {
          title: "Remove member",
          message: `Remove ${confirmAction.memberName} from this team? They will lose access to all team diagrams.`,
          confirmLabel: "Remove",
          variant: "danger",
        };
      case "cancelInvitation":
        return {
          title: "Cancel invitation",
          message: `Cancel the pending invitation to ${confirmAction.email}?`,
          confirmLabel: "Cancel invitation",
        };
      case "declineInvitation":
        return {
          title: "Decline invitation",
          message: `Decline the invitation to join ${confirmAction.teamName}?`,
          confirmLabel: "Decline",
        };
      case "leaveTeam":
        return {
          title: "Leave team",
          message: `Leave ${confirmAction.teamName}? You will lose access to all team diagrams.`,
          confirmLabel: "Leave",
          variant: "danger",
        };
    }
  })();

  return (
    <div className={styles.container}>
      <Navbar />

      <div className={styles.content}>
        <h2 className={styles.heading}>Teams</h2>
        <p className={styles.description}>
          Share diagrams with collaborators by adding them to a team.
        </p>

        {myInvitations.length > 0 && (
          <div className={styles.invitationSection}>
            <h3 className={styles.subheading}>Invitations</h3>
            {myInvitations.map((inv) => (
              <div key={inv.id} className={styles.invitationItem}>
                <span>
                  <strong>{inv.teamName}</strong> — invited by {inv.inviterName}
                </span>
                <div className={styles.invitationActions}>
                  <button
                    className={styles.acceptButton}
                    onClick={() => handleAcceptInvitation(inv.id)}
                  >
                    Accept
                  </button>
                  <button
                    className={styles.outlineButton}
                    onClick={() =>
                      setConfirmAction({
                        type: "declineInvitation",
                        invitationId: inv.id,
                        teamName: inv.teamName,
                      })
                    }
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleCreateTeam} className={styles.createForm}>
          <input
            className={styles.input}
            placeholder="Team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button type="submit" className={styles.primaryButton} disabled={!newTeamName.trim()}>
            Create team
          </button>
        </form>

        {loading ? (
          <p className={styles.loading}>Loading...</p>
        ) : teams.length === 0 ? (
          <p className={styles.empty}>No teams yet.</p>
        ) : (
          <div className={styles.teamList}>
            {teams.map((t) => {
              const isSelected = t.teamId === selectedTeamId;
              return (
                <div key={t.teamId}>
                  <button
                    type="button"
                    className={`${styles.teamItem} ${isSelected ? styles.teamItemActive : ""}`}
                    onClick={() => toggleSelected(t.teamId)}
                  >
                    <span className={styles.teamItemMain}>
                      <span className={styles.teamName}>{t.teamName}</span>
                    </span>
                    <svg
                      className={`${styles.chevron} ${isSelected ? styles.chevronOpen : ""}`}
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        d="M5 3l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {isSelected && selectedTeam && (
                    <div className={styles.detail}>
                      <h3 className={styles.subheading}>Members</h3>
                      <div className={styles.memberList}>
                        {members.map((m) => (
                          <div key={m.userId} className={styles.memberItem}>
                            <div>
                              <span className={styles.memberName}>{m.name}</span>
                              <span className={styles.memberEmail}>{m.email}</span>
                              <span className={styles.roleBadge}>{m.role}</span>
                            </div>
                            {isOwner && m.userId !== user?.id && (
                              <button
                                className={styles.outlineButton}
                                onClick={() =>
                                  setConfirmAction({
                                    type: "removeMember",
                                    memberId: m.userId,
                                    memberName: m.name,
                                  })
                                }
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {isOwner && (
                        <>
                          <form className={styles.addForm} onSubmit={handleInvite}>
                            <input
                              className={styles.input}
                              placeholder="Invite by email"
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => {
                                setInviteEmail(e.target.value);
                                setError("");
                              }}
                            />
                            <button
                              type="submit"
                              className={styles.primaryButton}
                              disabled={!inviteEmail.trim()}
                            >
                              Invite
                            </button>
                          </form>
                          {error && <p className={styles.error}>{error}</p>}
                          {pendingInvitations.length > 0 && (
                            <div className={styles.pendingList}>
                              {pendingInvitations.map((inv) => (
                                <div key={inv.id} className={styles.pendingItem}>
                                  <span>{inv.invitedEmail}</span>
                                  <button
                                    className={styles.outlineButton}
                                    onClick={() =>
                                      setConfirmAction({
                                        type: "cancelInvitation",
                                        invitationId: inv.id,
                                        email: inv.invitedEmail,
                                      })
                                    }
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {currentMember && !isOwner && (
                        <div className={styles.detailFooter}>
                          <button
                            className={styles.leaveButton}
                            onClick={() =>
                              setConfirmAction({
                                type: "leaveTeam",
                                teamName: selectedTeam.teamName,
                              })
                            }
                          >
                            Leave team
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmCopy}
        title={confirmCopy?.title ?? ""}
        message={confirmCopy?.message ?? ""}
        confirmLabel={confirmCopy?.confirmLabel}
        variant={confirmCopy?.variant}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <Footer />
    </div>
  );
}
