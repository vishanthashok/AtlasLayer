/**
 * Server-callable seed for the public.countries table.
 *
 * Mirrors scripts/seedCountries.ts (which now imports from here) so the same
 * data + logic can run inside an API route during the bootstrap step.
 *
 * Centroids are coarse country-center approximations.
 */
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import { getSupabaseAdmin } from './supabase';

countries.registerLocale(en);

interface RegionEntry {
  region: string;
  subregion: string;
  lat: number;
  lng: number;
}

export const REGION_MAP: Record<string, RegionEntry> = {
  // Americas
  US: { region: 'Americas', subregion: 'Northern America', lat: 37.09, lng: -95.71 },
  CA: { region: 'Americas', subregion: 'Northern America', lat: 56.13, lng: -106.35 },
  MX: { region: 'Americas', subregion: 'Latin America', lat: 23.63, lng: -102.55 },
  BR: { region: 'Americas', subregion: 'Latin America', lat: -14.24, lng: -51.93 },
  AR: { region: 'Americas', subregion: 'Latin America', lat: -38.42, lng: -63.62 },
  CO: { region: 'Americas', subregion: 'Latin America', lat: 4.57, lng: -74.3 },
  CL: { region: 'Americas', subregion: 'Latin America', lat: -35.68, lng: -71.54 },
  PE: { region: 'Americas', subregion: 'Latin America', lat: -9.19, lng: -75.02 },
  VE: { region: 'Americas', subregion: 'Latin America', lat: 6.42, lng: -66.59 },
  EC: { region: 'Americas', subregion: 'Latin America', lat: -1.83, lng: -78.18 },
  BO: { region: 'Americas', subregion: 'Latin America', lat: -16.29, lng: -63.59 },
  PY: { region: 'Americas', subregion: 'Latin America', lat: -23.44, lng: -58.44 },
  UY: { region: 'Americas', subregion: 'Latin America', lat: -32.52, lng: -55.77 },
  GY: { region: 'Americas', subregion: 'Latin America', lat: 4.86, lng: -58.93 },
  SR: { region: 'Americas', subregion: 'Latin America', lat: 3.92, lng: -56.03 },
  CU: { region: 'Americas', subregion: 'Latin America', lat: 21.52, lng: -77.78 },
  HT: { region: 'Americas', subregion: 'Latin America', lat: 18.97, lng: -72.29 },
  DO: { region: 'Americas', subregion: 'Latin America', lat: 18.74, lng: -70.16 },
  JM: { region: 'Americas', subregion: 'Latin America', lat: 18.11, lng: -77.3 },
  PA: { region: 'Americas', subregion: 'Latin America', lat: 8.54, lng: -80.78 },
  CR: { region: 'Americas', subregion: 'Latin America', lat: 9.75, lng: -83.75 },
  NI: { region: 'Americas', subregion: 'Latin America', lat: 12.86, lng: -85.21 },
  HN: { region: 'Americas', subregion: 'Latin America', lat: 15.2, lng: -86.24 },
  SV: { region: 'Americas', subregion: 'Latin America', lat: 13.79, lng: -88.9 },
  GT: { region: 'Americas', subregion: 'Latin America', lat: 15.78, lng: -90.23 },
  BZ: { region: 'Americas', subregion: 'Latin America', lat: 17.19, lng: -88.5 },
  TT: { region: 'Americas', subregion: 'Latin America', lat: 10.69, lng: -61.22 },
  BS: { region: 'Americas', subregion: 'Latin America', lat: 25.03, lng: -77.4 },
  BB: { region: 'Americas', subregion: 'Latin America', lat: 13.19, lng: -59.54 },
  GD: { region: 'Americas', subregion: 'Latin America', lat: 12.26, lng: -61.6 },
  AG: { region: 'Americas', subregion: 'Latin America', lat: 17.06, lng: -61.8 },
  DM: { region: 'Americas', subregion: 'Latin America', lat: 15.41, lng: -61.37 },
  KN: { region: 'Americas', subregion: 'Latin America', lat: 17.35, lng: -62.78 },
  LC: { region: 'Americas', subregion: 'Latin America', lat: 13.91, lng: -60.97 },
  VC: { region: 'Americas', subregion: 'Latin America', lat: 12.98, lng: -61.29 },

  // Europe
  GB: { region: 'Europe', subregion: 'Northern Europe', lat: 55.38, lng: -3.44 },
  IE: { region: 'Europe', subregion: 'Northern Europe', lat: 53.41, lng: -8.24 },
  IS: { region: 'Europe', subregion: 'Northern Europe', lat: 64.96, lng: -19.02 },
  NO: { region: 'Europe', subregion: 'Northern Europe', lat: 60.47, lng: 8.47 },
  SE: { region: 'Europe', subregion: 'Northern Europe', lat: 60.13, lng: 18.64 },
  FI: { region: 'Europe', subregion: 'Northern Europe', lat: 61.92, lng: 25.75 },
  DK: { region: 'Europe', subregion: 'Northern Europe', lat: 56.26, lng: 9.5 },
  EE: { region: 'Europe', subregion: 'Northern Europe', lat: 58.6, lng: 25.01 },
  LV: { region: 'Europe', subregion: 'Northern Europe', lat: 56.88, lng: 24.6 },
  LT: { region: 'Europe', subregion: 'Northern Europe', lat: 55.17, lng: 23.88 },
  DE: { region: 'Europe', subregion: 'Western Europe', lat: 51.17, lng: 10.45 },
  FR: { region: 'Europe', subregion: 'Western Europe', lat: 46.23, lng: 2.21 },
  NL: { region: 'Europe', subregion: 'Western Europe', lat: 52.13, lng: 5.29 },
  BE: { region: 'Europe', subregion: 'Western Europe', lat: 50.5, lng: 4.47 },
  LU: { region: 'Europe', subregion: 'Western Europe', lat: 49.82, lng: 6.13 },
  CH: { region: 'Europe', subregion: 'Western Europe', lat: 46.82, lng: 8.23 },
  AT: { region: 'Europe', subregion: 'Western Europe', lat: 47.52, lng: 14.55 },
  ES: { region: 'Europe', subregion: 'Southern Europe', lat: 40.46, lng: -3.75 },
  PT: { region: 'Europe', subregion: 'Southern Europe', lat: 39.4, lng: -8.22 },
  IT: { region: 'Europe', subregion: 'Southern Europe', lat: 41.87, lng: 12.57 },
  GR: { region: 'Europe', subregion: 'Southern Europe', lat: 39.07, lng: 21.82 },
  MT: { region: 'Europe', subregion: 'Southern Europe', lat: 35.94, lng: 14.38 },
  CY: { region: 'Europe', subregion: 'Southern Europe', lat: 35.13, lng: 33.43 },
  HR: { region: 'Europe', subregion: 'Southern Europe', lat: 45.1, lng: 15.2 },
  SI: { region: 'Europe', subregion: 'Southern Europe', lat: 46.15, lng: 14.99 },
  RS: { region: 'Europe', subregion: 'Southern Europe', lat: 44.02, lng: 21.01 },
  BA: { region: 'Europe', subregion: 'Southern Europe', lat: 43.92, lng: 17.68 },
  ME: { region: 'Europe', subregion: 'Southern Europe', lat: 42.71, lng: 19.37 },
  MK: { region: 'Europe', subregion: 'Southern Europe', lat: 41.61, lng: 21.75 },
  AL: { region: 'Europe', subregion: 'Southern Europe', lat: 41.15, lng: 20.17 },
  XK: { region: 'Europe', subregion: 'Southern Europe', lat: 42.6, lng: 20.9 },
  PL: { region: 'Europe', subregion: 'Eastern Europe', lat: 51.92, lng: 19.14 },
  CZ: { region: 'Europe', subregion: 'Eastern Europe', lat: 49.82, lng: 15.47 },
  SK: { region: 'Europe', subregion: 'Eastern Europe', lat: 48.67, lng: 19.7 },
  HU: { region: 'Europe', subregion: 'Eastern Europe', lat: 47.16, lng: 19.5 },
  RO: { region: 'Europe', subregion: 'Eastern Europe', lat: 45.94, lng: 24.97 },
  BG: { region: 'Europe', subregion: 'Eastern Europe', lat: 42.73, lng: 25.49 },
  MD: { region: 'Europe', subregion: 'Eastern Europe', lat: 47.41, lng: 28.37 },
  UA: { region: 'Europe', subregion: 'Eastern Europe', lat: 48.38, lng: 31.17 },
  BY: { region: 'Europe', subregion: 'Eastern Europe', lat: 53.71, lng: 27.95 },
  RU: { region: 'Europe', subregion: 'Eastern Europe', lat: 61.52, lng: 105.32 },
  TR: { region: 'Europe', subregion: 'Western Asia', lat: 38.96, lng: 35.24 },

  // Asia
  CN: { region: 'Asia', subregion: 'Eastern Asia', lat: 35.86, lng: 104.2 },
  JP: { region: 'Asia', subregion: 'Eastern Asia', lat: 36.2, lng: 138.25 },
  KR: { region: 'Asia', subregion: 'Eastern Asia', lat: 35.91, lng: 127.77 },
  KP: { region: 'Asia', subregion: 'Eastern Asia', lat: 40.34, lng: 127.51 },
  MN: { region: 'Asia', subregion: 'Eastern Asia', lat: 46.86, lng: 103.85 },
  TW: { region: 'Asia', subregion: 'Eastern Asia', lat: 23.7, lng: 120.96 },
  HK: { region: 'Asia', subregion: 'Eastern Asia', lat: 22.32, lng: 114.17 },
  MO: { region: 'Asia', subregion: 'Eastern Asia', lat: 22.2, lng: 113.55 },
  IN: { region: 'Asia', subregion: 'Southern Asia', lat: 20.59, lng: 78.96 },
  PK: { region: 'Asia', subregion: 'Southern Asia', lat: 30.38, lng: 69.35 },
  BD: { region: 'Asia', subregion: 'Southern Asia', lat: 23.69, lng: 90.36 },
  LK: { region: 'Asia', subregion: 'Southern Asia', lat: 7.87, lng: 80.77 },
  NP: { region: 'Asia', subregion: 'Southern Asia', lat: 28.39, lng: 84.12 },
  BT: { region: 'Asia', subregion: 'Southern Asia', lat: 27.51, lng: 90.43 },
  MV: { region: 'Asia', subregion: 'Southern Asia', lat: 3.2, lng: 73.22 },
  AF: { region: 'Asia', subregion: 'Southern Asia', lat: 33.94, lng: 67.71 },
  IR: { region: 'Asia', subregion: 'Southern Asia', lat: 32.43, lng: 53.69 },
  TH: { region: 'Asia', subregion: 'South-eastern Asia', lat: 15.87, lng: 100.99 },
  VN: { region: 'Asia', subregion: 'South-eastern Asia', lat: 14.06, lng: 108.28 },
  PH: { region: 'Asia', subregion: 'South-eastern Asia', lat: 12.88, lng: 121.77 },
  ID: { region: 'Asia', subregion: 'South-eastern Asia', lat: -0.79, lng: 113.92 },
  MY: { region: 'Asia', subregion: 'South-eastern Asia', lat: 4.21, lng: 101.98 },
  SG: { region: 'Asia', subregion: 'South-eastern Asia', lat: 1.35, lng: 103.82 },
  KH: { region: 'Asia', subregion: 'South-eastern Asia', lat: 12.57, lng: 104.99 },
  LA: { region: 'Asia', subregion: 'South-eastern Asia', lat: 19.86, lng: 102.5 },
  MM: { region: 'Asia', subregion: 'South-eastern Asia', lat: 21.91, lng: 95.96 },
  BN: { region: 'Asia', subregion: 'South-eastern Asia', lat: 4.54, lng: 114.73 },
  TL: { region: 'Asia', subregion: 'South-eastern Asia', lat: -8.87, lng: 125.73 },
  KZ: { region: 'Asia', subregion: 'Central Asia', lat: 48.02, lng: 66.92 },
  UZ: { region: 'Asia', subregion: 'Central Asia', lat: 41.38, lng: 64.59 },
  KG: { region: 'Asia', subregion: 'Central Asia', lat: 41.2, lng: 74.77 },
  TJ: { region: 'Asia', subregion: 'Central Asia', lat: 38.86, lng: 71.28 },
  TM: { region: 'Asia', subregion: 'Central Asia', lat: 38.97, lng: 59.56 },
  IL: { region: 'Asia', subregion: 'Western Asia', lat: 31.05, lng: 34.85 },
  PS: { region: 'Asia', subregion: 'Western Asia', lat: 31.95, lng: 35.23 },
  JO: { region: 'Asia', subregion: 'Western Asia', lat: 30.59, lng: 36.24 },
  LB: { region: 'Asia', subregion: 'Western Asia', lat: 33.85, lng: 35.86 },
  SY: { region: 'Asia', subregion: 'Western Asia', lat: 34.8, lng: 38.9 },
  IQ: { region: 'Asia', subregion: 'Western Asia', lat: 33.22, lng: 43.68 },
  SA: { region: 'Asia', subregion: 'Western Asia', lat: 23.89, lng: 45.08 },
  YE: { region: 'Asia', subregion: 'Western Asia', lat: 15.55, lng: 48.52 },
  OM: { region: 'Asia', subregion: 'Western Asia', lat: 21.51, lng: 55.92 },
  AE: { region: 'Asia', subregion: 'Western Asia', lat: 23.42, lng: 53.85 },
  QA: { region: 'Asia', subregion: 'Western Asia', lat: 25.35, lng: 51.18 },
  BH: { region: 'Asia', subregion: 'Western Asia', lat: 26.07, lng: 50.55 },
  KW: { region: 'Asia', subregion: 'Western Asia', lat: 29.31, lng: 47.48 },
  AM: { region: 'Asia', subregion: 'Western Asia', lat: 40.07, lng: 45.04 },
  AZ: { region: 'Asia', subregion: 'Western Asia', lat: 40.14, lng: 47.58 },
  GE: { region: 'Asia', subregion: 'Western Asia', lat: 42.32, lng: 43.36 },

  // Africa
  EG: { region: 'Africa', subregion: 'Northern Africa', lat: 26.82, lng: 30.8 },
  LY: { region: 'Africa', subregion: 'Northern Africa', lat: 26.34, lng: 17.23 },
  TN: { region: 'Africa', subregion: 'Northern Africa', lat: 33.89, lng: 9.54 },
  DZ: { region: 'Africa', subregion: 'Northern Africa', lat: 28.03, lng: 1.66 },
  MA: { region: 'Africa', subregion: 'Northern Africa', lat: 31.79, lng: -7.09 },
  SD: { region: 'Africa', subregion: 'Northern Africa', lat: 12.86, lng: 30.22 },
  SS: { region: 'Africa', subregion: 'Eastern Africa', lat: 6.88, lng: 31.31 },
  ET: { region: 'Africa', subregion: 'Eastern Africa', lat: 9.15, lng: 40.49 },
  ER: { region: 'Africa', subregion: 'Eastern Africa', lat: 15.18, lng: 39.78 },
  DJ: { region: 'Africa', subregion: 'Eastern Africa', lat: 11.83, lng: 42.59 },
  SO: { region: 'Africa', subregion: 'Eastern Africa', lat: 5.15, lng: 46.2 },
  KE: { region: 'Africa', subregion: 'Eastern Africa', lat: -0.02, lng: 37.91 },
  UG: { region: 'Africa', subregion: 'Eastern Africa', lat: 1.37, lng: 32.29 },
  TZ: { region: 'Africa', subregion: 'Eastern Africa', lat: -6.37, lng: 34.89 },
  RW: { region: 'Africa', subregion: 'Eastern Africa', lat: -1.94, lng: 29.87 },
  BI: { region: 'Africa', subregion: 'Eastern Africa', lat: -3.37, lng: 29.92 },
  MZ: { region: 'Africa', subregion: 'Eastern Africa', lat: -18.67, lng: 35.53 },
  MW: { region: 'Africa', subregion: 'Eastern Africa', lat: -13.25, lng: 34.3 },
  ZM: { region: 'Africa', subregion: 'Eastern Africa', lat: -13.13, lng: 27.85 },
  ZW: { region: 'Africa', subregion: 'Eastern Africa', lat: -19.02, lng: 29.15 },
  MG: { region: 'Africa', subregion: 'Eastern Africa', lat: -18.77, lng: 46.87 },
  KM: { region: 'Africa', subregion: 'Eastern Africa', lat: -11.88, lng: 43.87 },
  MU: { region: 'Africa', subregion: 'Eastern Africa', lat: -20.35, lng: 57.55 },
  SC: { region: 'Africa', subregion: 'Eastern Africa', lat: -4.68, lng: 55.49 },
  ZA: { region: 'Africa', subregion: 'Southern Africa', lat: -30.56, lng: 22.94 },
  NA: { region: 'Africa', subregion: 'Southern Africa', lat: -22.96, lng: 18.49 },
  BW: { region: 'Africa', subregion: 'Southern Africa', lat: -22.33, lng: 24.68 },
  LS: { region: 'Africa', subregion: 'Southern Africa', lat: -29.61, lng: 28.23 },
  SZ: { region: 'Africa', subregion: 'Southern Africa', lat: -26.52, lng: 31.47 },
  AO: { region: 'Africa', subregion: 'Middle Africa', lat: -11.2, lng: 17.87 },
  CD: { region: 'Africa', subregion: 'Middle Africa', lat: -4.04, lng: 21.76 },
  CG: { region: 'Africa', subregion: 'Middle Africa', lat: -0.23, lng: 15.83 },
  GA: { region: 'Africa', subregion: 'Middle Africa', lat: -0.8, lng: 11.61 },
  CM: { region: 'Africa', subregion: 'Middle Africa', lat: 7.37, lng: 12.35 },
  TD: { region: 'Africa', subregion: 'Middle Africa', lat: 15.45, lng: 18.73 },
  CF: { region: 'Africa', subregion: 'Middle Africa', lat: 6.61, lng: 20.94 },
  GQ: { region: 'Africa', subregion: 'Middle Africa', lat: 1.65, lng: 10.27 },
  ST: { region: 'Africa', subregion: 'Middle Africa', lat: 0.19, lng: 6.61 },
  NG: { region: 'Africa', subregion: 'Western Africa', lat: 9.08, lng: 8.68 },
  NE: { region: 'Africa', subregion: 'Western Africa', lat: 17.61, lng: 8.08 },
  ML: { region: 'Africa', subregion: 'Western Africa', lat: 17.57, lng: -3.99 },
  BF: { region: 'Africa', subregion: 'Western Africa', lat: 12.24, lng: -1.56 },
  GN: { region: 'Africa', subregion: 'Western Africa', lat: 9.95, lng: -9.7 },
  GW: { region: 'Africa', subregion: 'Western Africa', lat: 11.8, lng: -15.18 },
  SN: { region: 'Africa', subregion: 'Western Africa', lat: 14.5, lng: -14.45 },
  MR: { region: 'Africa', subregion: 'Western Africa', lat: 21.0, lng: -10.94 },
  GM: { region: 'Africa', subregion: 'Western Africa', lat: 13.44, lng: -15.31 },
  CV: { region: 'Africa', subregion: 'Western Africa', lat: 16.0, lng: -24.0 },
  CI: { region: 'Africa', subregion: 'Western Africa', lat: 7.54, lng: -5.55 },
  GH: { region: 'Africa', subregion: 'Western Africa', lat: 7.95, lng: -1.03 },
  TG: { region: 'Africa', subregion: 'Western Africa', lat: 8.62, lng: 0.82 },
  BJ: { region: 'Africa', subregion: 'Western Africa', lat: 9.31, lng: 2.32 },
  LR: { region: 'Africa', subregion: 'Western Africa', lat: 6.43, lng: -9.43 },
  SL: { region: 'Africa', subregion: 'Western Africa', lat: 8.46, lng: -11.78 },

  // Oceania
  AU: { region: 'Oceania', subregion: 'Australia and New Zealand', lat: -25.27, lng: 133.78 },
  NZ: { region: 'Oceania', subregion: 'Australia and New Zealand', lat: -40.9, lng: 174.89 },
  PG: { region: 'Oceania', subregion: 'Melanesia', lat: -6.31, lng: 143.96 },
  FJ: { region: 'Oceania', subregion: 'Melanesia', lat: -16.58, lng: 179.41 },
  SB: { region: 'Oceania', subregion: 'Melanesia', lat: -9.65, lng: 160.16 },
  VU: { region: 'Oceania', subregion: 'Melanesia', lat: -15.38, lng: 166.96 },
  WS: { region: 'Oceania', subregion: 'Polynesia', lat: -13.76, lng: -172.1 },
  TO: { region: 'Oceania', subregion: 'Polynesia', lat: -21.18, lng: -175.2 },
  TV: { region: 'Oceania', subregion: 'Polynesia', lat: -7.11, lng: 177.65 },
  KI: { region: 'Oceania', subregion: 'Micronesia', lat: -3.37, lng: -168.73 },
  FM: { region: 'Oceania', subregion: 'Micronesia', lat: 7.43, lng: 150.55 },
  MH: { region: 'Oceania', subregion: 'Micronesia', lat: 7.13, lng: 171.18 },
  NR: { region: 'Oceania', subregion: 'Micronesia', lat: -0.52, lng: 166.93 },
  PW: { region: 'Oceania', subregion: 'Micronesia', lat: 7.51, lng: 134.58 },
};

