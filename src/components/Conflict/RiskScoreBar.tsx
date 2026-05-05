'use client';

import type { CountryRisk } from '../../lib/conflict/types';

/** Matches advisory priors used in the on-device ML blend (display only). */
const LEVEL_NORM: Record<number, number> = { 1: 0.12, 2: 0.38, 3: 0.72, 4: 0.96 };

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function RiskScoreBar({ country }: { country: CountryRisk }) {
  const advisoryNorm =
    country.state_dept_level != null ? LEVEL_NORM[country.state_dept_level] ?? 0.07 : 0.07;
  const newsNorm = clamp01(country.news_conflict_score ?? 0);
  const socialNorm = clamp01(country.social_signal_score ?? 0);

  const segments = [
    {
      key: 'advisory',
      label: 'Official travel advisory',
      sub: 'Level drives the strongest prior in the model',
      pct: Math.round(advisoryNorm * 100),
      color: '#4a9eff',
    },
    {
      key: 'news',
      label: 'News conflict signal',
      sub: 'Rolling 6h average',
      pct: Math.round(newsNorm * 100),
      color: '#22d3a5',
    },
    {
      key: 'social',
      label: 'Social intensity',
      sub: 'Rolling 1h Reddit-derived proxy',
      pct: Math.round(socialNorm * 100),
      color: '#fc8d59',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: '0.65rem', color: '#5a6478', lineHeight: 1.45 }}>
        The headline composite score blends State Dept advisory level + NLP on advisory page text
        with supplemental feeds. Bars show normalized inputs (not additive weights).
      </p>
      {segments.map((s) => (
        <div key={s.key}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#5a6478',
              marginBottom: 4,
            }}
          >
            <span>
              {s.label}{' '}
              <span style={{ color: '#3d5068', textTransform: 'none', letterSpacing: '0.02em' }}>
                · {s.sub}
              </span>
            </span>
            <span style={{ color: s.color, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
              {s.pct}
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${s.pct}%`,
                background: s.color,
                transition: 'width 250ms ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
