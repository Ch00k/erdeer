import type { ReactNode } from "react";
import styles from "./Tooltip.module.css";

interface TooltipProps {
  side: "left" | "right";
  children: ReactNode;
}

export function Tooltip({ side, children }: TooltipProps) {
  return (
    <div className={`${styles.tooltip} ${side === "left" ? styles.left : styles.right}`}>
      {children}
    </div>
  );
}
