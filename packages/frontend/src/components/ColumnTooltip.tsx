import type { Column } from "../types.js";
import styles from "./ColumnTooltip.module.css";

interface ColumnTooltipProps {
  column: Column;
  side: "left" | "right";
}

export function ColumnTooltip({ column, side }: ColumnTooltipProps) {
  const constraints: string[] = [];
  if (column.primaryKey) constraints.push("Primary Key");
  if (column.unique) constraints.push("Unique");
  if (column.indexed) constraints.push("Indexed");
  if (column.nullable) constraints.push("Nullable");

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
      {column.default !== undefined && (
        <div className={styles.row}>
          <span className={styles.label}>Default</span>
          <span className={styles.value}>{column.default}</span>
        </div>
      )}
      {column.check && (
        <div className={styles.row}>
          <span className={styles.label}>Check</span>
          <span className={styles.value}>{column.check}</span>
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
