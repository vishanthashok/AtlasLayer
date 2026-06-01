'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Star, StarOff, X, Shield, TrendingUp, TrendingDown, AlertTriangle, Activity } from 'lucide-react';
import type { CountryRisk, CountryTimeSeriesResponse } from '../../lib/conflict/types';
import { StateDeptBadge } from './StateDeptBadge';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { NewsSignalFeed } from './NewsSignalFeed';
import { scoreToColor, LEVEL_LABEL } from './colors';
import { useWatchlistStore } from '../../store/useWatchlistStore';
import styles from './CountryDetailDrawer.module.css';

interface Props {
  country: CountryRisk | null;
  onClose: () => void;
}

export function CountryDetailDrawer({ country, onClose }: Props) {
  if (!country) return null;
  return <DrawerContent key={country.iso_a2} country={country} onClose={onClose} />;
}

type DrawerTab = 'overview' | 'threats' | 'timeline' | 'news';

// Static threat intel per category (would be dynamic in production with real DB data)
function getThreatData(iso: string) {
  const highRiskActors: Record<string, string[]> = {
    SY: ['ISIS remnants', 'Hayat Tahrir al-Sham', 'Syrian Arab Army'],
    IQ: ['ISIS cells', 'Popular Mobilization Forces', 'Kurdish militias'],
    AF: ['Taliban', 'Al-Qaeda', 'ISIS-K'],
    YE: ['Houthi movement', 'Al-Qaeda in the Arabian Peninsula'],
    LY: ['GNU-aligned forces', 'LNA (Haftar)', 'Tribal militias'],
    UA: ['Russian Armed Forces', 'Wagner remnants', 'Separatist militias'],
    MM: ['Tatmadaw junta', 'PDF resistance', 'Ethnic armed orgs'],
    SS: ['SSPDF', 'SPLA-IO', 'Various militias'],
    SO: ['Al-Shabaab', 'ISIL Somalia', 'Clan militias'],
    PS: ['Hamas', 'Palestinian Islamic Jihad', 'IDF operations'],
    LB: ['Hezbollah', 'Lebanese Armed Forces', 'Palestinian factions'],
    CF: ['Wagner Group', 'Séléka remnants', 'Anti-balaka'],
    ML: ['Wagner/Africa Corps', 'JNIM', 'GSIM'],
    NG: ['Boko Haram', 'ISWAP', 'Bandits'],
    SD: ['SAF', 'RSF (Rapid Support Forces)', 'Armed rebel factions'],
  };

  const zones: Record<string, string[]> = {
    SY: ['Idlib', 'Deir ez-Zor', 'Eastern Euphrates'],
    UA: ['Donetsk', 'Luhansk', 'Zaporizhzhia', 'Kherson'],
    AF: ['Helmand', 'Kandahar', 'Kabul perimeter'],
    YE: ['Marib', 'Hodeidah', 'Aden'],
    IQ: ['Anbar', 'Ninewa', 'Kirkuk'],
    PS: ['Gaza City', 'Rafah', 'West Bank checkpoints'],
    LY: ['Tripoli', 'Benghazi', 'Sabha'],
    MM: ['Chin', 'Sagaing', 'Rakhine'],
    SS: ['Jonglei', 'Unity State', 'Upper Nile'],
    SO: ['Lower Shabelle', 'Bakool', 'Bay'],
  };

  const infra: Record<string, { score: number; notes: string[] }> = {
    UA: { score: 0.72, notes: ['Power grid under sustained attack', 'Rail disruptions active'] },
    SY: { score: 0.88, notes: ['Water infrastructure severely damaged', 'Medical facilities targeted'] },
    YE: { score: 0.85, notes: ['Port blockade impacting supplies', 'Power grid collapse'] },
    SD: { score: 0.70, notes: ['Internet outages reported', 'Banking system disrupted'] },
  };

  return {
    actors: highRiskActors[iso] ?? [],
    zones: zones[iso] ?? [],
    infra: infra[iso] ?? { score: 0, notes: [] },
  };
}

