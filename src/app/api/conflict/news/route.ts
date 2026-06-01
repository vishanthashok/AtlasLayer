import { NextResponse } from 'next/server';
import { getConflictReadSupabase } from '../../../../lib/conflict/supabase';
import { conflictSchemaMissingHint, isConflictSchemaMissingError } from '../../../../lib/conflict/supabaseErrors';
import { cacheGet, cacheSet } from '../../../../lib/property-intelligence/cache';
import type { ConflictNewsApiResponse, NewsSignal } from '../../../../lib/conflict/types';
import { MOCK_NEWS } from '../../../../lib/conflict/mockData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_TTL = 60 * 2; // 2 min
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const NEWS_CACHE_NS = 'v3';

const HINT_SUPABASE =
  'Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY for read-only. Apply the ConflictLens block in supabase/schema.sql.';

interface NewsRow {
  id: string;
  country_iso: string | null;
  source_name: string | null;
  title: string;
  url: string | null;
  published_at: string | null;
  ingested_at: string;
  sentiment_score: number | null;
  conflict_score: number | null;
  keywords: string[] | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const countryIso = url.searchParams.get('country_iso');
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(url.searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT)
  );

  const { client: supabase, used_anon_fallback } = getConflictReadSupabase();
  if (!supabase) {
    const articles = countryIso
      ? MOCK_NEWS.filter(a => a.country_iso === countryIso.toUpperCase())
      : MOCK_NEWS;
    return NextResponse.json({ articles: articles.slice(0, limit), mock: true } as ConflictNewsApiResponse & { mock: boolean });
  }

  const cacheKey = `conflict:news:${NEWS_CACHE_NS}:${countryIso ?? '*'}:${limit}:${used_anon_fallback ? 'anon' : 'srv'}`;
  const cached = await cacheGet<ConflictNewsApiResponse>(cacheKey);
  if (cached && !cached.error) return NextResponse.json(cached);

  let query = supabase
    .from('news_articles')
    .select(
      'id, country_iso, source_name, title, url, published_at, ingested_at, sentiment_score, conflict_score, keywords'
    )
    .order('conflict_score', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (countryIso) query = query.eq('country_iso', countryIso.toUpperCase());

  let data: unknown[] | null = null;
  let error: { code?: string; message?: string } | null = null;
  try {
    const res = await query;
    data = res.data;
    error = res.error;
  } catch (networkErr) {
    console.error('[news] network error — falling back to mock', networkErr);
    const articles = countryIso
      ? MOCK_NEWS.filter(a => a.country_iso === countryIso.toUpperCase())
      : MOCK_NEWS;
    return NextResponse.json({ articles: articles.slice(0, limit), mock: true });
  }
  if (error) {
    console.error('[news] query failed', error);
    if (isConflictSchemaMissingError(error)) {
      const body: ConflictNewsApiResponse = {
        articles: [],
        error: 'conflict_schema_missing',
        hint: conflictSchemaMissingHint(),
        used_anon_fallback,
      };
      return NextResponse.json(body);
    }
    const body: ConflictNewsApiResponse = {
      articles: [],
      error: 'news_query_failed',
      hint: error.message || 'Check news_articles table and grants.',
      used_anon_fallback,
    };
    return NextResponse.json(body);
  }

  const articles: NewsSignal[] = ((data ?? []) as NewsRow[]).map((r) => ({
    id: r.id,
    country_iso: r.country_iso,
    source_name: r.source_name,
    title: r.title,
    url: r.url,
    published_at: r.published_at ?? r.ingested_at,
    sentiment_score: r.sentiment_score,
    conflict_score: r.conflict_score,
    keywords: r.keywords,
  }));

  const body: ConflictNewsApiResponse = {
    articles,
    ...(used_anon_fallback ? { used_anon_fallback: true } : {}),
    ...(articles.length === 0
      ? {
          empty_feed_hint:
            'No articles in the database yet. With SUPABASE_SERVICE_ROLE_KEY set, run bootstrap (POST /api/conflict/refresh?step=bootstrap) or use Refresh — news ingests after countries are seeded.',
        }
      : {}),
  };
  if (!body.error) {
    await cacheSet(cacheKey, body, CACHE_TTL);
  }
  return NextResponse.json(body);
}
