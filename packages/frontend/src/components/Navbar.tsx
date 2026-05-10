import { type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { deleteAccount } from "../api.js";
import { useAuth } from "../auth.js";
import { useTheme } from "../theme.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import styles from "./Navbar.module.css";

interface NavbarProps {
  center?: ReactNode;
}

export function Navbar({ center }: NavbarProps) {
  const { user } = useAuth();
  const { resolvedTheme, toggle } = useTheme();
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
          <button
            className={styles.themeToggle}
            onClick={toggle}
            title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolvedTheme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
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
