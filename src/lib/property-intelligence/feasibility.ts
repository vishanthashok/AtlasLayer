import type { HouseModel } from '../../models/types';

export interface RankedModel {
  modelId: string;
  modelName: string;
  rank: number;
  feasibilityScore: number;
  blockers: string[];
  notes?: string;
}

const SLABISH = /slab|ranch|townhome|modern town/i;
const STILTISH = /pier|stilt|elevated|coastal/i;

/**
 * Apply deterministic penalties from slope & flood; merge with LLM fit scores.
 */
export function applyServerFeasibilityClamp(
  houseModels: HouseModel[],
  fitScores: Record<string, number>,
  opts: {
    estimatedMaxSlopePercent: number | null;
    inFloodZone: boolean;
    floodZone: string | null;
  }
): RankedModel[] {
  const { estimatedMaxSlopePercent: slope, inFloodZone, floodZone } = opts;

  const ranked = houseModels.map((m) => {
    let score = fitScores[m.id] ?? 0.5;
    const blockers: string[] = [];

    const nameLower = m.name.toLowerCase();
    const styleLower = m.styleType.toLowerCase();

    if (slope != null) {
      if (slope >= 25 && SLABISH.test(nameLower + styleLower)) {
        score *= 0.35;
        blockers.push(`Steep site (~${slope.toFixed(0)}% slope): slab-on-grade style likely needs grading/pier foundation.`);
      }
      if (slope >= 30) {
        score *= 0.55;
        blockers.push(`Slope ~${slope.toFixed(0)}% may require engineered foundations or retaining — verify geotech.`);
      }
    }

    if (inFloodZone) {
      const z = floodZone || '';
      if (/^(AE|A|AH|AO)/i.test(z) && SLABISH.test(nameLower + styleLower)) {
        score *= 0.4;
        blockers.push('SFHA / elevated BFE risk: low slab builds typically require elevation + flood design.');
      }
      if (!STILTISH.test(nameLower + styleLower) && /^(V|VE)/i.test(z)) {
        score *= 0.45;
        blockers.push('Coastal high-risk zone (V/VE): consider elevated/pier construction.');
      }
    }

    return {
      modelId: m.id,
      modelName: m.name,
      feasibilityScore: Math.max(0, Math.min(1, score)),
      blockers,
      notes: blockers.length ? 'Adjusted for site hazards (server rules).' : undefined,
    };
  });

  ranked.sort((a, b) => b.feasibilityScore - a.feasibilityScore);

  return ranked.map((r, i) => ({
    ...r,
    rank: i + 1,
  }));
}
