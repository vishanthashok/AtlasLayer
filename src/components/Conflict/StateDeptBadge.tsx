'use client';

import { LEVEL_LABEL, LEVEL_COLOR_VAR } from './colors';

export function StateDeptBadge({ level }: { level: number | null }) {
  if (level == null) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#5a6478',
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        No Advisory
      </span>
    );
  }

  const color = LEVEL_COLOR_VAR[level] ?? 'var(--pv-muted)';
  const label = LEVEL_LABEL[level] ?? `Level ${level}`;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${color}`,
        color,
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
      title={label}
    >
      <span
        style={{ width: 8, height: 8, borderRadius: '50%', background: color }}
        aria-hidden
      />
      Level {level} · {label}
    </span>
  );
}
