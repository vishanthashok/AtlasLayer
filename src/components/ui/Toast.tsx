"use client";

import { useEffect } from 'react';
import styles from './Toast.module.css';

export type ToastVariant = 'error' | 'warning' | 'success' | 'info';

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({ message, variant = 'error', onDismiss, durationMs = 6000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs]);

  return (
    <div className={`${styles.toast} ${styles[variant]}`} role="alert">
      <span className={styles.message}>{message}</span>
      <button className={styles.close} onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
