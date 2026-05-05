import type { CountryRisk } from './types';
import { normalizeIso2, normalizeIso3 } from './iso';
import { violenceToSafetyScore } from './ml/safetyRiskModel';
import { SAFETY_ML_MODEL_VERSION } from './constants';

export interface CountryRowDb {
  iso_a2: string;
  iso_a3: string;
  name: string;
  region: string | null;
}

export interface LatestScoreRowDb {
  country_iso: string;
  composite_score: number | null;
  state_dept_level: number | null;
  news_conflict_score: number | null;
  social_signal_score: number | null;
  confidence: number | null;
  scored_at: string;
  data_sources: string[] | null;
}

export function mergeCountriesWithLatestScores(
  countries: CountryRowDb[],
  scores: LatestScoreRowDb[],
  params?: {
    region?: string | null;
    minScore?: number;
    maxScore?: number;
    level?: number | null;
  }
): CountryRisk[] {
  const minScore = params?.minScore ?? 0;
  const maxScore = params?.maxScore ?? 1;
  const level = params?.level ?? null;
  const region = params?.region ?? null;

  const scoreMap = new Map<string, LatestScoreRowDb>();
  for (const s of scores) {
    scoreMap.set(normalizeIso2(s.country_iso), s);
  }

  const UNSCORED_AT = '1970-01-01T00:00:00.000Z';

  const out: CountryRisk[] = [];
  for (const c of countries) {
    if (region && c.region !== region) continue;
    const iso2 = normalizeIso2(c.iso_a2);
    const scoreRow = scoreMap.get(iso2);
    const composite = scoreRow?.composite_score ?? 0;

    if (composite < minScore || composite > maxScore) continue;
    const deptLevel = scoreRow?.state_dept_level ?? null;
    if (level != null && deptLevel !== level) continue;

    out.push({
      iso_a2: iso2,
      iso_a3: normalizeIso3(c.iso_a3),
      name: c.name.trim(),
      region: c.region,
      composite_score: composite,
      state_dept_level: deptLevel,
      news_conflict_score: scoreRow?.news_conflict_score ?? null,
      social_signal_score: scoreRow?.social_signal_score ?? null,
      confidence: scoreRow?.confidence ?? null,
      scored_at: scoreRow?.scored_at ?? UNSCORED_AT,
      data_sources: scoreRow?.data_sources ?? [],
      safety_score: violenceToSafetyScore(composite),
    });
  }

  out.sort((a, b) => b.composite_score - a.composite_score);
  return out;
}

export function demoEnvelope(countries: CountryRisk[]) {
  return {
    ok: true as const,
    model_version: SAFETY_ML_MODEL_VERSION,
    generated_at: new Date().toISOString(),
    total_countries: countries.length,
    countries,
  };
}
