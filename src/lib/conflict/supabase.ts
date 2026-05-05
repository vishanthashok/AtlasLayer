import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using the service-role key.
 * Never import this from client components — service role bypasses RLS.
 */
let cachedClient: SupabaseClient | null = null;
let cachedAnonClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      'ConflictLens: SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL is not set'
    );
  }
  if (!key) {
    throw new Error(
      'ConflictLens: SUPABASE_SERVICE_ROLE_KEY is not set (server-only secret required)'
    );
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

/** Returns null if Supabase env vars are absent (lets routes return graceful errors). */
export function tryGetSupabaseAdmin(): SupabaseClient | null {
  try {
    return getSupabaseAdmin();
  } catch {
    return null;
  }
}

/** Read-only client for GET routes when service role is unavailable (anon SELECT must be granted in schema). */
export function tryGetSupabaseAnon(): SupabaseClient | null {
  if (cachedAnonClient) return cachedAnonClient;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cachedAnonClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAnonClient;
}

/**
 * Prefer service-role (full access); fall back to anon for read-only ConflictLens GET handlers.
 */
export function getConflictReadSupabase(): {
  client: SupabaseClient | null;
  used_anon_fallback: boolean;
} {
  const admin = tryGetSupabaseAdmin();
  if (admin) return { client: admin, used_anon_fallback: false };
  const anon = tryGetSupabaseAnon();
  if (anon) return { client: anon, used_anon_fallback: true };
  return { client: null, used_anon_fallback: false };
}

export const CONFLICT_TABLES = {
  countries: 'countries',
  travelAdvisories: 'travel_advisories',
  newsArticles: 'news_articles',
  socialSignals: 'social_signals',
  conflictRiskScores: 'conflict_risk_scores',
  latestConflictScores: 'latest_conflict_scores',
} as const;
