'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Globe, BarChart2, BookOpen, Shield, RefreshCw } from 'lucide-react';
import { useConflictStore } from '../../store/useConflictStore';
import { useWatchlistStore } from '../../store/useWatchlistStore';
import { ConflictFilterBar } from '../../components/Conflict/ConflictFilterBar';
import { TopRiskTable } from '../../components/Conflict/TopRiskTable';
import { NewsSignalFeed } from '../../components/Conflict/NewsSignalFeed';
import { CountryDetailDrawer } from '../../components/Conflict/CountryDetailDrawer';
import { RiskLegend } from '../../components/Conflict/RiskLegend';
import { UpdateBanner } from '../../components/Conflict/UpdateBanner';
import { WatchlistSidebar } from '../../components/Conflict/WatchlistSidebar';
import type { ConflictUpdateEvent } from '../../lib/conflict/types';
import styles from './page.module.css';

const WorldHeatMap = dynamic(
  () => import('../../components/Conflict/WorldHeatMap').then(m => m.WorldHeatMap),
  { ssr: false, loading: () => <div className={styles.mapSkeleton}>LOADING GEOSPATIAL LAYER…</div> }
);

const LinkGraph = dynamic(
  () => import('../../components/Conflict/LinkGraph').then(m => m.LinkGraph),
  { ssr: false, loading: () => <div className={styles.mapSkeleton}>LOADING LINK ANALYSIS…</div> }
);

const MissionWorkbook = dynamic(
  () => import('../../components/Conflict/MissionWorkbook').then(m => m.MissionWorkbook),
  { ssr: false }
);

type Tab = 'globe' | 'graph' | 'workbook';

const BOOTSTRAP_FLAG = 'conflict_bootstrapped';

interface RefreshResponse {
  ok?: boolean;
  schemaMissing?: boolean;
  hint?: string;
  error?: string;
}

function BootstrapOverlay() {
  return (
    <div className={styles.bootstrapOverlay}>
      <div className={styles.bootstrapCard}>
        <div className={styles.bootSpinner} />
        Bootstrapping ConflictLens — fetching advisories, news, and signals…
      </div>
    </div>
  );
}

function SchemaMissingPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.schemaMissingPanel}>
      <div className={styles.schemaMissingTitle}>CONFLICTLENS SCHEMA NOT APPLIED</div>
      <div className={styles.schemaMissingBody}>
        Run <code>supabase/schema.sql</code> in the Supabase SQL editor, then retry.
      </div>
      <button type="button" onClick={onRetry} className={styles.schemaMissingRetry}>
        Retry
      </button>
    </div>
  );
}

function ConflictBackendBanner({
  code, hint, usedAnonFallback, isMock,
}: {
  code: string | null;
  hint: string | null;
  usedAnonFallback: boolean;
  isMock: boolean;
}) {
  if (!code && !usedAnonFallback && !isMock) return null;

  const isError = code === 'supabase_unconfigured' ||
    code === 'heatmap_query_failed' || code === 'heatmap_fetch_failed' ||
    code === 'conflict_schema_missing' || code === 'conflict_no_country_rows';

  const cls = isError ? styles.backendBannerError : styles.backendBannerInfo;

  return (
    <div className={`${styles.backendBanner} ${cls}`}>
      <Shield size={12} className={styles.bannerIcon} />
      <div>
        {isMock && !code && (
          <div className={styles.bannerTitle}>DEMO MODE — Live Supabase data not connected</div>
        )}
        {code === 'supabase_unconfigured' && <div className={styles.bannerTitle}>Supabase not configured — showing demo data</div>}
        {code === 'conflict_schema_missing' && <div className={styles.bannerTitle}>ConflictLens tables missing</div>}
        {code === 'conflict_no_country_rows' && <div className={styles.bannerTitle}>Country data not seeded — showing demo data</div>}
        {code === 'heatmap_query_failed' && <div className={styles.bannerTitle}>Database query failed — showing demo data</div>}
        {usedAnonFallback && !isError && <div className={styles.bannerTitle}>Read-only Supabase mode</div>}
        {hint && <div className={styles.bannerHint}>{hint}</div>}
      </div>
    </div>
  );
}

