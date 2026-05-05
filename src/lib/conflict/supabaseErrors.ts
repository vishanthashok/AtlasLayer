/**
 * Supabase / PostgREST errors when ConflictLens DDL was never applied to the project.
 */
export function isConflictSchemaMissingError(err: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null | undefined): boolean {
  if (!err) return false;
  const msg = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase();
  if (err.code === 'PGRST205') return true;
  if (err.code === '42P01') return true;
  if (msg.includes('schema cache')) return true;
  if (msg.includes('could not find the table')) return true;
  if (/relation .* does not exist/i.test(msg)) return true;
  return false;
}

/** Human-readable fix — keep in sync with docs / SchemaMissingPanel. */
export function conflictSchemaMissingHint(): string {
  return (
    'Apply the ConflictLens SQL to this Supabase project: Dashboard → SQL Editor → paste the ' +
    'block starting with `-- ===== CONFLICTLENS MODULE =====` from `supabase/schema.sql` in your repo, Run. ' +
    'That creates `countries`, `travel_advisories`, `news_articles`, `social_signals`, `conflict_risk_scores`, ' +
    'and the `latest_conflict_scores` view. Then Settings → API → reload the schema (or wait ~1 minute). ' +
    'Finally seed + ingest: POST `/api/conflict/refresh?step=bootstrap` or use Refresh on /conflict.'
  );
}
