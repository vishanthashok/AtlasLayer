export interface CountryRisk {
  iso_a2: string;
  iso_a3: string;
  name: string;
  region: string | null;
  /** Violence / insecurity risk 0–1 (higher = more dangerous). ML-blended from travel advisories + NLP + feeds. */
  composite_score: number;
  /** Inverse safety score 0–100 (higher = safer for travelers). */
  safety_score: number;
  state_dept_level: number | null;
  news_conflict_score: number | null;
  social_signal_score: number | null;
  confidence: number | null;
  scored_at: string;
  data_sources: string[];
}

export interface ConflictHeatMapResponse {
  countries: CountryRisk[];
  generated_at: string;
  total_countries: number;
  cache_ttl_seconds: number;
  /** Set when the heatmap cannot be loaded (misconfigured Supabase, query failure, etc.). */
  error?: string;
  hint?: string;
  /** True when reads used the anon key because the service-role key was not set. */
  used_anon_fallback?: boolean;
}

export interface ConflictTimeSeriesPoint {
  timestamp: string;
  composite_score: number;
  state_dept_level: number | null;
}

export interface CountryTimeSeriesResponse {
  country_iso: string;
  country_name: string;
  series: ConflictTimeSeriesPoint[];
}

export interface NewsSignal {
  id: string;
  country_iso: string | null;
  source_name: string | null;
  title: string;
  url: string | null;
  published_at: string;
  sentiment_score: number | null;
  conflict_score: number | null;
  keywords: string[] | null;
}

/** Response shape for GET /api/conflict/news */
export interface ConflictNewsApiResponse {
  articles: NewsSignal[];
  error?: string;
  hint?: string;
  /** Query succeeded but no rows — ingestion has not run yet. */
  empty_feed_hint?: string;
  used_anon_fallback?: boolean;
}

export interface ConflictUpdateEvent {
  event: 'scores_updated' | 'advisories_refreshed';
  updated_count?: number;
  timestamp: string;
}
