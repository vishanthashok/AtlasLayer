import { NextResponse } from 'next/server';
import { fetchAllAdvisories } from '../../../../lib/conflict/ingest/stateDept';
import { ingestAllNews } from '../../../../lib/conflict/ingest/news';
import { fetchRedditSignals } from '../../../../lib/conflict/ingest/social';
import { recomputeAllScores } from '../../../../lib/conflict/scorer';
import { seedCountriesIfEmpty } from '../../../../lib/conflict/seedCountries';
import { tryGetSupabaseAdmin } from '../../../../lib/conflict/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Step = 'state_dept' | 'news' | 'social' | 'score' | 'all' | 'bootstrap';

const SCHEMA_MISSING_HINT =
  'ConflictLens schema is not applied. Run supabase/schema.sql in the Supabase SQL editor, then retry.';

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail-closed in production; allow in local dev only.
    if (process.env.NODE_ENV !== 'production') return true;
    console.warn('[refresh] CRON_SECRET not set — blocking request in production');
    return false;
  }
  const auth = req.headers.get('authorization') || '';
  if (auth === `Bearer ${secret}`) return true;
  const vercelHeader = req.headers.get('x-vercel-cron-authorization');
  if (vercelHeader === secret) return true;
  return false;
}

interface PgErrorLike {
  code?: string;
  message?: string;
}

function isMissingTableError(e: unknown): boolean {
  if (!e) return false;
  const err = e as PgErrorLike;
  if (err.code === '42P01') return true;
  if (typeof err.message === 'string' && /relation .* does not exist/i.test(err.message)) {
    return true;
  }
  return false;
}

async function preflightSchemaCheck(): Promise<boolean> {
  const supabase = tryGetSupabaseAdmin();
  if (!supabase) return true; // env missing — surface that error elsewhere
  const { error } = await supabase
    .from('countries')
    .select('iso_a2', { count: 'exact', head: true });
  if (!error) return true;
  if (isMissingTableError(error)) return false;
  return true;
}

async function safeRun<T>(label: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (isMissingTableError(e)) {
      throw e; // bubble up so caller can surface schemaMissing
    }
    console.error(`[refresh] ${label} failed`, e);
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function runStep(step: Step): Promise<unknown> {
  switch (step) {
    case 'state_dept':
      return fetchAllAdvisories();
    case 'news':
      return ingestAllNews();
    case 'social':
      return fetchRedditSignals();
    case 'score':
      return recomputeAllScores();
    case 'all': {
      const stateDept = await safeRun('state_dept', fetchAllAdvisories);
      const news = await safeRun('news', ingestAllNews);
      const social = await safeRun('social', fetchRedditSignals);
      const score = await safeRun('score', recomputeAllScores);
      return { stateDept, news, social, score };
    }
    case 'bootstrap': {
      const seed = await seedCountriesIfEmpty();
      if (seed.schemaMissing) {
        const err = new Error('relation "public.countries" does not exist');
        (err as PgErrorLike).code = '42P01';
        throw err;
      }
      const stateDept = await safeRun('state_dept', fetchAllAdvisories);
      const news = await safeRun('news', ingestAllNews);
      const social = await safeRun('social', fetchRedditSignals);
      const score = await safeRun('score', recomputeAllScores);
      return { seed, stateDept, news, social, score };
    }
  }
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const stepRaw = (url.searchParams.get('step') ?? 'all').toLowerCase();
  const allowed: Step[] = ['state_dept', 'news', 'social', 'score', 'all', 'bootstrap'];
  if (!allowed.includes(stepRaw as Step)) {
    return NextResponse.json(
      { error: `invalid step. Allowed: ${allowed.join(', ')}` },
      { status: 400 }
    );
  }
  const step = stepRaw as Step;

  // Pre-flight schema check (skipped for bootstrap because bootstrap runs the
  // seed first and surfaces schemaMissing on its own).
  if (step !== 'bootstrap') {
    const schemaOk = await preflightSchemaCheck();
    if (!schemaOk) {
      return NextResponse.json(
        { ok: false, schemaMissing: true, hint: SCHEMA_MISSING_HINT },
        { status: 412 }
      );
    }
  }

  const t0 = Date.now();
  try {
    const result = await runStep(step);
    const duration_ms = Date.now() - t0;
    if (process.env.NODE_ENV === 'development') {
      console.info('[ConflictLens refresh] ok', { step, duration_ms });
    }
    return NextResponse.json({
      ok: true,
      step,
      duration_ms,
      result,
    });
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json(
        { ok: false, step, schemaMissing: true, hint: SCHEMA_MISSING_HINT },
        { status: 412 }
      );
    }
    console.error(`[refresh] step=${step} failed`, e);
    return NextResponse.json(
      {
        ok: false,
        step,
        duration_ms: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return handle(req);
}

// Vercel Cron sends GET requests
export async function GET(req: Request) {
  return handle(req);
}
