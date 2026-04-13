import { useNavigate } from "react-router";
import styles from "./Footer.module.css";

export function Footer() {
  const navigate = useNavigate();

  return (
    <footer className={styles.footer}>
      <span className={styles.copyright}>&copy; {new Date().getFullYear()} ERDeer</span>
      <a
        href="/schema"
        className={styles.link}
        onClick={(e) => {
          e.preventDefault();
          navigate("/schema");
        }}
      >
        Schema
      </a>
    </footer>
  );
}
