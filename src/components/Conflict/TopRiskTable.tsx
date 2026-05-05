'use client';

import { useMemo, useState } from 'react';
import type { CountryRisk } from '../../lib/conflict/types';
import { useConflictStore } from '../../store/useConflictStore';
import { scoreToColor, LEVEL_COLOR_VAR } from './colors';

interface Props {
  countries: CountryRisk[];
  onSelect: (country: CountryRisk) => void;
  selectedIso: string | null;
}

type SortKey = 'composite_score' | 'state_dept_level' | 'name' | 'region';

export function TopRiskTable({ countries, onSelect, selectedIso }: Props) {
  const heatmapApiError = useConflictStore((s) => s.heatmapApiError);
  const heatmapApiHint = useConflictStore((s) => s.heatmapApiHint);
  const [sortKey, setSortKey] = useState<SortKey>('composite_score');
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const sorted = [...countries].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case 'composite_score':
          av = a.composite_score;
          bv = b.composite_score;
          break;
        case 'state_dept_level':
          av = a.state_dept_level ?? -1;
          bv = b.state_dept_level ?? -1;
          break;
        case 'name':
          av = a.name;
          bv = b.name;
          break;
        case 'region':
          av = a.region ?? '';
          bv = b.region ?? '';
          break;
      }
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
    return sorted.slice(0, 50);
  }, [countries, sortKey, asc]);

  function toggle(key: SortKey) {
    if (sortKey === key) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(key === 'name' || key === 'region');
    }
  }

  return (
    <div
      style={{
        background: 'rgba(11, 15, 21, 0.6)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '0.7rem',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#94a3b8',
          }}
        >
          Top Risk Countries
        </h3>
        <span style={{ fontSize: '0.7rem', color: '#5a6478' }}>{countries.length} total</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'rgba(13,17,23,0.95)' }}>
            <tr>
              {([
                { key: 'name' as const, label: 'Country' },
                { key: 'region' as const, label: 'Region' },
                { key: 'composite_score' as const, label: 'Risk' },
                { key: 'state_dept_level' as const, label: 'Level' },
              ]).map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggle(col.key)}
                  style={{
                    padding: '8px 12px',
                    textAlign: col.key === 'composite_score' ? 'right' : 'left',
                    fontWeight: 600,
                    fontSize: '0.65rem',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#5a6478',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  {col.label}
                  {sortKey === col.key && (asc ? ' ↑' : ' ↓')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c, idx) => {
              const selected = c.iso_a2 === selectedIso;
              return (
                <tr
                  key={c.iso_a2}
                  onClick={() => onSelect(c)}
                  style={{
                    cursor: 'pointer',
                    background: selected ? 'rgba(0,212,212,0.08)' : 'transparent',
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <td style={{ padding: '8px 12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 24,
                        color: '#5a6478',
                        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                        fontSize: '0.7rem',
                      }}
                    >
                      {idx + 1}
                    </span>
                    {c.iso_a2 ? (
                      <img
                        src={`https://flagcdn.com/w20/${c.iso_a2.toLowerCase()}.png`}
                        alt=""
                        width={20}
                        height={14}
                        style={{ verticalAlign: 'middle', marginRight: 8, borderRadius: 2 }}
                      />
                    ) : null}
                    <span style={{ color: '#e6edf3', fontWeight: 500 }}>{c.name}</span>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{c.region ?? '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        justifyContent: 'flex-end',
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: scoreToColor(c.composite_score),
                        }}
                      />
                      <span
                        style={{
                          color: '#e6edf3',
                          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                        }}
                      >
                        {(c.composite_score * 100).toFixed(0)}
                      </span>
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {c.state_dept_level != null ? (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: LEVEL_COLOR_VAR[c.state_dept_level] ?? '#94a3b8',
                          border: `1px solid ${LEVEL_COLOR_VAR[c.state_dept_level] ?? '#94a3b8'}`,
                        }}
                      >
                        L{c.state_dept_level}
                      </span>
                    ) : (
                      <span style={{ color: '#5a6478' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 24, color: '#5a6478', textAlign: 'center', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {heatmapApiError === 'conflict_schema_missing' ? (
                    <>
                      <div style={{ color: '#fc8d59', fontWeight: 600, marginBottom: 8 }}>
                        ConflictLens tables are missing in this Supabase project
                      </div>
                      <div>{heatmapApiHint}</div>
                    </>
                  ) : heatmapApiError === 'conflict_no_country_rows' ? (
                    <>
                      <div style={{ color: '#fc8d59', fontWeight: 600, marginBottom: 8 }}>
                        Country list not seeded yet
                      </div>
                      <div>{heatmapApiHint}</div>
                    </>
                  ) : heatmapApiError === 'supabase_unconfigured' ? (
                    <>
                      <div style={{ color: '#fc8d59', fontWeight: 600, marginBottom: 8 }}>
                        Supabase is not configured for ConflictLens reads
                      </div>
                      <div>{heatmapApiHint}</div>
                    </>
                  ) : heatmapApiError === 'heatmap_query_failed' ? (
                    <>
                      <div style={{ color: '#fc8d59', fontWeight: 600, marginBottom: 8 }}>
                        Could not load countries from Supabase
                      </div>
                      <div>{heatmapApiHint}</div>
                    </>
                  ) : (
                    'No countries match current filters.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
