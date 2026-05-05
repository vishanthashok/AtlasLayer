-- Run in Supabase SQL Editor to address common linter/advisor findings.
-- Safe to re-run (idempotent patterns).
--
-- NOTE ON PostGIS public.spatial_ref_sys:
-- Enabling RLS on spatial_ref_sys requires ALTER TABLE privileges as the *table owner*
-- (often superuser / extension owner). The Dashboard SQL editor typically runs as a role
-- that is NOT the owner, so ALTER fails with a permission error—this is expected.
-- Many teams leave this advisor finding as-is: spatial_ref_sys is EPSG reference data,
-- not application secrets. If you must fix it, connect with the database owner (e.g. psql
-- using the postgres user + password from Project Settings → Database) and run the
-- optional script: supabase/spatial-ref-sys-rls-optional.sql

-- ---------------------------------------------------------------------------
-- 1) latest_conflict_scores — use SECURITY INVOKER (Postgres 15+ / Supabase)
--    Replaces definer-style behavior that triggers “Security Definer View”.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.latest_conflict_scores
    WITH (security_invoker = true)
    AS
    SELECT DISTINCT ON (country_iso)
        country_iso, scored_at, composite_score, state_dept_level,
        news_conflict_score, social_signal_score, confidence, data_sources
    FROM public.conflict_risk_scores
    ORDER BY country_iso, scored_at DESC;

GRANT SELECT ON public.latest_conflict_scores TO anon, authenticated;
