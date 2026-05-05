'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { CountryRisk, CountryTimeSeriesResponse } from '../../lib/conflict/types';
import { StateDeptBadge } from './StateDeptBadge';
import { RiskScoreBar } from './RiskScoreBar';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { NewsSignalFeed } from './NewsSignalFeed';
import { scoreToColor } from './colors';

interface Props {
  country: CountryRisk | null;
  onClose: () => void;
}

export function CountryDetailDrawer({ country, onClose }: Props) {
  if (!country) return null;
  return <DrawerContent key={country.iso_a2} country={country} onClose={onClose} />;
}

function DrawerContent({ country, onClose }: { country: CountryRisk; onClose: () => void }) {
  const [series, setSeries] = useState<CountryTimeSeriesResponse | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/conflict/country/${country.iso_a2}/timeseries?days=30`, { signal: ac.signal })
      .then((r) => r.json() as Promise<CountryTimeSeriesResponse>)
      .then((data) => setSeries(data))
      .catch((e) => {
        if (e?.name !== 'AbortError') console.warn('[drawer] timeseries fetch failed', e);
      })
      .finally(() => setLoadingSeries(false));
    return () => ac.abort();
  }, [country.iso_a2]);

  const chartData = (series?.series ?? []).map((p) => ({
    t: p.timestamp,
    score: p.composite_score,
  }));

  const composite = (country.composite_score * 100).toFixed(0);
  const compositeColor = scoreToColor(country.composite_score);

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(420px, 92vw)',
        background: 'rgba(11, 15, 21, 0.97)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 100,
        boxShadow: '-12px 0 36px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          padding: 20,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <img
          src={`https://flagcdn.com/w80/${country.iso_a2.toLowerCase()}.png`}
          alt=""
          width={48}
          height={32}
          style={{ borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#e6edf3' }}>
            {country.name}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#5a6478', marginTop: 2 }}>
            {country.region ?? 'Unknown region'} · {country.iso_a2}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: 4,
            fontSize: '0.75rem',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18, overflow: 'auto' }}>
        <section
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: 14,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 6,
          }}
        >
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${compositeColor}22 0%, ${compositeColor}05 70%)`,
              border: `2px solid ${compositeColor}`,
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: '1.6rem',
              color: '#e6edf3',
              fontWeight: 700,
            }}
          >
            {composite}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <StateDeptBadge level={country.state_dept_level} />
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Travel safety index{' '}
              <strong style={{ color: '#e6edf3' }}>{country.safety_score}</strong>
              <span style={{ color: '#5a6478' }}> / 100</span>
              <span style={{ color: '#5a6478', marginLeft: 8 }}>
                (higher = safer · inverse of violence score)
              </span>
            </div>
            <ConfidenceIndicator value={country.confidence} />
            <span style={{ color: '#5a6478', fontSize: '0.7rem' }}>
              Sources: {country.data_sources.join(', ') || 'none'}
            </span>
          </div>
        </section>

        <section>
          <h4
            style={{
              margin: '0 0 8px',
              fontSize: '0.7rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#5a6478',
            }}
          >
            Score breakdown
          </h4>
          <RiskScoreBar country={country} />
        </section>

        <section>
          <h4
            style={{
              margin: '0 0 8px',
              fontSize: '0.7rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#5a6478',
            }}
          >
            30-day risk trend
          </h4>
          <div style={{ height: 140 }}>
            {chartData.length === 0 ? (
              <div
                style={{
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#5a6478',
                  fontSize: '0.8rem',
                  border: '1px dashed rgba(255,255,255,0.06)',
                  borderRadius: 4,
                }}
              >
                {loadingSeries ? 'Loading…' : 'No history yet'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={[0, 1]} hide />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(11,15,21,0.95)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(value) => {
                      const n = typeof value === 'number' ? value : Number(value);
                      return [`${Number.isFinite(n) ? (n * 100).toFixed(0) : '—'}/100`, 'Risk'];
                    }}
                    labelFormatter={(label) => {
                      const s = typeof label === 'string' ? label : String(label ?? '');
                      const t = Date.parse(s);
                      return Number.isFinite(t) ? new Date(t).toLocaleString() : s;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={compositeColor}
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section>
          <h4
            style={{
              margin: '0 0 8px',
              fontSize: '0.7rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#5a6478',
            }}
          >
            Country news
          </h4>
          <div style={{ height: 280 }}>
            <NewsSignalFeed countryIso={country.iso_a2} />
          </div>
        </section>

        <a
          href={`https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/${country.name
            .toLowerCase()
            .replace(/\s+/g, '-')}-travel-advisory.html`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '8px 14px',
            border: '1px solid rgba(0, 212, 212, 0.4)',
            color: '#00d4d4',
            borderRadius: 4,
            textDecoration: 'none',
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          View Official Advisory →
        </a>
      </div>
    </aside>
  );
}
