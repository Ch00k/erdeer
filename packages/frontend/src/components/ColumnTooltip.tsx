import type { Column } from "../types.js";
import styles from "./ColumnTooltip.module.css";

interface ColumnTooltipProps {
  column: Column;
  side: "left" | "right";
}

function formatConstraint(name: string | undefined, columns: string[]): string {
  if (columns.length <= 1) return name ?? "";
  const formatted = columns.join(", ");
  return name ? `${name} (${formatted})` : `(${formatted})`;
}

export function ColumnTooltip({ column, side }: ColumnTooltipProps) {
  const constraints: string[] = [];
  if (column.primaryKey) {
    constraints.push(
      column.primaryKeyColumns
        ? `Primary Key (${column.primaryKeyColumns.join(", ")})`
        : "Primary Key",
    );
  }
  if (column.nullable) constraints.push("Nullable");

  const uniqueDetails =
    column.uniqueConstraints?.map((u) => formatConstraint(u.name, u.columns)) ?? [];
  if (column.unique && uniqueDetails.length === 0) uniqueDetails.push("");

  const indexDetails = column.indexes?.map((ix) => formatConstraint(ix.name, ix.columns)) ?? [];
  if (column.indexed && indexDetails.length === 0) indexDetails.push("");

  return (
    <div className={`${styles.tooltip} ${side === "left" ? styles.left : styles.right}`}>
      <div className={styles.row}>
        <span className={styles.label}>Type</span>
        <span className={styles.value}>{column.type}</span>
      </div>
      {constraints.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>Constraints</span>
          <span className={styles.value}>{constraints.join(", ")}</span>
        </div>
      )}
      {uniqueDetails.length > 0 && (
        <div className={uniqueDetails.length === 1 ? styles.row : styles.constraintList}>
          <span className={styles.label}>Unique</span>
          {uniqueDetails.map((detail) => (
            <span
              key={detail}
              className={`${styles.value}${uniqueDetails.length === 1 ? ` ${styles.hangingIndent}` : ""}`}
            >
              {detail}
            </span>
          ))}
        </div>
      )}
      {indexDetails.length > 0 && (
        <div className={indexDetails.length === 1 ? styles.row : styles.constraintList}>
          <span className={styles.label}>Indexes</span>
          {indexDetails.map((detail) => (
            <span
              key={detail}
              className={`${styles.value}${indexDetails.length === 1 ? ` ${styles.hangingIndent}` : ""}`}
            >
              {detail}
            </span>
          ))}
        </div>
      )}
      {column.default !== undefined && (
        <div className={styles.row}>
          <span className={styles.label}>Default</span>
          <span className={styles.value}>{column.default}</span>
        </div>
      )}
      {column.check && (
        <div className={styles.row}>
          <span className={styles.label}>Check</span>
          <span className={`${styles.value} ${styles.hangingIndent}`}>{column.check}</span>
        </div>
      )}
      {column.enumValues && column.enumValues.length > 0 && (
        <div className={styles.enumValues}>
          <span className={styles.label}>Values</span>
          <div className={styles.enumList}>
            {column.enumValues.map((val) => (
              <span key={val} className={styles.enumItem}>
                {val}
              </span>
            ))}
          </div>
        </div>
      )}
      {column.comment && <div className={styles.doc}>{column.comment}</div>}
    </div>
  );
}
