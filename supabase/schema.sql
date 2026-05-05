-- PropertyVision shared persistence (Parcelis + Fieldstone).
-- Enable the PostGIS extension for spatial data
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. grid_data — Fieldstone / environmental sampling grid
CREATE TABLE public.grid_data (
    id SERIAL PRIMARY KEY,
    geom GEOMETRY(Point, 4326),
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    rainfall_avg DOUBLE PRECISION,
    temp_avg DOUBLE PRECISION,
    soil_type VARCHAR(50),
    drought_frequency DOUBLE PRECISION
);

-- Index for fast spatial queries
CREATE INDEX idx_grid_data_geom ON public.grid_data USING GIST (geom);

-- 2. parcels — drawn or imported parcel geometries (shared)
CREATE TABLE public.parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    polygon GEOMETRY(Polygon, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_parcels_geom ON public.parcels USING GIST (polygon);

-- 3. insights_cache — keyed JSON cache for analysis endpoints (Parcelis / Fieldstone)
CREATE TABLE public.insights_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    input_hash TEXT UNIQUE NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast cache lookups
CREATE INDEX idx_insights_cache_hash ON public.insights_cache (input_hash);

-- Give anon role access (for MVP simplicity, we allow public read/write)
-- In production, RLS policies should be applied.
GRANT ALL ON public.grid_data TO anon, authenticated, service_role;
GRANT ALL ON public.parcels TO anon, authenticated, service_role;
GRANT ALL ON public.insights_cache TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ===== CONFLICTLENS MODULE =====
-- All tables are plain Postgres (no TimescaleDB hypertables — use indexes only).

CREATE TABLE IF NOT EXISTS public.countries (
    iso_a2        CHAR(2)       PRIMARY KEY,
    iso_a3        CHAR(3)       UNIQUE NOT NULL,
    name          TEXT          NOT NULL,
    region        TEXT,
    subregion     TEXT,
    centroid_lat  DOUBLE PRECISION,
    centroid_lng  DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS public.travel_advisories (
    id            BIGSERIAL,
    country_iso   CHAR(2)       REFERENCES public.countries(iso_a2),
    level         SMALLINT      NOT NULL CHECK (level BETWEEN 1 AND 4),
    headline      TEXT,
    full_text     TEXT,
    url           TEXT,
    fetched_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    effective_at  TIMESTAMPTZ,
    PRIMARY KEY (id, fetched_at)
);
CREATE INDEX IF NOT EXISTS idx_travel_advisories_country_time
    ON public.travel_advisories (country_iso, fetched_at DESC);

CREATE TABLE IF NOT EXISTS public.news_articles (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    country_iso     CHAR(2),
    region          TEXT,
    source_name     TEXT,
    title           TEXT          NOT NULL,
    url             TEXT          UNIQUE,
    content_hash    CHAR(64),
    published_at    TIMESTAMPTZ,
    ingested_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    sentiment_score DOUBLE PRECISION,
    conflict_score  DOUBLE PRECISION,
    keywords        TEXT[],
    raw_text        TEXT
);
CREATE INDEX IF NOT EXISTS idx_news_country_time
    ON public.news_articles (country_iso, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_conflict_score
    ON public.news_articles (conflict_score DESC);
CREATE INDEX IF NOT EXISTS idx_news_ingested_at
    ON public.news_articles (ingested_at DESC);

CREATE TABLE IF NOT EXISTS public.social_signals (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    platform            TEXT          NOT NULL,
    country_iso         CHAR(2),
    region              TEXT,
    content             TEXT,
    signal_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    sentiment           DOUBLE PRECISION,
    conflict_indicators TEXT[],
    engagement          INTEGER       DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_social_country_time
    ON public.social_signals (country_iso, signal_at DESC);

CREATE TABLE IF NOT EXISTS public.conflict_risk_scores (
    country_iso          CHAR(2)        REFERENCES public.countries(iso_a2),
    scored_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    state_dept_level     SMALLINT,
    news_conflict_score  DOUBLE PRECISION,
    social_signal_score  DOUBLE PRECISION,
    composite_score      DOUBLE PRECISION NOT NULL,
    data_sources         TEXT[],
    confidence           DOUBLE PRECISION,
    PRIMARY KEY (country_iso, scored_at)
);
CREATE INDEX IF NOT EXISTS idx_conflict_scores_country_time
    ON public.conflict_risk_scores (country_iso, scored_at DESC);

-- View: latest score per country (no Timescale, use DISTINCT ON)
-- security_invoker: caller’s privileges (Supabase advisor: avoid SECURITY DEFINER views).
CREATE OR REPLACE VIEW public.latest_conflict_scores
    WITH (security_invoker = true)
    AS
    SELECT DISTINCT ON (country_iso)
        country_iso, scored_at, composite_score, state_dept_level,
        news_conflict_score, social_signal_score, confidence, data_sources
    FROM public.conflict_risk_scores
    ORDER BY country_iso, scored_at DESC;

GRANT SELECT ON public.countries, public.travel_advisories, public.news_articles,
    public.social_signals, public.conflict_risk_scores, public.latest_conflict_scores
    TO anon, authenticated;
GRANT ALL ON public.countries, public.travel_advisories, public.news_articles,
    public.social_signals, public.conflict_risk_scores
    TO service_role;
