import { useCallback, useEffect, useState } from "react";
import {
  addTeamMember,
  createTeam,
  fetchTeamMembers,
  fetchTeams,
  fetchUsers,
  removeTeamMember,
  type Team,
  type TeamMember,
  type UserSummary,
} from "../api.js";
import { useAuth } from "../auth.js";
import { Footer } from "../components/Footer.js";
import { Navbar } from "../components/Navbar.js";
import styles from "./TeamsPage.module.css";

export function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState("");

  const loadTeams = useCallback(async () => {
    const result = await fetchTeams();
    setTeams(result);
  }, []);

  useEffect(() => {
    loadTeams();
    fetchUsers().then(setAllUsers);
  }, [loadTeams]);

  const loadMembers = useCallback(async (teamId: string) => {
    const result = await fetchTeamMembers(teamId);
    setMembers(result);
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      loadMembers(selectedTeamId);
    } else {
      setMembers([]);
    }
  }, [selectedTeamId, loadMembers]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const team = await createTeam(newTeamName.trim());
    setNewTeamName("");
    await loadTeams();
    setSelectedTeamId(team.id);
  };

  const handleAddMember = async () => {
    if (!selectedTeamId || !selectedUserId) return;
    setError("");
    try {
      await addTeamMember(selectedTeamId, selectedUserId);
      setSelectedUserId("");
      loadMembers(selectedTeamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeamId) return;
    await removeTeamMember(selectedTeamId, memberId);
    loadMembers(selectedTeamId);
  };

  const selectedTeam = teams.find((t) => t.teamId === selectedTeamId);
  const memberIds = new Set(members.map((m) => m.userId));
  const availableUsers = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <div className={styles.container}>
      <Navbar />

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <h2 className={styles.sectionTitle}>Your teams</h2>
          <div className={styles.teamList}>
            {teams.map((t) => (
              <button
                key={t.teamId}
                className={`${styles.teamItem} ${t.teamId === selectedTeamId ? styles.teamItemActive : ""}`}
                onClick={() => setSelectedTeamId(t.teamId)}
              >
                <span className={styles.teamName}>{t.teamName}</span>
              </button>
            ))}
          </div>
          <form onSubmit={handleCreateTeam} className={styles.createForm}>
            <input
              className={styles.input}
              placeholder="New team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
            />
            <button type="submit" className={styles.createButton}>
              Create
            </button>
          </form>
        </div>

        <div className={styles.main}>
          {selectedTeam ? (
            <>
              <h2 className={styles.sectionTitle}>{selectedTeam.teamName}</h2>
              <div className={styles.memberList}>
                {members.map((m) => (
                  <div key={m.userId} className={styles.memberItem}>
                    <div>
                      <span className={styles.memberName}>{m.name}</span>
                      <span className={styles.memberEmail}>{m.email}</span>
                    </div>
                    {m.userId !== user?.id && (
                      <button
                        className={styles.removeButton}
                        onClick={() => handleRemoveMember(m.userId)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {availableUsers.length > 0 && (
                <div className={styles.addForm}>
                  <select
                    className={styles.select}
                    value={selectedUserId}
                    onChange={(e) => {
                      setSelectedUserId(e.target.value);
                      setError("");
                    }}
                  >
                    <option value="">Select a user</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <button
                    className={styles.addButton}
                    onClick={handleAddMember}
                    disabled={!selectedUserId}
                  >
                    Add member
                  </button>
                </div>
              )}
              {error && <p className={styles.error}>{error}</p>}
            </>
          ) : (
            <p className={styles.placeholder}>
              {teams.length === 0
                ? "Create a team to get started."
                : "Select a team to manage members."}
            </p>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
