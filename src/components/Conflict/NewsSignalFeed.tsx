'use client';

import { useEffect, useState } from 'react';
import type { ConflictNewsApiResponse, NewsSignal } from '../../lib/conflict/types';
import { scoreToColor } from './colors';

interface Props {
  countryIso?: string | null;
  refreshKey?: number;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const seconds = Math.floor((Date.now() - t) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function sentimentLabel(score: number | null): { label: string; color: string } {
  if (score == null) return { label: 'Neutral', color: '#5a6478' };
  if (score < -0.3) return { label: 'Negative', color: '#fc8d59' };
  if (score < 0) return { label: 'Tense', color: '#fee08b' };
  if (score < 0.3) return { label: 'Neutral', color: '#94a3b8' };
  return { label: 'Positive', color: '#22d3a5' };
}

export function NewsSignalFeed({ countryIso, refreshKey }: Props) {
  const [articles, setArticles] = useState<NewsSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiHint, setApiHint] = useState<string | null>(null);
  const [emptyFeedHint, setEmptyFeedHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setApiError(null);
      setApiHint(null);
      setEmptyFeedHint(null);
      try {
        const params = new URLSearchParams();
        if (countryIso) params.set('country_iso', countryIso);
        params.set('limit', '60');
        const resp = await fetch(`/api/conflict/news?${params.toString()}`);
        const data = (await resp.json()) as ConflictNewsApiResponse;
        if (!cancelled) {
          setArticles(data.articles ?? []);
          setApiError(data.error ?? null);
          setApiHint(data.hint ?? null);
          setEmptyFeedHint(data.empty_feed_hint ?? null);
        }
      } catch (e) {
        console.warn('[news feed] fetch failed', e);
        if (!cancelled) {
          setArticles([]);
          setApiError('news_fetch_failed');
          setApiHint(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [countryIso, refreshKey]);

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
          Live News Feed {countryIso ? `· ${countryIso}` : ''}
        </h3>
        <span style={{ fontSize: '0.7rem', color: '#5a6478' }}>
          {loading ? 'Loading…' : `${articles.length} items`}
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {apiError && !loading && (
          <div
            style={{
              padding: 16,
              margin: 12,
              borderRadius: 6,
              border: '1px solid rgba(252, 141, 89, 0.4)',
              background: 'rgba(45, 20, 12, 0.75)',
              color: '#fde6cf',
              fontSize: '0.82rem',
              lineHeight: 1.45,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              {apiError === 'supabase_unconfigured'
                ? 'News feed: Supabase not configured'
                : apiError === 'conflict_schema_missing'
                  ? 'News feed: tables not created yet'
                  : apiError === 'news_query_failed'
                    ? 'News feed: database query failed'
                    : 'News feed unavailable'}
            </div>
            {apiHint && <div style={{ opacity: 0.9 }}>{apiHint}</div>}
          </div>
        )}
        {articles.length === 0 && !loading && !apiError && (
          <div style={{ padding: 24, color: '#5a6478', textAlign: 'center', fontSize: '0.85rem', lineHeight: 1.5 }}>
            <div>No news signals yet.</div>
            {emptyFeedHint && (
              <div style={{ marginTop: 12, color: '#94a3b8', fontSize: '0.8rem', maxWidth: 420, margin: '12px auto 0' }}>
                {emptyFeedHint}
              </div>
            )}
          </div>
        )}
        {articles.map((a) => {
          const sent = sentimentLabel(a.sentiment_score);
          const borderColor = scoreToColor(a.conflict_score ?? 0);
          return (
            <a
              key={a.id}
              href={a.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '10px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                borderLeft: `3px solid ${borderColor}`,
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
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
                <span>{a.source_name ?? 'Unknown'}</span>
                <span>{relativeTime(a.published_at)}</span>
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: '#e6edf3',
                  lineHeight: 1.35,
                  marginBottom: 6,
                }}
              >
                {a.title}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: '0.65rem',
                  color: '#94a3b8',
                }}
              >
                <span
                  style={{
                    color: sent.color,
                    border: `1px solid ${sent.color}`,
                    borderRadius: 3,
                    padding: '1px 6px',
                  }}
                >
                  {sent.label}
                </span>
                {a.country_iso && (
                  <img
                    src={`https://flagcdn.com/w20/${a.country_iso.trim().toLowerCase()}.png`}
                    alt=""
                    width={16}
                    height={11}
                    style={{ borderRadius: 1 }}
                  />
                )}
                {a.conflict_score != null && (
                  <span style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
                    Conflict {(a.conflict_score * 100).toFixed(0)}
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
