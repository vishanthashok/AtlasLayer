'use client';

import { RISK_BUCKETS, LEVEL_COLOR_VAR } from './colors';

interface Props {
  lastUpdated: Date | null;
}

function relativeTime(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RiskLegend({ lastUpdated }: Props) {
  return (
    <div
      style={{
        background: 'rgba(8, 12, 16, 0.92)',
        border: '1px solid rgba(74, 158, 255, 0.18)',
        borderRadius: 5,
        padding: '10px 12px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontSize: '0.7rem',
        color: '#94a3b8',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 240,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#5a6478', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Risk
        </span>
        {RISK_BUCKETS.map((b) => (
          <span
            key={b.label}
            title={`${b.label} · ≥ ${(b.min * 100).toFixed(0)}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.65rem',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: b.cssVar,
                display: 'inline-block',
              }}
              aria-hidden
            />
            {b.label}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: '#5a6478', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Level
        </span>
        {[1, 2, 3, 4].map((lvl) => (
          <span
            key={lvl}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem' }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                background: LEVEL_COLOR_VAR[lvl],
                display: 'inline-block',
              }}
              aria-hidden
            />
            {lvl}
          </span>
        ))}
      </div>
      <div style={{ color: '#5a6478', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
        {lastUpdated ? `Updated ${relativeTime(lastUpdated)}` : 'No data yet'}
      </div>
    </div>
  );
}
