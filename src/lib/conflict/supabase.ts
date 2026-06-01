import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let cachedAnonClient: SupabaseClient | null = null;

function isValidSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    // Must be HTTPS and a real Supabase project URL (not "undefined" or localhost in prod)
    return u.protocol === 'https:' && u.hostname.length > 4;
  } catch {
    return false;
  }
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isValidSupabaseUrl(url)) {
    throw new Error('ConflictLens: SUPABASE_URL is missing or invalid. Set NEXT_PUBLIC_SUPABASE_URL in your environment.');
  }
  if (!key || key.length < 20) {
    throw new Error('ConflictLens: SUPABASE_SERVICE_ROLE_KEY is missing. Set it in your environment.');
  }

  cachedClient = createClient(url!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { 'x-application-name': 'atlaslayer-conflictlens' },
    },
  });
  return cachedClient;
}

export function tryGetSupabaseAdmin(): SupabaseClient | null {
  try { return getSupabaseAdmin(); } catch { return null; }
}

export function tryGetSupabaseAnon(): SupabaseClient | null {
  if (cachedAnonClient) return cachedAnonClient;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isValidSupabaseUrl(url) || !key || key.length < 20) return null;
  cachedAnonClient = createClient(url!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAnonClient;
}

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
