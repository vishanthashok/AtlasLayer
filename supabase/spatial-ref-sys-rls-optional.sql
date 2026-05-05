-- OPTIONAL — run ONLY from a connection that owns public.spatial_ref_sys (usually the
-- database superuser / postgres role via psql + Project Settings → Database password).
-- Do NOT run from the Supabase SQL Editor if it errors with permission denied on ALTER TABLE.
--
-- Purpose: clear Supabase linter “RLS Disabled in Public” on PostGIS spatial_ref_sys.
-- Risk profile: low if skipped — this table is SRID metadata, not app data.

DO $$
BEGIN
    IF to_regclass('public.spatial_ref_sys') IS NOT NULL THEN
        ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS spatial_ref_sys_select_anon ON public.spatial_ref_sys;
        CREATE POLICY spatial_ref_sys_select_anon
            ON public.spatial_ref_sys
            FOR SELECT
            TO anon
            USING (true);

        DROP POLICY IF EXISTS spatial_ref_sys_select_authenticated ON public.spatial_ref_sys;
        CREATE POLICY spatial_ref_sys_select_authenticated
            ON public.spatial_ref_sys
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END $$;
