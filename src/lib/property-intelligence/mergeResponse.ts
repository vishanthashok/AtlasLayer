import type { HouseModel } from '../../models/types';
import type { IngestionBundle } from './connectors';
import { buildHazardProfile, type PropertyIntelligenceObject } from './ontology';
import { applyServerFeasibilityClamp, type RankedModel } from './feasibility';
import { parcelisAnalyzeResponseSchema, marketIntelligenceSchema } from './schema';
import type { z } from 'zod';

type Parsed = Record<string, unknown>;

function uniqueStrings(a: string[]): string[] {
  return [...new Set(a.map((s) => String(s).trim()).filter(Boolean))];
}

function coerceNum(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/%/g, '').trim());
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function provenanceEnum(source: string): 'cad' | 'rentcast' | 'none' {
  if (source === 'cad' || source === 'rentcast' || source === 'none') return source;
  return 'rentcast';
}

function coerceStringArray(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  if (!Array.isArray(v)) return undefined;
  const a = v.map((x) => String(x)).filter((s) => s.length > 0);
  return a.length ? a : undefined;
}

function coerceFitScoresRecord(r: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(r)) {
    const n = coerceNum(v, 0.5);
    out[k] = Math.max(0, Math.min(1, n));
  }
  return out;
}

function coerceMarketToSchema(
  raw: unknown,
  ontology: PropertyIntelligenceObject
): z.infer<typeof marketIntelligenceSchema> {
  const d = defaultMarket(ontology);
  if (!raw || typeof raw !== 'object') return d;
  const m = raw as Record<string, unknown>;
  const v = ontology.registry.appraisedValueUsd.value ?? 0;
  const evr = m.estimatedValueRange as Record<string, unknown> | undefined;
  const min = evr ? coerceNum(evr.min, Math.round(v * 0.9)) : Math.round(v * 0.9);
  const max = evr ? coerceNum(evr.max, Math.round(v * 1.1)) : Math.round(v * 1.1);

  const invRaw = String(m.investmentRating ?? 'B');
  const investmentRating = (['AAA', 'AA', 'A', 'B', 'C'].includes(invRaw)
    ? invRaw
    : 'B') as z.infer<typeof marketIntelligenceSchema>['investmentRating'];

  const driversRaw = m.demandDrivers;
  const demandDrivers = Array.isArray(driversRaw)
    ? driversRaw.map((x) => String(x))
    : d.demandDrivers;

  return {
    estimatedValueRange: { min, max },
    sellVelocityScore: coerceNum(m.sellVelocityScore, d.sellVelocityScore),
    migrationProbability: coerceNum(m.migrationProbability, d.migrationProbability),
    rentalYieldEstimate: coerceNum(m.rentalYieldEstimate, d.rentalYieldEstimate),
    demandDrivers,
    investmentRating,
    bestUseStrategy: String(m.bestUseStrategy ?? d.bestUseStrategy),
    migrationTrendNote:
      m.migrationTrendNote != null && m.migrationTrendNote !== ''
        ? String(m.migrationTrendNote)
        : undefined,
  };
}

function coerceRankedRows(rows: RankedModel[]): RankedModel[] {
  return rows.map((row, i) => ({
    modelId: String(row.modelId),
    modelName: String(row.modelName),
    rank:
      typeof row.rank === 'number' && row.rank > 0 && Number.isInteger(row.rank)
        ? row.rank
        : i + 1,
    feasibilityScore: Math.max(0, Math.min(1, coerceNum(row.feasibilityScore, 0.5))),
    blockers: Array.isArray(row.blockers) ? row.blockers.map((b) => String(b)) : [],
    notes: row.notes != null && row.notes !== '' ? String(row.notes) : undefined,
  }));
}

function defaultMarket(ontology: PropertyIntelligenceObject): z.infer<typeof marketIntelligenceSchema> {
  const v = ontology.registry.appraisedValueUsd.value ?? 0;
  return {
    estimatedValueRange: { min: Math.round(v * 0.9), max: Math.round(v * 1.1) },
    sellVelocityScore: 5,
    migrationProbability: 50,
    rentalYieldEstimate: 5.5,
    demandDrivers: ['Heuristic placeholder — model output incomplete'],
    investmentRating: 'B',
    bestUseStrategy: 'Confirm with local zoning and market comps.',
  };
}

export function buildPropertyIntelligenceCard(
  ontology: PropertyIntelligenceObject,
  bundle: IngestionBundle,
  lat: number,
  lon: number,
  ownerLookupUrl: string,
  publicRecordsNote: string
) {
  const rentcastProp = bundle.rentcast?.property as Record<string, unknown> | null | undefined;
  const building = bundle.osm?.building;
  const existingStructure =
    rentcastProp?.propertyType || building?.buildingType || 'none';

  return {
    address: ontology.address.street,
    city: ontology.address.city,
    state: ontology.address.state,
    county: ontology.address.county,
    coordinates: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    lotSize_sqft: ontology.site.lotSize_sqft,
    elevation_ft: bundle.usgs?.elevation_ft ?? null,
    existingStructure: String(existingStructure),
    ownerLookupUrl,
    publicRecordsNote,
  };
}