function DrawerContent({ country, onClose }: { country: CountryRisk; onClose: () => void }) {
  const [tab, setTab] = useState<DrawerTab>('overview');
  const [series, setSeries] = useState<CountryTimeSeriesResponse | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const { isWatched, toggleWatchlist } = useWatchlistStore();

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/conflict/country/${country.iso_a2}/timeseries?days=90`, { signal: ac.signal })
      .then(r => r.json() as Promise<CountryTimeSeriesResponse>)
      .then(d => setSeries(d))
      .catch(e => { if (e?.name !== 'AbortError') console.warn('[drawer] timeseries failed', e); })
      .finally(() => setLoadingSeries(false));
    return () => ac.abort();
  }, [country.iso_a2]);

  const chartData = (series?.series ?? []).map(p => ({
    t: new Date(p.timestamp).toLocaleDateString(),
    score: +(p.composite_score * 100).toFixed(1),
  }));

  const composite = (country.composite_score * 100).toFixed(0);
  const compositeColor = scoreToColor(country.composite_score);
  const watched = isWatched(country.iso_a2);
  const threat = getThreatData(country.iso_a2);

  const trend = chartData.length >= 2
    ? chartData[chartData.length - 1].score - chartData[0].score
    : 0;

  return (
    <aside className={styles.drawer}>
      {/* Header */}
      <div className={styles.drawerHeader}>
        <img
          src={`https://flagcdn.com/w80/${country.iso_a2.toLowerCase()}.png`}
          alt="" width={40} height={27}
          className={styles.flag}
        />
        <div className={styles.drawerTitle}>
          <div className={styles.drawerCountry}>{country.name}</div>
          <div className={styles.drawerRegion}>{country.region ?? 'Unknown'} · {country.iso_a2} · {country.iso_a3}</div>
        </div>
        <button
          className={`${styles.watchBtn} ${watched ? styles.watchBtnActive : ''}`}
          onClick={() => toggleWatchlist(country.iso_a2)}
          title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          {watched ? <StarOff size={14} /> : <Star size={14} />}
        </button>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      {/* Risk gauge */}
      <div className={styles.riskGauge}>
        <div className={styles.gaugeCircle} style={{ borderColor: compositeColor, boxShadow: `0 0 20px ${compositeColor}33` }}>
          <span className={styles.gaugeValue} style={{ color: compositeColor }}>{composite}</span>
          <span className={styles.gaugeLabel}>/ 100</span>
        </div>
        <div className={styles.gaugeRight}>
          <StateDeptBadge level={country.state_dept_level} />
          {country.state_dept_level && (
            <div className={styles.levelText}>{LEVEL_LABEL[country.state_dept_level]}</div>
          )}
          <ConfidenceIndicator value={country.confidence} />
          <div className={styles.safetyScore}>
            Safety Index: <strong style={{ color: '#22d3a5' }}>{country.safety_score}</strong>/100
          </div>
          {trend !== 0 && (
            <div className={styles.trend} style={{ color: trend > 0 ? '#ff3b3b' : '#22d3a5' }}>
              {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trend).toFixed(1)} pts over 90d
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        {([
          { id: 'overview', icon: <Shield size={11} />, label: 'Overview' },
          { id: 'threats', icon: <AlertTriangle size={11} />, label: 'Threats' },
          { id: 'timeline', icon: <Activity size={11} />, label: 'Timeline' },
          { id: 'news', icon: null, label: 'Intel Feed' },
        ] as const).map(t => (
          <button
            key={t.id}
            className={`${styles.tabBtn} ${tab === t.id ? styles.tabBtnActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.tabContent}>

        {/* Overview */}
        {tab === 'overview' && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>RISK BREAKDOWN</div>
            <div className={styles.metricsGrid}>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>State Dept</div>
                <div className={styles.metricValue} style={{ color: '#ff8c00' }}>
                  Level {country.state_dept_level ?? '—'}
                </div>
              </div>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>News Conflict</div>
                <div className={styles.metricValue}>
                  {country.news_conflict_score != null
                    ? (country.news_conflict_score * 100).toFixed(0)
                    : '—'}
                </div>
              </div>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>Social Signal</div>
                <div className={styles.metricValue}>
                  {country.social_signal_score != null
                    ? (country.social_signal_score * 100).toFixed(0)
                    : '—'}
                </div>
              </div>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>Composite</div>
                <div className={styles.metricValue} style={{ color: compositeColor }}>
                  {composite}
                </div>
              </div>
            </div>

            <div className={styles.sectionTitle} style={{ marginTop: 14 }}>DATA SOURCES</div>
            <div className={styles.sourceTags}>
              {country.data_sources.map(s => (
                <span key={s} className={styles.sourceTag}>{s.toUpperCase()}</span>
              ))}
            </div>

            <a
              href={`https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/${country.name.toLowerCase().replace(/\s+/g, '-')}-travel-advisory.html`}
              target="_blank" rel="noopener noreferrer"
              className={styles.advisoryLink}
            >
              View Official State Dept Advisory →
            </a>
          </div>
        )}

        {/* Threats */}
        {tab === 'threats' && (
          <div className={styles.section}>
            {threat.actors.length > 0 && (
              <>
                <div className={styles.sectionTitle}>ACTIVE THREAT ACTORS</div>
                <div className={styles.threatList}>
                  {threat.actors.map(a => (
                    <div key={a} className={styles.threatItem}>
                      <AlertTriangle size={10} style={{ color: '#ff3b3b', flexShrink: 0 }} />
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {threat.zones.length > 0 && (
              <>
                <div className={styles.sectionTitle} style={{ marginTop: 14 }}>ACTIVE CONFLICT ZONES</div>
                <div className={styles.zoneList}>
                  {threat.zones.map(z => (
                    <span key={z} className={styles.zoneTag}>{z}</span>
                  ))}
                </div>
              </>
            )}

            {threat.infra.score > 0 && (
              <>
                <div className={styles.sectionTitle} style={{ marginTop: 14 }}>INFRASTRUCTURE RISK</div>
                <div className={styles.infraScore}>
                  <div className={styles.infraBar}>
                    <div
                      className={styles.infraBarFill}
                      style={{
                        width: `${threat.infra.score * 100}%`,
                        background: scoreToColor(threat.infra.score),
                      }}
                    />
                  </div>
                  <span style={{ color: scoreToColor(threat.infra.score), fontSize: '0.7rem' }}>
                    {(threat.infra.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className={styles.infraNotes}>
                  {threat.infra.notes.map(n => (
                    <div key={n} className={styles.infraNote}>· {n}</div>
                  ))}
                </div>
              </>
            )}

            {threat.actors.length === 0 && threat.zones.length === 0 && (
              <div className={styles.noData}>No structured threat data available for this country.</div>
            )}
          </div>
        )}

        {/* Timeline */}
        {tab === 'timeline' && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>90-DAY RISK TREND</div>
            <div className={styles.chartWrap}>
              {chartData.length === 0 ? (
                <div className={styles.noData}>
                  {loadingSeries ? 'Loading timeline…' : 'No historical data available yet.'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="t" hide />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(6,9,18,0.97)',
                        border: '1px solid rgba(0,212,255,0.2)',
                        borderRadius: 0,
                        fontSize: '0.65rem',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                      formatter={(v) => [`${v}/100`, 'Risk']}
                    />
                    <ReferenceLine y={75} stroke="rgba(255,59,59,0.2)" strokeDasharray="3 3" />
                    <ReferenceLine y={50} stroke="rgba(255,140,0,0.2)" strokeDasharray="3 3" />
                    <Line
                      type="monotone" dataKey="score"
                      stroke={compositeColor} strokeWidth={1.5}
                      dot={false} isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            {chartData.length > 0 && (
              <div className={styles.timelineStats}>
                <span>Min: <strong>{Math.min(...chartData.map(d => d.score)).toFixed(0)}</strong></span>
                <span>Max: <strong>{Math.max(...chartData.map(d => d.score)).toFixed(0)}</strong></span>
                <span>Current: <strong style={{ color: compositeColor }}>{composite}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Intel Feed */}
        {tab === 'news' && (
          <div className={styles.newsFeedWrap}>
            <NewsSignalFeed countryIso={country.iso_a2} />
          </div>
        )}
      </div>
    </aside>
  );
}
