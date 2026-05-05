/**
 * Heuristic only — not authoritative zoning. Keyed by 5-digit county FIPS (state+county).
 * OSM + county FIPS is used to add a soft "zoning family" hint for narrative context.
 */
export const COUNTY_ZONING_HINT_BY_FIPS: Record<string, string> = {
  '48029': 'Texas Hill Country / metro fringe — verify SF vs MF with CAD.',
  '48209': 'Hays growth corridor — check ETJ and floodplain overlays.',
  '48453': 'Travis urban infill — dense zoning common near corridors.',
  '48491': 'Williamson suburban residential — HOA / deed restrictions common.',
  '48021': 'Bastrop rural/residential mix — agricultural exemptions possible.',
  '48015': 'Bexar metro — verify HOA and flood zones.',
};

export function zoningHintForCountyFips(fips: string | undefined): string | null {
  if (!fips || fips === 'Unknown') return null;
  return COUNTY_ZONING_HINT_BY_FIPS[fips] ?? null;
}