/**
 * Merges LLM JSON with authoritative server layers (registry, hazard, feasibility clamp).
 */
export function mergeAndValidateParcelisResponse(args: {
  parsed: Parsed;
  ontology: PropertyIntelligenceObject;
  bundle: IngestionBundle;
  houseModels: HouseModel[];
  lat: number;
  lon: number;
  registryConnector: { name: string; url: string } | null;
  cadPresent: boolean;
}): { ok: true; data: z.infer<typeof parcelisAnalyzeResponseSchema> } | { ok: false; error: string } {
  const { parsed, ontology, bundle, houseModels, lat, lon, registryConnector, cadPresent } = args;

  const hazardProfile = buildHazardProfile(
    bundle.fema,
    bundle.usgs,
    bundle.osm,
    ontology.identifiers.countyFips
  );

  const appraisedNum = ontology.registry.appraisedValueUsd.value ?? 0;
  const registryData = {
    ownerName: ontology.registry.ownerName.value,
    appraisedValue: `$${appraisedNum.toLocaleString()}`,
    legalDescription: ontology.identifiers.legalDescription.value,
    lastUpdated: new Date().toLocaleDateString(),
    source: cadPresent
      ? 'Official CAD Scraper'
      : `RentCast / ${registryConnector?.name || 'County Assessor'}`,
    provenance: {
      owner: provenanceEnum(ontology.registry.ownerName.source),
      value: provenanceEnum(ontology.registry.appraisedValueUsd.source),
    },
  };

  const googleFallback = `https://www.google.com/search?q=${encodeURIComponent(
    ontology.address.county + ' county assessor property search'
  )}`;
  const ownerLookupUrl = registryConnector?.url ?? googleFallback;
  const sourceNote = cadPresent
    ? 'Data scraped directly from Official CAD records.'
    : 'Data pulled from RentCast AVM or inferred from parcel APIs.';

  const rawFit = (parsed.fitScores as Record<string, unknown> | undefined) ?? {};
  const fitScores = coerceFitScoresRecord(rawFit);

  const clamped = applyServerFeasibilityClamp(houseModels, fitScores, {
    estimatedMaxSlopePercent: hazardProfile.siteConstraints.estimatedMaxSlopePercent,
    inFloodZone: hazardProfile.flood.inFloodZone,
    floodZone: hazardProfile.flood.zone,
  });

  const fitScoresMerged: Record<string, number> = { ...fitScores };
  for (const row of clamped) {
    fitScoresMerged[row.modelId] = row.feasibilityScore;
  }
  const fitScoresForSchema = coerceFitScoresRecord(
    fitScoresMerged as unknown as Record<string, unknown>
  );

  const mf = parsed.modelFeasibility as { synthesizedInsights?: unknown } | undefined;
  const aiInsights = Array.isArray(mf?.synthesizedInsights)
    ? mf.synthesizedInsights.map((x) => String(x))
    : [];
  const reasoning = Array.isArray(parsed.reasoningStrings)
    ? parsed.reasoningStrings.map((x) => String(x))
    : [];

  const synthesizedInsights = uniqueStrings([
    ...aiInsights,
    ...reasoning,
    ...hazardProfile.siteConstraints.notes,
  ]);

  const mfParsed = parsed.modelFeasibility as { ranked?: RankedModel[] } | undefined;
  const mergedRanked =
    clamped.length > 0
      ? clamped
      : Array.isArray(mfParsed?.ranked) && mfParsed!.ranked!.length > 0
        ? (mfParsed!.ranked as RankedModel[])
        : [];
  const rankedForSchema = coerceRankedRows(mergedRanked);

  const marketIntelligence = coerceMarketToSchema(parsed.marketIntelligence, ontology);

  const propertyIntelligence = buildPropertyIntelligenceCard(
    ontology,
    bundle,
    lat,
    lon,
    ownerLookupUrl,
    sourceNote
  );

  const connectorErr: Record<string, string> = {};
  for (const [k, v] of Object.entries(bundle.connectorErrors)) {
    connectorErr[k] = String(v);
  }

  const out = {
    registryData,
    marketIntelligence,
    hazardProfile,
    modelFeasibility: {
      ranked: rankedForSchema,
      synthesizedInsights: synthesizedInsights.map(String),
    },
    propertyIntelligence,
    fitScores: fitScoresForSchema,
    reasoningStrings: coerceStringArray(parsed.reasoningStrings),
    constraintsDetected: coerceStringArray(parsed.constraintsDetected),
    recommendedHouseTypes: coerceStringArray(parsed.recommendedHouseTypes),
    registryConnector: registryConnector ?? undefined,
    connectorErrors:
      Object.keys(connectorErr).length > 0 ? connectorErr : undefined,
  };

  const safe = parcelisAnalyzeResponseSchema.safeParse(out);
  if (!safe.success) {
    console.error('[Parcelis] Zod validation failed:', safe.error.flatten());
    return { ok: false, error: 'Model output failed schema validation' };
  }

  return { ok: true, data: safe.data };
}
