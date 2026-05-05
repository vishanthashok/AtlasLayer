'use client';

import { useConflictStore } from '../../store/useConflictStore';

const REGIONS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];

export function ConflictFilterBar({
  onRefresh,
  isRefreshing,
}: {
  onRefresh: () => void;
  isRefreshing?: boolean;
}) {
  const { filters, setFilters, lastUpdated } = useConflictStore();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'rgba(13, 17, 23, 0.7)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 8,
        flexWrap: 'wrap',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: '0.7rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#5a6478',
        }}
      >
        ConflictLens
      </h2>

      <div style={{ height: 24, width: 1, background: 'rgba(255,255,255,0.06)' }} />

      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Region</span>
        <select
          value={filters.region ?? ''}
          onChange={(e) => setFilters({ region: e.target.value || null })}
          style={selectStyle}
        >
          <option value="">All</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Level</span>
        <select
          value={filters.stateDeptLevel ?? ''}
          onChange={(e) =>
            setFilters({ stateDeptLevel: e.target.value ? parseInt(e.target.value, 10) : null })
          }
          style={selectStyle}
        >
          <option value="">All</option>
          <option value="1">L1 · Normal</option>
          <option value="2">L2 · Caution</option>
          <option value="3">L3 · Reconsider</option>
          <option value="4">L4 · Do Not Travel</option>
        </select>
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Risk ≥</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={filters.minScore}
          onChange={(e) => setFilters({ minScore: parseFloat(e.target.value) })}
          style={{ width: 100 }}
        />
        <span
          style={{
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: '0.7rem',
            color: '#e6edf3',
            width: 24,
          }}
        >
          {(filters.minScore * 100).toFixed(0)}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {lastUpdated && (
        <span style={{ fontSize: '0.7rem', color: '#5a6478' }}>
          Last sync {new Date(lastUpdated).toLocaleTimeString()}
        </span>
      )}

      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        style={{
          background: 'rgba(0, 212, 212, 0.08)',
          border: '1px solid rgba(0, 212, 212, 0.4)',
          color: '#00d4d4',
          fontSize: '0.7rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          padding: '6px 14px',
          borderRadius: 4,
          cursor: isRefreshing ? 'wait' : 'pointer',
          opacity: isRefreshing ? 0.6 : 1,
        }}
      >
        {isRefreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#e6edf3',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: '0.75rem',
};
