import { getSupabaseAdmin } from './supabase';
import { cacheSet } from '../property-intelligence/cache';
import { CONFLICT_UPDATES_KEY } from './constants';
import { normalizeIso2 } from './iso';
import { computeMlViolenceScore } from './ml/safetyRiskModel';

export { CONFLICT_UPDATES_KEY } from './constants';

const CONFIDENCE_TIERS = [0.3, 0.5, 0.75, 0.95];
const HEATMAP_KEY_PREFIX = 'conflict:heatmap';
const NEWS_KEY_PREFIX = 'conflict:news';

interface ScoreData {
  country_iso: string;
  state_dept_level: number | null;
  news_conflict_score: number;
  social_signal_score: number;
  composite_score: number;
  confidence: number;
  data_sources: string[];
}

interface CountryRow { iso_a2: string; }

// ── Bulk data shapes ────────────────────────────────────────────────────────

interface AdvisoryBulkRow {
  country_iso: string;
  level: number;
  full_text: string | null;
  headline: string | null;
  fetched_at: string;
}

interface NewsBulkRow {
  country_iso: string | null;
  conflict_score: number | null;
}

interface SocialBulkRow {
  country_iso: string | null;
  sentiment: number | null;
}

interface AdvisoryMap {
  level: number;
  full_text: string | null;
  headline: string | null;
}

interface AggRow { avg: number; cnt: number; }

// ── Bulk fetchers ────────────────────────────────────────────────────────────

async function fetchAllLatestAdvisories(): Promise<Map<string, AdvisoryMap>> {
  const supabase = getSupabaseAdmin();
  // DISTINCT ON equivalent: fetch recent window (48h) and keep latest per country in JS
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('travel_advisories')
    .select('country_iso, level, full_text, headline, fetched_at')
    .gte('fetched_at', since)
    .order('fetched_at', { ascending: false });

  const map = new Map<string, AdvisoryMap>();
  if (error || !data) return map;

  for (const row of data as AdvisoryBulkRow[]) {
    const iso = normalizeIso2(row.country_iso);
    if (iso && !map.has(iso)) {
      map.set(iso, { level: row.level, full_text: row.full_text, headline: row.headline });
    }
  }
  return map;
}

async function fetchAllNewsAggregates(): Promise<Map<string, AggRow>> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('news_articles')
    .select('country_iso, conflict_score')
    .gte('ingested_at', since)
    .not('country_iso', 'is', null);

  const map = new Map<string, { sum: number; cnt: number }>();
  if (!error && data) {
    for (const row of data as NewsBulkRow[]) {
      const iso = normalizeIso2(row.country_iso ?? '');
      if (!iso) continue;
      const cur = map.get(iso) ?? { sum: 0, cnt: 0 };
      cur.sum += row.conflict_score ?? 0;
      cur.cnt += 1;
      map.set(iso, cur);
    }
  }
  const result = new Map<string, AggRow>();
  for (const [iso, { sum, cnt }] of map) {
    result.set(iso, { avg: cnt > 0 ? sum / cnt : 0, cnt });
  }
  return result;
}

async function fetchAllSocialAggregates(): Promise<Map<string, AggRow>> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('social_signals')
    .select('country_iso, sentiment')
    .gte('signal_at', since)
    .not('country_iso', 'is', null);

  const map = new Map<string, { sum: number; cnt: number }>();
  if (!error && data) {
    for (const row of data as SocialBulkRow[]) {
      const iso = normalizeIso2(row.country_iso ?? '');
      if (!iso) continue;
      const cur = map.get(iso) ?? { sum: 0, cnt: 0 };
      const s = row.sentiment ?? 0;
      const risk = s < -0.3 ? 0.8 : s < 0 ? 0.5 : 0.2;
      cur.sum += risk;
      cur.cnt += 1;
      map.set(iso, cur);
    }
  }
  const result = new Map<string, AggRow>();
  for (const [iso, { sum, cnt }] of map) {
    result.set(iso, { avg: cnt > 0 ? sum / cnt : 0, cnt });
  }
  return result;
}

// ── Score computation (uses pre-fetched bulk maps) ───────────────────────────

function computeScoreFromMaps(
  iso: string,
  advisories: Map<string, AdvisoryMap>,
  newsAggs: Map<string, AggRow>,
  socialAggs: Map<string, AggRow>,
): ScoreData {
  const adv = advisories.get(iso) ?? null;
  const level = adv?.level ?? null;
  const news = newsAggs.get(iso) ?? { avg: 0, cnt: 0 };
  const social = socialAggs.get(iso) ?? { avg: 0, cnt: 0 };

  const ml = computeMlViolenceScore({
    stateDeptLevel: level,
    advisoryFullText: adv?.full_text,
    advisoryHeadline: adv?.headline,
    newsRisk01: news.avg,
    socialRisk01: social.avg,
  });

  const signalsPresent =
    (level != null ? 1 : 0) +
    (news.cnt >= 5 ? 1 : 0) +
    (social.cnt >= 10 ? 1 : 0);
  const confidence = CONFIDENCE_TIERS[signalsPresent] ?? CONFIDENCE_TIERS[0]!;

  const sources: string[] = [];
  if (level != null) sources.push('state_dept');
  if (news.cnt > 0) sources.push('news');
  if (social.cnt > 0) sources.push('social');
  sources.push('ml_v1');

  return {
    country_iso: iso,
    state_dept_level: level,
    news_conflict_score: Number(news.avg.toFixed(4)),
    social_signal_score: Number(social.avg.toFixed(4)),
    composite_score: Number(ml.score.toFixed(4)),
    confidence,
    data_sources: sources,
  };
}

