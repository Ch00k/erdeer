import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  createDiagram,
  type Diagram,
  deleteDiagram,
  fetchPersonalDiagrams,
  fetchTeamDiagrams,
  fetchTeams,
  type Team,
} from "../api.js";
import { useAuth } from "../auth.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { Footer } from "../components/Footer.js";
import { Navbar } from "../components/Navbar.js";
import styles from "./DashboardPage.module.css";

type Tab = "personal" | "team";

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("personal");
  const [personalDiagrams, setPersonalDiagrams] = useState<Diagram[]>([]);
  const [teamDiagrams, setTeamDiagrams] = useState<Diagram[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [personal, team, userTeams] = await Promise.all([
      fetchPersonalDiagrams(),
      fetchTeamDiagrams(),
      fetchTeams(),
    ]);
    setPersonalDiagrams(personal);
    setTeamDiagrams(team);
    setTeams(userTeams);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to server-sent events for external changes (e.g. MCP create/delete)
  useEffect(() => {
    const eventSource = new EventSource("/api/diagrams/events");
    let sessionId: string | null = null;

    eventSource.addEventListener("connected", (e) => {
      sessionId = JSON.parse(e.data).sessionId;
    });

    eventSource.addEventListener("changed", (e) => {
      const { sourceSessionId } = JSON.parse(e.data);
      if (sourceSessionId === sessionId) return;
      loadData();
    });

    return () => eventSource.close();
  }, [loadData]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleCreate = async (teamId?: string) => {
    setMenuOpen(false);
    const diagram = await createDiagram({ title: "Untitled", teamId });
    navigate(`/diagrams/${diagram.id}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDiagram(deleteTarget);
    setDeleteTarget(null);
    loadData();
  };

  const diagrams = tab === "personal" ? personalDiagrams : teamDiagrams;

  return (
    <div className={styles.container}>
      <Navbar />

      <div className={styles.content}>
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === "personal" ? styles.tabActive : ""}`}
              onClick={() => setTab("personal")}
            >
              Personal
            </button>
            <button
              className={`${styles.tab} ${tab === "team" ? styles.tabActive : ""}`}
              onClick={() => setTab("team")}
            >
              Team
            </button>
          </div>
          <div className={styles.createWrapper} ref={menuRef}>
            {teams.length === 0 ? (
              <button className={styles.createButton} onClick={() => handleCreate()}>
                New diagram
              </button>
            ) : (
              <>
                <button className={styles.createButton} onClick={() => setMenuOpen(!menuOpen)}>
                  New diagram
                </button>
                {menuOpen && (
                  <div className={styles.createMenu}>
                    <button className={styles.menuItem} onClick={() => handleCreate()}>
                      Personal
                    </button>
                    {teams.map((t) => (
                      <button
                        key={t.teamId}
                        className={styles.menuItem}
                        onClick={() => handleCreate(t.teamId)}
                      >
                        {t.teamName}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {loading ? (
          <p className={styles.empty}>Loading...</p>
        ) : diagrams.length === 0 ? (
          <p className={styles.empty}>
            {tab === "personal" ? "No personal diagrams yet." : "No team diagrams."}
          </p>
        ) : (
          <div className={styles.grid}>
            {diagrams.map((d) => (
              <div key={d.id} className={styles.card} onClick={() => navigate(`/diagrams/${d.id}`)}>
                <div className={styles.cardTitle}>{d.title}</div>
                <div className={styles.cardMeta}>
                  Updated {new Date(d.updatedAt).toLocaleDateString()}
                </div>
                {d.ownerUserId === user?.id && (
                  <button
                    className={styles.deleteButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(d.id);
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete diagram"
        message="Are you sure you want to delete this diagram? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
