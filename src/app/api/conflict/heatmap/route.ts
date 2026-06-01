import { NextResponse } from 'next/server';
import { getConflictReadSupabase } from '../../../../lib/conflict/supabase';
import { conflictSchemaMissingHint, isConflictSchemaMissingError } from '../../../../lib/conflict/supabaseErrors';
import { cacheGet, cacheSet } from '../../../../lib/property-intelligence/cache';
import type { ConflictHeatMapResponse } from '../../../../lib/conflict/types';
import {
  mergeCountriesWithLatestScores,
  type CountryRowDb,
  type LatestScoreRowDb,
} from '../../../../lib/conflict/heatmapMerge';
import { MOCK_COUNTRIES } from '../../../../lib/conflict/mockData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_TTL = 60 * 5; // 5 minutes

/** Bump when response semantics change — avoids serving legacy cached empty payloads without `error`. */
const HEATMAP_CACHE_NS = 'v5';

const HINT_SUPABASE =
  'Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY for full ConflictLens (ingestion + reads). For read-only, NEXT_PUBLIC_SUPABASE_ANON_KEY is enough if the ConflictLens tables grant SELECT to anon (see supabase/schema.sql). Run the ConflictLens SQL block before first use.';

function emptyPayload(extra?: Partial<ConflictHeatMapResponse>): ConflictHeatMapResponse {
  return {
    countries: [],
    generated_at: new Date().toISOString(),
    total_countries: 0,
    cache_ttl_seconds: CACHE_TTL,
    ...extra,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const region = url.searchParams.get('region');
  const minScore = parseFloat(url.searchParams.get('min_score') ?? '0');
  const maxScore = parseFloat(url.searchParams.get('max_score') ?? '1');
  const levelRaw = url.searchParams.get('level');
  const level = levelRaw ? parseInt(levelRaw, 10) : null;

  const { client: supabase, used_anon_fallback } = getConflictReadSupabase();
  if (!supabase) {
    // Return mock data so the UI always renders — Supabase not configured
    const filtered = MOCK_COUNTRIES.filter(c =>
      (!region || c.region === region) &&
      c.composite_score >= minScore &&
      c.composite_score <= maxScore &&
      (level == null || c.state_dept_level === level)
    );
    return NextResponse.json({
      countries: filtered,
      generated_at: new Date().toISOString(),
      total_countries: filtered.length,
      cache_ttl_seconds: CACHE_TTL,
      mock: true,
    } satisfies ConflictHeatMapResponse & { mock: boolean });
  }

  const cacheVersion = (await cacheGet<string>('conflict:cache_version')) ?? '0';
  const cacheKey = `conflict:heatmap:${HEATMAP_CACHE_NS}:${cacheVersion}:${region ?? '*'}:${minScore}:${maxScore}:${level ?? '*'}:${used_anon_fallback ? 'anon' : 'srv'}`;

  const cached = await cacheGet<ConflictHeatMapResponse>(cacheKey);
  if (cached && !cached.error) {
    return NextResponse.json(cached);
  }

  let countriesRes;
  let scoresRes;
  try {
    [countriesRes, scoresRes] = await Promise.all([
      supabase.from('countries').select('iso_a2, iso_a3, name, region'),
      supabase
        .from('latest_conflict_scores')
        .select(
          'country_iso, composite_score, state_dept_level, news_conflict_score, social_signal_score, confidence, scored_at, data_sources'
        ),
    ]);
  } catch (networkErr) {
    console.error('[heatmap] network error — falling back to mock data', networkErr);
    const filtered = MOCK_COUNTRIES.filter(c =>
      (!region || c.region === region) &&
      c.composite_score >= minScore &&
      c.composite_score <= maxScore &&
      (level == null || c.state_dept_level === level)
    );
    return NextResponse.json({
      countries: filtered,
      generated_at: new Date().toISOString(),
      total_countries: filtered.length,
      cache_ttl_seconds: CACHE_TTL,
      mock: true,
    });
  }

  if (countriesRes.error) {
    console.error('[heatmap] countries query failed', countriesRes.error);
    if (isConflictSchemaMissingError(countriesRes.error)) {
      return NextResponse.json(
        emptyPayload({
          error: 'conflict_schema_missing',
          hint: conflictSchemaMissingHint(),
          used_anon_fallback,
        })
      );
    }
    return NextResponse.json(
      emptyPayload({
        error: 'heatmap_query_failed',
        hint:
          countriesRes.error.message ||
          'Check ConflictLens schema (countries table) and Supabase credentials.',
        used_anon_fallback,
      })
    );
  }
  if (scoresRes.error) {
    console.error('[heatmap] latest_conflict_scores query failed', scoresRes.error);
    if (isConflictSchemaMissingError(scoresRes.error)) {
      return NextResponse.json(
        emptyPayload({
          error: 'conflict_schema_missing',
          hint: conflictSchemaMissingHint(),
          used_anon_fallback,
        })
      );
    }
    return NextResponse.json(
      emptyPayload({
        error: 'heatmap_query_failed',
        hint:
          scoresRes.error.message ||
          'Check latest_conflict_scores view and conflict_risk_scores table.',
        used_anon_fallback,
      })
    );
  }

  const countryRows = (countriesRes.data ?? []) as CountryRowDb[];
  const scoreRows = (scoresRes.data ?? []) as LatestScoreRowDb[];

  if (countryRows.length === 0) {
    return NextResponse.json(
      emptyPayload({
        error: 'conflict_no_country_rows',
        hint:
          'The countries table is empty (nothing seeded yet). Set SUPABASE_SERVICE_ROLE_KEY in .env.local, restart the dev server, then POST /api/conflict/refresh?step=bootstrap or click Refresh. If this persists, run localStorage.removeItem("conflict_bootstrapped") in the browser console and reload so auto-bootstrap can retry.',
        used_anon_fallback,
      })
    );
  }

  const countries = mergeCountriesWithLatestScores(countryRows, scoreRows, {
    region,
    minScore,
    maxScore,
    level,
  });

  const body: ConflictHeatMapResponse = {
    countries,
    generated_at: new Date().toISOString(),
    total_countries: countries.length,
    cache_ttl_seconds: CACHE_TTL,
    ...(used_anon_fallback ? { used_anon_fallback: true } : {}),
  };

  if (!body.error) {
    await cacheSet(cacheKey, body, CACHE_TTL);
  }
  return NextResponse.json(body);
}
