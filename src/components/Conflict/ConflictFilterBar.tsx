'use client';

import { useConflictStore } from '../../store/useConflictStore';
import styles from './ConflictFilterBar.module.css';

const REGIONS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];

export function ConflictFilterBar({
  onRefresh,
  isRefreshing,
}: {
  onRefresh: () => void;
  isRefreshing?: boolean;
}) {
  const { filters, setFilters } = useConflictStore();

  return (
    <div className={styles.bar}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Region</span>
        <select
          value={filters.region ?? ''}
          onChange={e => setFilters({ region: e.target.value || null })}
          className={styles.select}
        >
          <option value="">All</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Level</span>
        <select
          value={filters.stateDeptLevel ?? ''}
          onChange={e => setFilters({ stateDeptLevel: e.target.value ? parseInt(e.target.value, 10) : null })}
          className={styles.select}
        >
          <option value="">All</option>
          <option value="1">L1</option>
          <option value="2">L2</option>
          <option value="3">L3</option>
          <option value="4">L4</option>
        </select>
      </label>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Risk ≥</span>
        <input
          type="range" min="0" max="1" step="0.05"
          value={filters.minScore}
          onChange={e => setFilters({ minScore: parseFloat(e.target.value) })}
          className={styles.slider}
        />
        <span className={styles.sliderVal}>{(filters.minScore * 100).toFixed(0)}</span>
      </div>
    </div>
  );
}
