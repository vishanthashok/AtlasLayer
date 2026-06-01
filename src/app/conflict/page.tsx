'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useConflictStore } from '../../store/useConflictStore';
import { ConflictFilterBar } from '../../components/Conflict/ConflictFilterBar';
import { TopRiskTable } from '../../components/Conflict/TopRiskTable';
import { NewsSignalFeed } from '../../components/Conflict/NewsSignalFeed';
import { CountryDetailDrawer } from '../../components/Conflict/CountryDetailDrawer';
import { RiskLegend } from '../../components/Conflict/RiskLegend';
import { UpdateBanner } from '../../components/Conflict/UpdateBanner';
import type { ConflictUpdateEvent } from '../../lib/conflict/types';

// Avoid SSR for the world map: Mapbox GL needs `window`.
const WorldHeatMap = dynamic(
  () => import('../../components/Conflict/WorldHeatMap').then((m) => m.WorldHeatMap),
  { ssr: false, loading: () => <MapSkeleton /> }
);

function BootstrapOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(8, 12, 16, 0.55)',
        backdropFilter: 'blur(2px)',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <div
        style={{
          background: 'rgba(8, 12, 16, 0.92)',
          border: '1px solid rgba(74, 158, 255, 0.25)',
          borderRadius: 6,
          padding: '14px 18px',
          color: '#c8d6e8',
          fontSize: '0.78rem',
          letterSpacing: '0.04em',
          backdropFilter: 'blur(12px)',
        }}
      >
        Bootstrapping ConflictLens — fetching advisories, news, and signals…
      </div>
    </div>
  );
}

function ConflictBackendBanner({
  code,
  hint,
  usedAnonFallback,
}: {
  code: string | null;
  hint: string | null;
  usedAnonFallback: boolean;
}) {
  if (!code && !usedAnonFallback) return null;

  const isError =
    code === 'supabase_unconfigured' ||
    code === 'heatmap_query_failed' ||
    code === 'heatmap_fetch_failed' ||
    code === 'conflict_schema_missing' ||
    code === 'conflict_no_country_rows';

  return (
    <div
      style={{
        marginTop: 10,
        padding: '10px 14px',
        borderRadius: 6,
        fontSize: '0.78rem',
        lineHeight: 1.45,
        border: `1px solid ${isError ? 'rgba(252, 141, 89, 0.45)' : 'rgba(0, 212, 212, 0.35)'}`,
        background: isError ? 'rgba(45, 20, 12, 0.85)' : 'rgba(0, 212, 212, 0.06)',
        color: isError ? '#fde6cf' : '#b8e8ea',
      }}
    >
      {code === 'supabase_unconfigured' && (
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Supabase not configured for ConflictLens</div>
      )}
      {code === 'heatmap_query_failed' && (
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Could not load risk data from Supabase</div>
      )}
      {code === 'conflict_schema_missing' && (
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          ConflictLens tables are missing in this Supabase project
        </div>
      )}
      {code === 'conflict_no_country_rows' && (
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          Countries table is empty — bootstrap has not seeded data
        </div>
      )}
      {code === 'heatmap_fetch_failed' && (
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Heatmap request failed</div>
      )}
      {hint && (
        <div style={{ opacity: 0.88, color: isError ? '#e8d4c8' : '#94c9cc', marginBottom: usedAnonFallback ? 8 : 0 }}>
          {hint}
        </div>
      )}
      {usedAnonFallback && !isError && (
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Read-only Supabase mode</div>
      )}
      {usedAnonFallback && (
        <div style={{ opacity: 0.92 }}>
          Using <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> for reads. Set{' '}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> on the server to run ingestion and refresh.
        </div>
      )}
    </div>
  );
}

function SchemaMissingPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(34, 12, 12, 0.95)',
        border: '1px solid rgba(252, 141, 89, 0.35)',
        borderRadius: 6,
        padding: '12px 16px',
        color: '#fde6cf',
        fontSize: '0.78rem',
        maxWidth: 560,
        zIndex: 12,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        ConflictLens schema not applied
      </div>
      <div style={{ color: '#cbb29c', lineHeight: 1.45 }}>
        Run <code>supabase/schema.sql</code> in the Supabase SQL editor (the
        ConflictLens block creates <code>countries</code>,{' '}
        <code>travel_advisories</code>, <code>news_articles</code>,{' '}
        <code>social_signals</code>, <code>conflict_risk_scores</code>, and the{' '}
        <code>latest_conflict_scores</code> view). Then retry.
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: 8,
          background: 'rgba(252, 141, 89, 0.15)',
          border: '1px solid rgba(252, 141, 89, 0.4)',
          color: '#fc8d59',
          padding: '6px 10px',
          borderRadius: 4,
          fontSize: '0.72rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        color: '#5a6478',
        fontSize: '0.8rem',
        background: '#0d1117',
        borderRadius: 8,
      }}
    >
      Loading world map…
    </div>
  );
}

const BOOTSTRAP_FLAG = 'conflict_bootstrapped';

interface RefreshResponse {
  ok?: boolean;
  schemaMissing?: boolean;
  hint?: string;
  error?: string;
}

