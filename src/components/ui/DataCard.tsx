import type { ReactNode } from 'react';
import styles from './DataCard.module.css';

interface DataCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  className?: string;
}

export function DataCard({ label, value, sub, accent, className }: DataCardProps) {
  return (
    <div className={`${styles.card} ${className ?? ''}`} style={accent ? { borderColor: `${accent}33` } : undefined}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value} style={accent ? { color: accent } : undefined}>{value}</div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  );
}

interface StatGridProps {
  children: ReactNode;
  cols?: 2 | 3 | 4;
}

export function StatGrid({ children, cols = 2 }: StatGridProps) {
  return (
    <div className={styles.grid} style={{ '--cols': cols } as React.CSSProperties}>
      {children}
    </div>
  );
}
