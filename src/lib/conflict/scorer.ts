import { getSupabaseAdmin } from './supabase';
import { cacheSet } from '../property-intelligence/cache';
import { CONFLICT_UPDATES_KEY } from './constants';
import { normalizeIso2 } from './iso';
import { computeMlViolenceScore } from './ml/safetyRiskModel';

/** Re-export for callers that already depend on this path. */
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

interface CountryRow {
  iso_a2: string;
}

interface AdvisoryRow {
  level: number;
  full_text: string | null;
  headline: string | null;
}

interface AggRow {
  avg: number | null;
  cnt: number | null;
}

async function getLatestAdvisory(iso: string): Promise<AdvisoryRow | null> {
  const supabase = getSupabaseAdmin();
  const key = normalizeIso2(iso);
  const { data, error } = await supabase
    .from('travel_advisories')
    .select('level, full_text, headline')
    .eq('country_iso', key)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as AdvisoryRow;
}

async function getNewsAggregate(iso: string): Promise<AggRow> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const key = normalizeIso2(iso);
  const { data, error } = await supabase
    .from('news_articles')
    .select('conflict_score')
    .eq('country_iso', key)
    .gte('ingested_at', since);

  if (error || !data || data.length === 0) return { avg: 0, cnt: 0 };
  let sum = 0;
  for (const row of data as Array<{ conflict_score: number | null }>) {
    sum += row.conflict_score ?? 0;
  }
  return { avg: sum / data.length, cnt: data.length };
}

async function getSocialAggregate(iso: string): Promise<AggRow> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const key = normalizeIso2(iso);
  const { data, error } = await supabase
    .from('social_signals')
    .select('sentiment')
    .eq('country_iso', key)
    .gte('signal_at', since);

  if (error || !data || data.length === 0) return { avg: 0, cnt: 0 };
  let sum = 0;
  for (const row of data as Array<{ sentiment: number | null }>) {
    const s = row.sentiment ?? 0;
    if (s < -0.3) sum += 0.8;
    else if (s < 0) sum += 0.5;
    else sum += 0.2;
  }
  return { avg: sum / data.length, cnt: data.length };
}

export async function computeCompositeScore(iso: string): Promise<ScoreData> {
  const adv = await getLatestAdvisory(iso);
  const level = adv?.level ?? null;

  const news = await getNewsAggregate(iso);
  const social = await getSocialAggregate(iso);

  const ml = computeMlViolenceScore({
    stateDeptLevel: level,
    advisoryFullText: adv?.full_text,
    advisoryHeadline: adv?.headline,
    newsRisk01: news.avg ?? 0,
    socialRisk01: social.avg ?? 0,
  });

  const composite = ml.score;

  const signalsPresent =
    (level != null ? 1 : 0) + ((news.cnt ?? 0) >= 5 ? 1 : 0) + ((social.cnt ?? 0) >= 10 ? 1 : 0);
  const confidence = CONFIDENCE_TIERS[signalsPresent] ?? CONFIDENCE_TIERS[0]!;

  const sources: string[] = [];
  if (level != null) sources.push('state_dept');
  if ((news.cnt ?? 0) > 0) sources.push('news');
  if ((social.cnt ?? 0) > 0) sources.push('social');
  sources.push('ml_v1');

  return {
    country_iso: normalizeIso2(iso),
    state_dept_level: level,
    news_conflict_score: Number((news.avg ?? 0).toFixed(4)),
    social_signal_score: Number((social.avg ?? 0).toFixed(4)),
    composite_score: Number(composite.toFixed(4)),
    confidence,
    data_sources: sources,
  };
}

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

/** Recompute composite score for every country and persist + invalidate. */
export async function recomputeAllScores(): Promise<RecomputeResult> {
  const t0 = Date.now();
  const supabase = getSupabaseAdmin();

  const { data: countryRows, error } = await supabase.from('countries').select('iso_a2');

  if (error || !countryRows) {
    console.error('[scorer] failed to load countries', error);
    return { updated_count: 0, duration_ms: Date.now() - t0, timestamp: new Date().toISOString() };
  }

  const updates: ScoreData[] = [];
  for (const row of countryRows as CountryRow[]) {
    try {
      const iso = normalizeIso2(row.iso_a2);
      if (!iso) continue;
      const score = await computeCompositeScore(iso);
      updates.push(score);
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
      if (insErr) {
        console.error('[scorer] insert chunk failed', insErr);
      }
    }
  }

  const timestamp = new Date().toISOString();
  await invalidateHeatmapCaches();
  await cacheSet(
    CONFLICT_UPDATES_KEY,
    {
      event: 'scores_updated',
      updated_count: updates.length,
      timestamp,
    },
    60 * 60
  );

  return {
    updated_count: updates.length,
    duration_ms: Date.now() - t0,
    timestamp,
  };
}
