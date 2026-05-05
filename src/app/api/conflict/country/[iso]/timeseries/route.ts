import { NextResponse } from 'next/server';
import { tryGetSupabaseAdmin } from '../../../../../../lib/conflict/supabase';
import { cacheGet, cacheSet } from '../../../../../../lib/property-intelligence/cache';
import type { CountryTimeSeriesResponse } from '../../../../../../lib/conflict/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_TTL = 60 * 60; // 1h

interface ScoreRow {
  scored_at: string;
  composite_score: number | null;
  state_dept_level: number | null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ iso: string }> }
) {
  const { iso: isoRaw } = await params;
  const iso = (isoRaw || '').trim().toUpperCase();
  if (iso.length !== 2) {
    return NextResponse.json({ error: 'iso must be a 2-letter country code' }, { status: 400 });
  }

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days') ?? '30', 10) || 30));

  const supabase = tryGetSupabaseAdmin();
  if (!supabase) {
    const empty: CountryTimeSeriesResponse = {
      country_iso: iso,
      country_name: '',
      series: [],
    };
    return NextResponse.json(empty);
  }

  const cacheKey = `conflict:ts:${iso}:${days}`;
  const cached = await cacheGet<CountryTimeSeriesResponse>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: country }, { data: scores, error }] = await Promise.all([
    supabase.from('countries').select('name').eq('iso_a2', iso).maybeSingle(),
    supabase
      .from('conflict_risk_scores')
      .select('scored_at, composite_score, state_dept_level')
      .eq('country_iso', iso)
      .gte('scored_at', since)
      .order('scored_at', { ascending: true }),
  ]);

  if (error) {
    console.error('[timeseries] query failed', error);
  }

  const body: CountryTimeSeriesResponse = {
    country_iso: iso,
    country_name: (country as { name?: string } | null)?.name ?? iso,
    series: ((scores ?? []) as ScoreRow[]).map((r) => ({
      timestamp: r.scored_at,
      composite_score: r.composite_score ?? 0,
      state_dept_level: r.state_dept_level,
    })),
  };

  await cacheSet(cacheKey, body, CACHE_TTL);
  return NextResponse.json(body);
}