interface CountrySeedRow {
  iso_a2: string;
  iso_a3: string;
  name: string;
  region: string | null;
  subregion: string | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
}

function buildCountryRows(): CountrySeedRow[] {
  const a2Names = countries.getNames('en', { select: 'official' });
  const rows: CountrySeedRow[] = [];
  for (const [iso2, name] of Object.entries(a2Names)) {
    const iso3 = countries.alpha2ToAlpha3(iso2);
    if (!iso3) continue;
    const meta = REGION_MAP[iso2];
    rows.push({
      iso_a2: iso2,
      iso_a3: iso3,
      name,
      region: meta?.region ?? null,
      subregion: meta?.subregion ?? null,
      centroid_lat: meta?.lat ?? null,
      centroid_lng: meta?.lng ?? null,
    });
  }
  return rows;
}

export interface SeedResult {
  total: number;
  upserted: number;
  skipped: boolean;
  schemaMissing?: boolean;
}

/** Always upsert the full country list. Used by the CLI seed script. */
export async function seedAllCountries(): Promise<SeedResult> {
  const supabase = getSupabaseAdmin();
  const rows = buildCountryRows();

  let upserted = 0;
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('countries')
      .upsert(chunk, { onConflict: 'iso_a2', ignoreDuplicates: false });
    if (error) {
      if (error.code === '42P01') {
        return { total: rows.length, upserted, skipped: false, schemaMissing: true };
      }
      console.error('[seed] chunk failed', error);
    } else {
      upserted += chunk.length;
    }
  }
  return { total: rows.length, upserted, skipped: false };
}

/**
 * Server-callable: seed only when the table is empty. Used by the bootstrap
 * step so /api/conflict/refresh?step=bootstrap stays idempotent.
 */
export async function seedCountriesIfEmpty(): Promise<SeedResult> {
  const supabase = getSupabaseAdmin();

  const { count, error } = await supabase
    .from('countries')
    .select('iso_a2', { count: 'exact', head: true });

  if (error) {
    if (error.code === '42P01') {
      return { total: 0, upserted: 0, skipped: false, schemaMissing: true };
    }
    throw error;
  }

  if ((count ?? 0) > 0) {
    return { total: count ?? 0, upserted: 0, skipped: true };
  }

  return seedAllCountries();
}