export default function ConflictPage() {
  const {
    filteredCountries, countries,
    selectedCountry, fetchHeatmap, selectCountry,
    lastUpdated, isLoading, filters,
    heatmapApiError, heatmapApiHint, heatmapUsedAnonFallback,
  } = useConflictStore();

  const { unreadCount, markAllRead, alerts, hydrate, checkForAlerts } = useWatchlistStore();

  const [activeTab, setActiveTab] = useState<Tab>('globe');
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [isMockData, setIsMockData] = useState(false);
  const [connStatus, setConnStatus] = useState<'live' | 'mock' | 'offline'>('mock');
  const [operatorId] = useState(() => `OPR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
  const prevCountriesRef = useRef(countries);
  const eventSourceRef = useRef<EventSource | null>(null);
  const didBootstrapRef = useRef(false);

  // Hydrate watchlist from localStorage
  useEffect(() => { hydrate(); }, [hydrate]);

  // Fetch heatmap on mount + filter changes
  useEffect(() => { void fetchHeatmap(); }, [fetchHeatmap, filters.region, filters.stateDeptLevel]);

  // Detect mock vs live data
  useEffect(() => {
    if (heatmapApiError === 'supabase_unconfigured' || heatmapApiError === 'conflict_no_country_rows') {
      setIsMockData(true);
      setConnStatus('mock');
    } else if (filteredCountries.length > 0 && !heatmapApiError) {
      setIsMockData(false);
      setConnStatus('live');
    }
  }, [heatmapApiError, filteredCountries.length]);

  // Check watchlist alerts when countries update
  useEffect(() => {
    if (countries.length > 0 && prevCountriesRef.current.length > 0) {
      checkForAlerts(countries, prevCountriesRef.current);
    }
    prevCountriesRef.current = countries;
  }, [countries, checkForAlerts]);

  // Auto-bootstrap
  useEffect(() => {
    if (didBootstrapRef.current) return;
    if (isLoading) return;
    if (filteredCountries.length > 0) return;
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(BOOTSTRAP_FLAG) === '1') return;

    didBootstrapRef.current = true;
    void (async () => {
      setBootstrapping(true);
      setBannerMsg('Bootstrapping ConflictLens…');
      try {
        const resp = await fetch('/api/conflict/refresh?step=bootstrap', { method: 'POST' });
        const data = (await resp.json().catch(() => ({}))) as RefreshResponse;
        if (resp.status === 412 && data.schemaMissing) { setSchemaMissing(true); setBannerMsg(null); return; }
        if (!resp.ok || !data.ok) { setBannerMsg(data.error ?? 'Bootstrap failed'); return; }
        window.localStorage.setItem(BOOTSTRAP_FLAG, '1');
        await fetchHeatmap();
        setRefreshKey(k => k + 1);
        setBannerMsg('ConflictLens ready');
      } catch (e) {
        setBannerMsg(`Bootstrap error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [filteredCountries.length, isLoading, fetchHeatmap]);

  // SSE live updates
  useEffect(() => {
    function open() {
      const es = new EventSource('/api/conflict/stream');
      eventSourceRef.current = es;
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as ConflictUpdateEvent | { event: 'heartbeat' };
          if (data.event === 'scores_updated' || data.event === 'advisories_refreshed') {
            setBannerMsg(data.event === 'scores_updated' ? 'Risk scores updated' : 'Advisories refreshed');
            void fetchHeatmap();
            setRefreshKey(k => k + 1);
            setConnStatus('live');
          }
        } catch { /* ignore */ }
      };
      es.onerror = () => { es.close(); eventSourceRef.current = null; setTimeout(open, 5000); };
    }
    open();
    return () => { eventSourceRef.current?.close(); eventSourceRef.current = null; };
  }, [fetchHeatmap]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const resp = await fetch('/api/conflict/refresh?step=all', { method: 'POST' });
      if (resp.status === 412) setSchemaMissing(true);
      else setSchemaMissing(false);
    } catch { /* ignore */ }
    finally {
      await fetchHeatmap();
      setRefreshKey(k => k + 1);
      setRefreshing(false);
    }
  }, [fetchHeatmap]);

  const connDotClass = connStatus === 'live' ? styles.connLive
    : connStatus === 'mock' ? styles.connMock : styles.connOffline;

  return (
    <div className={styles.workspace}>
      {/* Classification banner */}
      <div className={styles.classificationBanner}>
        <span className={styles.classSep} />
        UNCLASSIFIED
        <span className={styles.classSep} />
        FOR DEMONSTRATION USE ONLY
        <span className={styles.classSep} />
        ATLASLAYER CONFLICTLENS v2
        <span className={styles.classSep} />
      </div>

      {/* Header */}
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>← Hub</Link>
        <div className={styles.headerSep} />
        <div className={styles.headerBrand}>
          <span className={styles.headerLogo}>ATLASLAYER</span>
          <span className={styles.headerProduct}>ConflictLens</span>
        </div>
        <div className={styles.headerSep} />
        <div className={styles.headerFilters}>
          <ConflictFilterBar onRefresh={onRefresh} isRefreshing={refreshing || isLoading} />
        </div>
        <div className={styles.headerRight}>
          <div className={styles.connStatus}>
            <div className={`${styles.connDot} ${connDotClass}`} />
            <span style={{ color: connStatus === 'live' ? '#22d3a5' : connStatus === 'mock' ? '#ffcc00' : '#ff3b3b' }}>
              {connStatus === 'live' ? 'LIVE' : connStatus === 'mock' ? 'DEMO' : 'OFFLINE'}
            </span>
          </div>
          {lastUpdated && (
            <span className={styles.syncTime}>
              {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <div style={{ position: 'relative' }}>
            <button
              className={styles.bellBtn}
              onClick={() => { setShowAlerts(v => !v); if (unreadCount > 0) markAllRead(); }}
            >
              <Bell size={13} />
              {unreadCount > 0 && <span className={styles.bellBadge}>{unreadCount}</span>}
            </button>
            {showAlerts && (
              <div className={styles.alertsDropdown}>
                <div className={styles.alertsDropHeader}>
                  WATCHLIST ALERTS
                  <button className={styles.alertsClearBtn} onClick={() => setShowAlerts(false)}>
                    Close
                  </button>
                </div>
                {alerts.slice(0, 8).map(a => (
                  <div key={a.id} className={styles.alertDropItem}>
                    <div>
                      <div className={styles.alertDropName}>{a.entityName}</div>
                      <div className={styles.alertDropMsg}>{a.message}</div>
                    </div>
                  </div>
                ))}
                {alerts.length === 0 && (
                  <div style={{ padding: '16px', fontSize: '0.65rem', color: '#1e2a3a', textAlign: 'center' }}>
                    No alerts
                  </div>
                )}
              </div>
            )}
          </div>
          <span style={{ fontSize: '0.58rem', color: '#1e2a3a' }}>{operatorId}</span>
        </div>
      </header>

      {/* Backend banner */}
      <ConflictBackendBanner
        code={heatmapApiError}
        hint={heatmapApiHint}
        usedAnonFallback={heatmapUsedAnonFallback}
        isMock={isMockData}
      />

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'globe' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('globe')}
        >
          <Globe size={12} /> Globe View
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'graph' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('graph')}
        >
          <BarChart2 size={12} /> Link Graph
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'workbook' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('workbook')}
        >
          <BookOpen size={12} /> Workbook
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* Watchlist sidebar */}
        <div className={styles.sidebarWrap}>
          <WatchlistSidebar />
        </div>

        {/* Content */}
        <div className={styles.contentArea}>
          {activeTab === 'globe' && (
            <div className={styles.globeLayout}>
              <section className={styles.mapSection}>
                <WorldHeatMap
                  key={refreshKey}
                  countries={filteredCountries}
                  onSelect={selectCountry}
                  selectedIso={selectedCountry?.iso_a2 ?? null}
                />
                <div className={styles.legendWrap}>
                  <RiskLegend lastUpdated={lastUpdated} />
                </div>
                <div className={styles.updateBannerWrap}>
                  <UpdateBanner message={bannerMsg} onDismiss={() => setBannerMsg(null)} />
                </div>
                {bootstrapping && <BootstrapOverlay />}
                {schemaMissing && <SchemaMissingPanel onRetry={onRefresh} />}
              </section>

              <div className={styles.dataRow}>
                <div className={styles.dataCell}>
                  <TopRiskTable
                    countries={filteredCountries}
                    onSelect={selectCountry}
                    selectedIso={selectedCountry?.iso_a2 ?? null}
                  />
                </div>
                <div className={styles.dataCell}>
                  <NewsSignalFeed refreshKey={refreshKey} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'graph' && (
            <div className={styles.fullPanel}>
              <LinkGraph
                countries={filteredCountries}
                onSelectCountry={(iso) => {
                  const c = filteredCountries.find(c => c.iso_a2 === iso);
                  if (c) { selectCountry(c); setActiveTab('globe'); }
                }}
              />
            </div>
          )}

          {activeTab === 'workbook' && (
            <div className={styles.fullPanel}>
              <MissionWorkbook />
            </div>
          )}
        </div>
      </div>

      {/* Country detail drawer */}
      <CountryDetailDrawer country={selectedCountry} onClose={() => selectCountry(null)} />
    </div>
  );
}
