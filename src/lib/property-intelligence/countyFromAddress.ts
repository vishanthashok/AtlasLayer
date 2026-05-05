export type CadCounty = 'bexar' | 'travis' | 'williamson';

/**
 * Detect which Central Appraisal District serves an address based on its city/locality.
 * Returns null when no city keyword is recognized — callers can then fan out to all CADs.
 */
export function detectCountyFromAddress(addr: string): CadCounty | null {
  const a = addr.toLowerCase();

  if (a.includes('san antonio') || a.includes('helotes') || a.includes(', bexar')) {
    return 'bexar';
  }

  if (
    a.includes('leander') ||
    a.includes('cedar park') ||
    a.includes('georgetown') ||
    a.includes('round rock') ||
    a.includes(', williamson')
  ) {
    return 'williamson';
  }

  if (a.includes('austin') || a.includes(', travis')) {
    return 'travis';
  }

  return null;
}

/** Best-effort CAD portal URL from address keywords before API returns (same routing as scrape). */
export function guessedCadSiteUrl(addr: string): string | null {
  const c = detectCountyFromAddress(addr);
  if (c === 'bexar') return cadSiteUrl('bexar_cad');
  if (c === 'travis') return cadSiteUrl('travis_cad');
  if (c === 'williamson') return cadSiteUrl('williamson_cad');
  return null;
}

/** Public registry URL for a given CAD source — used by the Property Only page. */
export function cadSiteUrl(source: 'bexar_cad' | 'travis_cad' | 'williamson_cad'): string {
  switch (source) {
    case 'bexar_cad':
      return 'https://bexar.trueautomation.com/clientdb/propertysearch.aspx?cid=110';
    case 'travis_cad':
      return 'https://travis.prodigycad.com/property-search';
    case 'williamson_cad':
      return 'https://search.wcad.org/';
  }
}