export default function ConflictPage() {
  const {
    filteredCountries,
    selectedCountry,
    fetchHeatmap,
    selectCountry,
    lastUpdated,
    isLoading,
    filters,
    heatmapApiError,
    heatmapApiHint,
    heatmapUsedAnonFallback,
  } = useConflictStore();

  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const didBootstrapRef = useRef(false);

  useEffect(() => {
    void fetchHeatmap();
  }, [fetchHeatmap, filters.region, filters.stateDeptLevel]);

  // Auto-bootstrap when the heatmap is empty on first load.
  useEffect(() => {
    if (didBootstrapRef.current) return;
    if (isLoading) return;
    if (filteredCountries.length > 0) return;
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(BOOTSTRAP_FLAG) === '1') return;

    didBootstrapRef.current = true;

    void (async () => {
      setBootstrapping(true);
      setBannerMsg('Bootstrapping ConflictLens (this takes ~30s)…');
      try {
        const resp = await fetch('/api/conflict/refresh?step=bootstrap', {
          method: 'POST',
        });
        const data = (await resp.json().catch(() => ({}))) as RefreshResponse;
        if (resp.status === 412 && data.schemaMissing) {
          setSchemaMissing(true);
          setBannerMsg(null);
          return;
        }
        if (!resp.ok || !data.ok) {
          setBannerMsg(data.error ?? 'Bootstrap failed — check server logs');
          return;
        }
        window.localStorage.setItem(BOOTSTRAP_FLAG, '1');
        await fetchHeatmap();
        setRefreshKey((k) => k + 1);
        setBannerMsg('ConflictLens ready — globe now reflects live signals');
      } catch (e) {
        setBannerMsg(`Bootstrap error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [filteredCountries.length, isLoading, fetchHeatmap]);

  useEffect(() => {
    function open() {
      const es = new EventSource('/api/conflict/stream');
      eventSourceRef.current = es;
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as ConflictUpdateEvent | { event: 'heartbeat' };
          if (data.event === 'scores_updated' || data.event === 'advisories_refreshed') {
            const count =
              data.event === 'scores_updated' && 'updated_count' in data
                ? (data as ConflictUpdateEvent).updated_count
                : undefined;
            setBannerMsg(
              data.event === 'scores_updated'
                ? `Risk scores updated${count != null ? ` — ${count} countries` : ''}`
                : 'State Department advisories refreshed'
            );
            void fetchHeatmap();
            setRefreshKey((k) => k + 1);
          }
        } catch {
          // ignore malformed frames
        }
      };
      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setTimeout(open, 5000);
      };
    }
    open();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [fetchHeatmap]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const resp = await fetch('/api/conflict/refresh?step=all', { method: 'POST' });
      if (resp.status === 412) {
        setSchemaMissing(true);
      } else {
        setSchemaMissing(false);
      }
    } catch {
      // ignore — cron secret may block this in production
    } finally {
      await fetchHeatmap();
      setRefreshKey((k) => k + 1);
      setRefreshing(false);
    }
  }, [fetchHeatmap]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gap: 12,
        padding: 16,
        height: '100vh',
        background: 'var(--pv-bg)',
        color: 'var(--pv-text)',
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link
            href="/"
            style={{
              fontSize: '0.7rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#5a6478',
            }}
          >
            ← AtlasLayer
          </Link>
          <div style={{ flex: 1, marginLeft: 16, marginRight: 16 }}>
            <ConflictFilterBar onRefresh={onRefresh} isRefreshing={refreshing || isLoading} />
          </div>
        </div>
        <ConflictBackendBanner
          code={heatmapApiError}
          hint={heatmapApiHint}
          usedAnonFallback={heatmapUsedAnonFallback}
        />
      </header>

      <main
        style={{
          display: 'grid',
          gridTemplateRows: '1fr minmax(280px, 36vh)',
          gap: 12,
          minHeight: 0,
        }}
      >
        <section
          style={{
            position: 'relative',
            background: '#0d1117',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 8,
            overflow: 'hidden',
            minHeight: 360,
          }}
        >
          <WorldHeatMap
            countries={filteredCountries}
            onSelect={selectCountry}
            selectedIso={selectedCountry?.iso_a2 ?? null}
          />
          <div style={{ position: 'absolute', left: 12, bottom: 12 }}>
            <RiskLegend lastUpdated={lastUpdated} />
          </div>
          <UpdateBanner message={bannerMsg} onDismiss={() => setBannerMsg(null)} />
          {bootstrapping && <BootstrapOverlay />}
          {schemaMissing && <SchemaMissingPanel onRetry={onRefresh} />}
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 12,
            minHeight: 0,
          }}
        >
          <TopRiskTable
            countries={filteredCountries}
            onSelect={selectCountry}
            selectedIso={selectedCountry?.iso_a2 ?? null}
          />
          <NewsSignalFeed refreshKey={refreshKey} />
        </section>
      </main>

      <CountryDetailDrawer country={selectedCountry} onClose={() => selectCountry(null)} />
    </div>
  );
}
