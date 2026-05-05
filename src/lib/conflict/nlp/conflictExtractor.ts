import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(en);

/** Weighted conflict keywords. Higher weight → stronger signal. Order keeps
 *  longer phrases first so they match before single-word substrings. */
const CONFLICT_KEYWORDS: Array<[string, number]> = [
  ['military offensive', 1.0],
  ['military operation', 0.8],
  ['missile strike', 0.8],
  ['military strike', 0.8],
  ['armed conflict', 0.8],
  ['troops deployed', 0.6],
  ['airstrike', 1.0],
  ['bombing', 1.0],
  ['invasion', 1.0],
  ['genocide', 1.0],
  ['massacre', 1.0],
  ['shelling', 0.8],
  ['insurgency', 0.8],
  ['ceasefire', 0.6],
  ['escalation', 0.6],
  ['casualties', 0.6],
  ['sanctions', 0.6],
  ['protest', 0.6],
  ['standoff', 0.4],
  ['demonstration', 0.4],
  ['warning', 0.4],
  ['tension', 0.4],
  ['dispute', 0.4],
  ['attack', 0.8],
  ['threat', 0.4],
  ['coup', 0.8],
  ['riot', 0.6],
  ['war', 1.0],
];

const ALIAS_TO_ISO: Record<string, string> = {
  'united states': 'US',
  'u.s.': 'US',
  usa: 'US',
  'u.s.a.': 'US',
  america: 'US',
  uk: 'GB',
  'u.k.': 'GB',
  britain: 'GB',
  'great britain': 'GB',
  russia: 'RU',
  china: 'CN',
  iran: 'IR',
  'north korea': 'KP',
  dprk: 'KP',
  'south korea': 'KR',
  ukraine: 'UA',
  israel: 'IL',
  palestine: 'PS',
  'west bank': 'PS',
  gaza: 'PS',
  syria: 'SY',
  yemen: 'YE',
  taiwan: 'TW',
  myanmar: 'MM',
  burma: 'MM',
};

const COUNTRY_NAME_INDEX: Array<{ name: string; iso: string }> = (() => {
  const out: Array<{ name: string; iso: string }> = [];
  const seen = new Set<string>();

  for (const [alias, iso] of Object.entries(ALIAS_TO_ISO)) {
    out.push({ name: alias, iso });
    seen.add(alias);
  }

  const all = countries.getNames('en', { select: 'official' });
  for (const [iso, name] of Object.entries(all)) {
    const lower = name.toLowerCase();
    if (lower.length < 4) continue;
    if (!seen.has(lower)) {
      out.push({ name: lower, iso });
      seen.add(lower);
    }
  }

  out.sort((a, b) => b.name.length - a.name.length);
  return out;
})();

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ConflictExtraction {
  score: number;
  keywords: string[];
  country_iso: string | null;
}

/**
 * Tier-1 fast rule-based extraction.
 * - Score saturates at ~3 keyword matches (matches spec: total / 3, capped 1.0)
 * - Country detection: longest-name-first scan of the alias index, word-bound
 */
export function extractConflictIndicators(text: string): ConflictExtraction {
  if (!text || typeof text !== 'string') {
    return { score: 0, keywords: [], country_iso: null };
  }
  const lower = text.toLowerCase().slice(0, 8000);

  const matched: string[] = [];
  let totalWeight = 0;
  for (const [keyword, weight] of CONFLICT_KEYWORDS) {
    const re = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
    if (re.test(lower)) {
      matched.push(keyword);
      totalWeight += weight;
    }
  }

  const score = totalWeight > 0 ? Math.min(totalWeight / 3, 1.0) : 0;

  let countryIso: string | null = null;
  for (const entry of COUNTRY_NAME_INDEX) {
    const re = new RegExp(`\\b${escapeRegex(entry.name)}\\b`, 'i');
    if (re.test(lower)) {
      countryIso = entry.iso;
      break;
    }
  }

  return {
    score,
    keywords: matched.slice(0, 10),
    country_iso: countryIso,
  };
}

/** ISO-A2 lookup for a free-text country name (fuzzy via i18n-iso-countries). */
export function nameToIso(name: string): string | null {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  if (ALIAS_TO_ISO[lower]) return ALIAS_TO_ISO[lower];
  const direct = countries.getAlpha2Code(name, 'en');
  if (direct) return direct;
  for (const entry of COUNTRY_NAME_INDEX) {
    if (entry.name === lower) return entry.iso;
  }
  return null;
}