// ── Single-country export (used by heatmap API for on-demand refresh) ────────

export async function computeCompositeScore(iso: string): Promise<ScoreData> {
  const supabase = getSupabaseAdmin();
  const key = normalizeIso2(iso);

  const [advRes, newsRes, socialRes] = await Promise.all([
    supabase
      .from('travel_advisories')
      .select('level, full_text, headline')
      .eq('country_iso', key)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('news_articles')
      .select('conflict_score')
      .eq('country_iso', key)
      .gte('ingested_at', new Date(Date.now() - 6 * 3600 * 1000).toISOString()),
    supabase
      .from('social_signals')
      .select('sentiment')
      .eq('country_iso', key)
      .gte('signal_at', new Date(Date.now() - 3600 * 1000).toISOString()),
  ]);

  const adv = advRes.data as { level: number; full_text: string | null; headline: string | null } | null;
  const level = adv?.level ?? null;

  const newsRows = (newsRes.data ?? []) as Array<{ conflict_score: number | null }>;
  const newsAvg = newsRows.length
    ? newsRows.reduce((s, r) => s + (r.conflict_score ?? 0), 0) / newsRows.length
    : 0;

  const socialRows = (socialRes.data ?? []) as Array<{ sentiment: number | null }>;
  const socialAvg = socialRows.length
    ? socialRows.reduce((s, r) => {
        const v = r.sentiment ?? 0;
        return s + (v < -0.3 ? 0.8 : v < 0 ? 0.5 : 0.2);
      }, 0) / socialRows.length
    : 0;

  const ml = computeMlViolenceScore({
    stateDeptLevel: level,
    advisoryFullText: adv?.full_text,
    advisoryHeadline: adv?.headline,
    newsRisk01: newsAvg,
    socialRisk01: socialAvg,
  });

  const signalsPresent =
    (level != null ? 1 : 0) +
    (newsRows.length >= 5 ? 1 : 0) +
    (socialRows.length >= 10 ? 1 : 0);
  const confidence = CONFIDENCE_TIERS[signalsPresent] ?? CONFIDENCE_TIERS[0]!;

  const sources: string[] = [];
  if (level != null) sources.push('state_dept');
  if (newsRows.length > 0) sources.push('news');
  if (socialRows.length > 0) sources.push('social');
  sources.push('ml_v1');

  return {
    country_iso: key,
    state_dept_level: level,
    news_conflict_score: Number(newsAvg.toFixed(4)),
    social_signal_score: Number(socialAvg.toFixed(4)),
    composite_score: Number(ml.score.toFixed(4)),
    confidence,
    data_sources: sources,
  };
}

// ── Cache invalidation ───────────────────────────────────────────────────────

async function invalidateHeatmapCaches(): Promise<void> {
  await cacheSet('conflict:cache_version', String(Date.now()), 60 * 60 * 24);
  await cacheSet(`${HEATMAP_KEY_PREFIX}:invalidated_at`, new Date().toISOString(), 60 * 60 * 24);
  await cacheSet(`${NEWS_KEY_PREFIX}:invalidated_at`, new Date().toISOString(), 60 * 60 * 24);
}

export interface RecomputeResult {
  updated_count: number;
  duration_ms: number;
  timestamp: string;
}

/**
 * Recompute composite score for every country.
 * 3 bulk queries total (was N×3 queries before this refactor).
 */
export async function recomputeAllScores(): Promise<RecomputeResult> {
  const t0 = Date.now();
  const supabase = getSupabaseAdmin();

  const { data: countryRows, error } = await supabase.from('countries').select('iso_a2');
  if (error || !countryRows) {
    console.error('[scorer] failed to load countries', error);
    return { updated_count: 0, duration_ms: Date.now() - t0, timestamp: new Date().toISOString() };
  }

  // Bulk-fetch all signal data in parallel (3 queries regardless of country count)
  const [advisories, newsAggs, socialAggs] = await Promise.all([
    fetchAllLatestAdvisories(),
    fetchAllNewsAggregates(),
    fetchAllSocialAggregates(),
  ]);

  const updates: ScoreData[] = [];
  for (const row of countryRows as CountryRow[]) {
    const iso = normalizeIso2(row.iso_a2);
    if (!iso) continue;
    try {
      updates.push(computeScoreFromMaps(iso, advisories, newsAggs, socialAggs));
    } catch (e) {
      console.warn(`[scorer] compute failed for ${row.iso_a2}`, String(e));
    }
  }

  if (updates.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK).map((u) => ({
        country_iso: u.country_iso,
        state_dept_level: u.state_dept_level,
        news_conflict_score: u.news_conflict_score,
        social_signal_score: u.social_signal_score,
        composite_score: u.composite_score,
        confidence: u.confidence,
        data_sources: u.data_sources,
      }));
      const { error: insErr } = await supabase.from('conflict_risk_scores').insert(chunk);
      if (insErr) console.error('[scorer] insert chunk failed', insErr);
    }
  }

  const timestamp = new Date().toISOString();
  await invalidateHeatmapCaches();
  await cacheSet(
    CONFLICT_UPDATES_KEY,
    { event: 'scores_updated', updated_count: updates.length, timestamp },
    60 * 60
  );

  return { updated_count: updates.length, duration_ms: Date.now() - t0, timestamp };
}
