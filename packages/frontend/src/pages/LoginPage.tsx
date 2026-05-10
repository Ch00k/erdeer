import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { fetchProviders, type Providers } from "../api.js";
import { Footer } from "../components/Footer.js";
import { Navbar } from "../components/Navbar.js";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");
  const [providers, setProviders] = useState<Providers | null>(null);

  useEffect(() => {
    fetchProviders().then(setProviders);
  }, []);

  return (
    <div className={styles.layout}>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>ERDeer</h1>
          <p className={styles.subtitle}>Sign in to get started</p>
          {error && <p className={styles.error}>{error}</p>}
          {providers && (
            <div className={styles.buttons}>
              {providers.github && (
                <a href="/auth/github/login" className={styles.button}>
                  Sign in with GitHub
                </a>
              )}
              {providers.google && (
                <a href="/auth/google/login" className={styles.button}>
                  Sign in with Google
                </a>
              )}
              {providers.gitlab && (
                <a href="/auth/gitlab/login" className={styles.button}>
                  Sign in with GitLab
                </a>
              )}
            </div>
          )}
          <div className={styles.divider}>or</div>
          <a href="/sandbox" className={styles.sandboxLink}>
            Try without an account
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
