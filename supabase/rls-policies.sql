-- AtlasLayer RLS policies — run in Supabase SQL Editor after schema.sql
-- Locks down ConflictLens tables: anon can read, only service_role can write.

-- ── Enable RLS on all ConflictLens tables ──────────────────────────────────
ALTER TABLE public.countries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_advisories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_signals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_risk_scores ENABLE ROW LEVEL SECURITY;

-- ── countries: public read, no direct write (managed by seed script) ───────
CREATE POLICY "countries_select" ON public.countries
  FOR SELECT TO anon, authenticated USING (true);

-- ── travel_advisories: public read ─────────────────────────────────────────
CREATE POLICY "travel_advisories_select" ON public.travel_advisories
  FOR SELECT TO anon, authenticated USING (true);

-- ── news_articles: public read ─────────────────────────────────────────────
CREATE POLICY "news_articles_select" ON public.news_articles
  FOR SELECT TO anon, authenticated USING (true);

-- ── social_signals: public read ────────────────────────────────────────────
CREATE POLICY "social_signals_select" ON public.social_signals
  FOR SELECT TO anon, authenticated USING (true);

-- ── conflict_risk_scores: public read ──────────────────────────────────────
CREATE POLICY "conflict_risk_scores_select" ON public.conflict_risk_scores
  FOR SELECT TO anon, authenticated USING (true);

-- ── Write access: service_role only (bypasses RLS by default in Supabase) ──
-- No explicit INSERT/UPDATE/DELETE policies needed for anon/authenticated —
-- their absence means those operations are denied for non-service-role callers.

-- ── Shared tables (Parcelis / Fieldstone) ──────────────────────────────────
ALTER TABLE public.parcels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grid_data       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights_cache  ENABLE ROW LEVEL SECURITY;

-- Parcels: authenticated users own their rows; anon read-only for now
CREATE POLICY "parcels_select" ON public.parcels
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "parcels_insert" ON public.parcels
  FOR INSERT TO authenticated WITH CHECK (true);

-- grid_data and insights_cache: read-only for all (written by backend only)
CREATE POLICY "grid_data_select" ON public.grid_data
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "insights_cache_select" ON public.insights_cache
  FOR SELECT TO anon, authenticated USING (true);
