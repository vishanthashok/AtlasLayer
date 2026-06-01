import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  variant?: 'default' | 'scan';
}

export function EmptyState({ icon, title, body, action, variant = 'default' }: EmptyStateProps) {
  return (
    <div className={`${styles.root} ${variant === 'scan' ? styles.scan : ''}`}>
      {icon && <div className={styles.iconWrap}>{icon}</div>}
      <div className={styles.title}>{title}</div>
      {body && <div className={styles.body}>{body}</div>}
      {action && <div className={styles.action}>{action}</div>}
      {variant === 'scan' && <div className={styles.scanLine} />}
    </div>
  );
}
