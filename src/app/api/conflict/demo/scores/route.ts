import { NextResponse } from 'next/server';
import { tryGetSupabaseAdmin } from '../../../../../lib/conflict/supabase';
import {
  demoEnvelope,
  mergeCountriesWithLatestScores,
  type CountryRowDb,
  type LatestScoreRowDb,
} from '../../../../../lib/conflict/heatmapMerge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Demo / integration endpoint: all country violence & safety scores in real time.
 * Bypasses Redis heatmap cache so dashboards always see fresh DB state.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const region = url.searchParams.get('region');

  const supabase = tryGetSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Supabase is not configured for ConflictLens' },
      { status: 503 }
    );
  }

  const [countriesRes, scoresRes] = await Promise.all([
    supabase.from('countries').select('iso_a2, iso_a3, name, region'),
    supabase
      .from('latest_conflict_scores')
      .select(
        'country_iso, composite_score, state_dept_level, news_conflict_score, social_signal_score, confidence, scored_at, data_sources'
      ),
  ]);

  if (countriesRes.error || scoresRes.error) {
    return NextResponse.json(
      {
        ok: false,
        error: countriesRes.error?.message ?? scoresRes.error?.message ?? 'query_failed',
      },
      { status: 500 }
    );
  }

  const countries = mergeCountriesWithLatestScores(
    (countriesRes.data ?? []) as CountryRowDb[],
    (scoresRes.data ?? []) as LatestScoreRowDb[],
    {
      region,
      minScore: 0,
      maxScore: 1,
      level: null,
    }
  );

  return NextResponse.json(demoEnvelope(countries), {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
