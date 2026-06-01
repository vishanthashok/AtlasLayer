'use client';

import { useEffect, useState } from 'react';
import { Star, ExternalLink, Filter } from 'lucide-react';
import type { ConflictNewsApiResponse, NewsSignal } from '../../lib/conflict/types';
import { useWatchlistStore } from '../../store/useWatchlistStore';
import styles from './NewsSignalFeed.module.css';

interface Props {
  countryIso?: string | null;
  refreshKey?: number;
}

type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
type SourceType = 'OSINT' | 'HUMAN' | 'SATELLITE' | 'SIGINT';

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function getSeverity(conflictScore: number | null, sentimentScore: number | null): SeverityLevel {
  const cs = conflictScore ?? 0;
  const ss = Math.abs(sentimentScore ?? 0);
  const combined = cs * 0.7 + ss * 0.3;
  if (combined >= 0.85) return 'CRITICAL';
  if (combined >= 0.65) return 'HIGH';
  if (combined >= 0.40) return 'MODERATE';
  return 'LOW';
}

function getSourceType(sourceName: string | null): SourceType {
  const s = (sourceName ?? '').toLowerCase();
  if (s.includes('satellite') || s.includes('planet') || s.includes('maxar')) return 'SATELLITE';
  if (s.includes('sigint') || s.includes('nsa') || s.includes('gchq')) return 'SIGINT';
  if (s.includes('reuters') || s.includes('ap') || s.includes('bbc') ||
      s.includes('al jazeera') || s.includes('voa')) return 'OSINT';
  return 'OSINT';
}

const SEVERITY_STYLES: Record<SeverityLevel, { bg: string; color: string; border: string }> = {
  CRITICAL: { bg: 'rgba(255, 59, 59, 0.12)', color: '#ff3b3b', border: 'rgba(255, 59, 59, 0.4)' },
  HIGH:     { bg: 'rgba(255, 140, 0, 0.10)',  color: '#ff8c00', border: 'rgba(255, 140, 0, 0.35)' },
  MODERATE: { bg: 'rgba(255, 204, 0, 0.08)',  color: '#ffcc00', border: 'rgba(255, 204, 0, 0.3)' },
  LOW:      { bg: 'rgba(34, 211, 165, 0.06)', color: '#22d3a5', border: 'rgba(34, 211, 165, 0.25)' },
};

const SOURCE_COLORS: Record<SourceType, string> = {
  OSINT:     '#00d4ff',
  HUMAN:     '#a78bfa',
  SATELLITE: '#22d3a5',
  SIGINT:    '#f59e0b',
};

export function NewsSignalFeed({ countryIso, refreshKey }: Props) {
  const [articles, setArticles] = useState<NewsSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<SeverityLevel | 'ALL'>('ALL');
  const { watchedIsos, addToWatchlist } = useWatchlistStore();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (countryIso) params.set('country_iso', countryIso);
    params.set('limit', '60');
    fetch(`/api/conflict/news?${params}`)
      .then(r => r.json() as Promise<ConflictNewsApiResponse>)
      .then(data => { if (!cancelled) setArticles(data.articles ?? []); })
      .catch(() => { if (!cancelled) setArticles([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [countryIso, refreshKey]);

  const filtered = articles.filter(a => {
    const sev = getSeverity(a.conflict_score, a.sentiment_score);
    if (filterSeverity !== 'ALL' && sev !== filterSeverity) return false;
    if (filterText) {
      const t = filterText.toLowerCase();
      return a.title.toLowerCase().includes(t) ||
        (a.source_name ?? '').toLowerCase().includes(t) ||
        (a.country_iso ?? '').toLowerCase().includes(t);
    }
    return true;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>THREAT INTELLIGENCE FEED</span>
          {countryIso && <span className={styles.countryPill}>{countryIso}</span>}
        </div>
        <span className={styles.count}>{loading ? '…' : `${filtered.length} signals`}</span>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterInput}>
          <Filter size={11} style={{ color: '#2a3a4e', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Filter by keyword, source, country…"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className={styles.filterText}
          />
        </div>
        <div className={styles.severityFilters}>
          {(['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'] as const).map(s => (
            <button
              key={s}
              className={`${styles.sevBtn} ${filterSeverity === s ? styles.sevBtnActive : ''}`}
              style={filterSeverity === s && s !== 'ALL' ? {
                color: SEVERITY_STYLES[s as SeverityLevel].color,
                borderColor: SEVERITY_STYLES[s as SeverityLevel].border,
              } : undefined}
              onClick={() => setFilterSeverity(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.feed}>
        {loading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}

        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            <span>NO SIGNALS MATCH CURRENT FILTERS</span>
          </div>
        )}

        {filtered.map(a => {
          const severity = getSeverity(a.conflict_score, a.sentiment_score);
          const sourceType = getSourceType(a.source_name);
          const sevStyle = SEVERITY_STYLES[severity];
          const isWatched = a.country_iso ? watchedIsos.has(a.country_iso.trim().toUpperCase()) : false;

          return (
            <div key={a.id} className={styles.card} style={{ borderLeft: `2px solid ${sevStyle.color}` }}>
              <div className={styles.cardTop}>
                <span
                  className={styles.sevBadge}
                  style={{ background: sevStyle.bg, color: sevStyle.color, borderColor: sevStyle.border }}
                >
                  {severity}
                </span>
                <span
                  className={styles.sourceBadge}
                  style={{ color: SOURCE_COLORS[sourceType] }}
                >
                  {sourceType}
                </span>
                {a.country_iso && (
                  <img
                    src={`https://flagcdn.com/w20/${a.country_iso.trim().toLowerCase()}.png`}
                    alt="" width={16} height={11}
                    style={{ borderRadius: 1, flexShrink: 0 }}
                  />
                )}
                <span className={styles.time}>{relativeTime(a.published_at)}</span>
              </div>

              <div className={styles.cardTitle}>{a.title}</div>

              <div className={styles.cardMeta}>
                <span className={styles.source}>{a.source_name ?? 'Unknown'}</span>
                {a.conflict_score != null && (
                  <span className={styles.conflictScore}>
                    THREAT {(a.conflict_score * 100).toFixed(0)}
                  </span>
                )}
              </div>

              <div className={styles.cardActions}>
                {a.country_iso && !isWatched && (
                  <button
                    className={styles.watchBtn}
                    onClick={() => addToWatchlist(a.country_iso!.trim())}
                  >
                    <Star size={10} /> Watch {a.country_iso}
                  </button>
                )}
                {a.url && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                    <ExternalLink size={10} /> Source
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
