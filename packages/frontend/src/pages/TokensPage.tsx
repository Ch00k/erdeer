import { useCallback, useEffect, useState } from "react";
import { type ApiToken, createToken, fetchTokens, revokeToken } from "../api.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { Footer } from "../components/Footer.js";
import { Navbar } from "../components/Navbar.js";
import styles from "./TokensPage.module.css";

export function TokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTokens = useCallback(async () => {
    const result = await fetchTokens();
    setTokens(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await createToken(name.trim());
    setName("");
    setNewToken(result.token);
    loadTokens();
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    await revokeToken(revokeTarget);
    setRevokeTarget(null);
    loadTokens();
  };

  return (
    <div className={styles.container}>
      <Navbar />

      <div className={styles.content}>
        <h2 className={styles.heading}>API Tokens</h2>
        <p className={styles.description}>
          Tokens are used to authenticate with the API and MCP server.
        </p>

        <form onSubmit={handleCreate} className={styles.createForm}>
          <input
            className={styles.input}
            placeholder="Token name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className={styles.createButton}>
            Create token
          </button>
        </form>

        {newToken && (
          <div className={styles.newToken}>
            <p className={styles.newTokenLabel}>Copy this token now. It will not be shown again.</p>
            <code className={styles.tokenValue}>{newToken}</code>
            <button className={styles.dismissButton} onClick={() => setNewToken(null)}>
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <p className={styles.empty}>Loading...</p>
        ) : tokens.length === 0 ? (
          <p className={styles.empty}>No tokens yet.</p>
        ) : (
          <div className={styles.tokenList}>
            {tokens.map((t) => (
              <div key={t.id} className={styles.tokenItem}>
                <div>
                  <span className={styles.tokenName}>{t.name}</span>
                  <span className={styles.tokenMeta}>
                    Created {new Date(t.createdAt).toLocaleDateString()}
                    {t.lastUsedAt &&
                      ` \u00b7 Last used ${new Date(t.lastUsedAt).toLocaleDateString()}`}
                  </span>
                </div>
                <button className={styles.revokeButton} onClick={() => setRevokeTarget(t.id)}>
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />

      <ConfirmDialog
        open={revokeTarget !== null}
        title="Revoke token"
        message="This token will stop working immediately. Any integrations using it will lose access."
        confirmLabel="Revoke"
        variant="danger"
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}
