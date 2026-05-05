/** Postgres CHAR(n) columns are space-padded — normalize before Map joins / APIs. */
export function normalizeIso2(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.trim().toUpperCase().slice(0, 2);
}

export function normalizeIso3(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.trim().toUpperCase().slice(0, 3);
}
