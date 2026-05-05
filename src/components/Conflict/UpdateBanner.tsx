'use client';

import { useEffect } from 'react';

interface Props {
  message: string | null;
  onDismiss?: () => void;
}

export function UpdateBanner({ message, onDismiss }: Props) {
  useEffect(() => {
    if (!message || !onDismiss) return;
    const t = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 50,
        background: 'rgba(0, 212, 212, 0.12)',
        border: '1px solid rgba(0, 212, 212, 0.5)',
        color: '#00d4d4',
        padding: '8px 14px',
        borderRadius: 4,
        fontSize: '0.8rem',
        letterSpacing: '0.05em',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        animation: 'pv-pulse 1.4s ease-in-out infinite',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#00d4d4',
          boxShadow: '0 0 8px #00d4d4',
        }}
      />
      {message}
      <style>{`@keyframes pv-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>
    </div>
  );
}
