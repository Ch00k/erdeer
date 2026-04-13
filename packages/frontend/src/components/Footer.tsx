import { useNavigate } from "react-router";
import styles from "./Footer.module.css";

export function Footer() {
  const navigate = useNavigate();

  return (
    <footer className={styles.footer}>
      <span className={styles.copyright}>&copy; {new Date().getFullYear()} ERDeer</span>
      <div className={styles.links}>
        <span>
          Powered by{" "}
          <a
            href="https://azimutt.app/docs/aml"
            className={styles.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            AML
          </a>
        </span>
        <a
          href="/schema"
          className={styles.link}
          onClick={(e) => {
            e.preventDefault();
            navigate("/schema");
          }}
        >
          ERDeer Schema
        </a>
      </div>
    </footer>
  );
}
