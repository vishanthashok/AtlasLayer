import { z } from 'zod';

export const registryDataSchema = z.object({
  ownerName: z.string(),
  appraisedValue: z.string(),
  legalDescription: z.string(),
  lastUpdated: z.string(),
  source: z.string(),
  provenance: z
    .object({
      owner: z.enum(['cad', 'rentcast', 'none']).optional(),
      value: z.enum(['cad', 'rentcast', 'none']).optional(),
    })
    .optional(),
});

export const marketIntelligenceSchema = z.object({
  estimatedValueRange: z.object({ min: z.number(), max: z.number() }),
  sellVelocityScore: z.number(),
  migrationProbability: z.number(),
  rentalYieldEstimate: z.number(),
  demandDrivers: z.array(z.string()),
  investmentRating: z.enum(['AAA', 'AA', 'A', 'B', 'C']),
  bestUseStrategy: z.string(),
  migrationTrendNote: z.string().optional(),
});

export const hazardProfileSchema = z.object({
  flood: z.object({
    inFloodZone: z.boolean(),
    zone: z.string().nullable(),
    zoneDescription: z.string().nullable(),
    baseFloodElevation_ft: z.number().nullable().optional(),
    source: z.string(),
    disclaimer: z.string(),
  }),
  elevation_ft: z.number().nullable(),
  siteConstraints: z.object({
    estimatedMaxSlopePercent: z.number().nullable(),
    slopeMethod: z.string(),
    notes: z.array(z.string()),
  }),
  zoningInference: z.object({
    landuseTags: z.array(z.string()),
    zoningTags: z.array(z.string()),
    countyZoningHint: z.string().nullable(),
    confidence: z.enum(['high', 'medium', 'low']),
    disclaimer: z.string().optional(),
  }),
});

export const modelFeasibilitySchema = z.object({
  ranked: z.array(
    z.object({
      modelId: z.string(),
      modelName: z.string(),
      rank: z.number().int().positive(),
      feasibilityScore: z.number().min(0).max(1),
      blockers: z.array(z.string()),
      notes: z.string().optional(),
    })
  ),
  synthesizedInsights: z.array(z.string()),
});

/** Strict validated envelope + optional legacy UI fields. */
export const parcelisAnalyzeResponseSchema = z
  .object({
    registryData: registryDataSchema,
    marketIntelligence: marketIntelligenceSchema,
    hazardProfile: hazardProfileSchema,
    modelFeasibility: modelFeasibilitySchema,
    propertyIntelligence: z.record(z.string(), z.unknown()).optional(),
    reasoningStrings: z.array(z.string()).optional(),
    constraintsDetected: z.array(z.string()).optional(),
    fitScores: z.record(z.string(), z.number()).optional(),
    recommendedHouseTypes: z.array(z.string()).optional(),
    propertyData: z.unknown().optional(),
    registryConnector: z.unknown().optional(),
    connectorErrors: z.record(z.string(), z.string()).optional(),
  });

export type ParcelisAnalyzeResponse = z.infer<typeof parcelisAnalyzeResponseSchema>;
