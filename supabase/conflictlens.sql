-- ConflictLens-only DDL — paste into Supabase Dashboard → SQL Editor → Run.
-- (Same block as in schema.sql under CONFLICTLENS MODULE.)

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
-- security_invoker: query runs with caller’s privileges (Supabase / Postgres 15+); avoids SECURITY DEFINER advisor.
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
