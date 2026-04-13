import { type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { deleteAccount } from "../api.js";
import { useAuth } from "../auth.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import styles from "./Navbar.module.css";

interface NavbarProps {
  center?: ReactNode;
}

export function Navbar({ center }: NavbarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"signOut" | "deleteAccount" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleSignOut = () => {
    setMenuOpen(false);
    setConfirmAction("signOut");
  };

  const handleDeleteAccount = () => {
    setMenuOpen(false);
    setConfirmAction("deleteAccount");
  };

  const confirmSignOut = () => {
    setConfirmAction(null);
    window.location.href = "/auth/logout";
  };

  const confirmDeleteAccount = async () => {
    setConfirmAction(null);
    await deleteAccount();
    window.location.href = "/login";
  };

  return (
    <>
      <header className={styles.header}>
        <a
          href="/"
          className={styles.title}
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          ERDeer
        </a>
        {center && <div className={styles.center}>{center}</div>}
        <div className={styles.right}>
          {user ? (
            <div className={styles.userMenu} ref={menuRef}>
              <button className={styles.userButton} onClick={() => setMenuOpen(!menuOpen)}>
                {user.name}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className={styles.chevron}
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {menuOpen && (
                <div className={styles.menu}>
                  <button
                    className={styles.menuItem}
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/teams");
                    }}
                  >
                    Teams
                  </button>
                  <button
                    className={styles.menuItem}
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/tokens");
                    }}
                  >
                    API Tokens
                  </button>
                  <div className={styles.menuDivider} />
                  <button className={styles.menuItem} onClick={handleSignOut}>
                    Sign out
                  </button>
                  <button
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={handleDeleteAccount}
                  >
                    Delete account
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a href="/login" className={styles.signInLink}>
              Sign in
            </a>
          )}
        </div>
      </header>

      <ConfirmDialog
        open={confirmAction === "signOut"}
        title="Sign out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        onConfirm={confirmSignOut}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction === "deleteAccount"}
        title="Delete account"
        message="This will permanently delete your account and all your diagrams. This action cannot be undone."
        confirmLabel="Delete account"
        variant="danger"
        onConfirm={confirmDeleteAccount}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
