import type { PropertyIntelligenceObject } from './ontology';
import type { IngestionBundle } from './connectors';

const SYSTEM_QUANT = `You are a quantitative real-estate development analyst (Quant Developer).
Rules:
- Output ONLY valid JSON. No markdown fences, no prose outside JSON.
- Ground every numeric claim in the INGESTION_PACKET; label speculation clearly if unavoidable.
- Produce "synthesizedInsights" that combine MULTIPLE data sources (e.g. high value + steep slope + flood zone → foundation cost / model infeasibility).
- Prefer terse bullet-style strings inside JSON arrays; no long paragraphs.
- Never invent parcel IDs, owners, or appraised values not supported by the packet; registry fields are authoritative when marked CAD.`;

export function buildQuantSystemPrompt(): string {
  return SYSTEM_QUANT;
}

export function buildQuantUserPrompt(args: {
  ontology: PropertyIntelligenceObject;
  bundle: IngestionBundle;
  hazardJson: Record<string, unknown>;
  houseModels: unknown[];
  registryConnectorUrl: string | null;
  streetAddress: string;
}): string {
  const { ontology, bundle, hazardJson, houseModels, registryConnectorUrl, streetAddress } = args;

  const packet = {
    ontology,
    connectorErrors: bundle.connectorErrors,
    hazardProfileServer: hazardJson,
    rentcastPresent: Boolean(bundle.rentcast?.property),
    cadPresent: Boolean(bundle.cad),
    femaPresent: Boolean(bundle.fema),
    usgsPresent: Boolean(bundle.usgs),
    models: houseModels,
    registryDeepLink: registryConnectorUrl,
  };

  return `INGESTION_PACKET (trust server-computed hazardProfileServer for flood/slope; you extend with interpretation only):
${JSON.stringify(packet)}

Target address context: ${streetAddress}

Return a SINGLE JSON object with EXACTLY these top-level keys:
- registryData: { ownerName, appraisedValue (formatted string with $), legalDescription, lastUpdated (MM/DD/YYYY), source, provenance? }
  Must align with ontology.registry and identifiers when CAD overrides RentCast.
- marketIntelligence: { estimatedValueRange, sellVelocityScore (1-10), migrationProbability (0-100), rentalYieldEstimate (percent number), demandDrivers[], investmentRating (AAA|AA|A|B|C), bestUseStrategy, migrationTrendNote? }
- hazardProfile: MUST echo hazardProfileServer values for flood, elevation_ft, siteConstraints, zoningInference (you may add short interpretation fields ONLY if nested — keep keys identical to schema expected by server merge).
- modelFeasibility: { ranked: [ { modelId, modelName, rank, feasibilityScore 0-1, blockers[], notes? } ], synthesizedInsights: string[] }
  Rank every provided model; synthesizedInsights MUST include cross-source reasoning.

Also include for backward compatibility:
- propertyIntelligence: { address, city, state, county, coordinates string, lotSize_sqft, elevation_ft, existingStructure, ownerLookupUrl, publicRecordsNote }
- reasoningStrings: string[] (short insights)
- constraintsDetected: string[]
- fitScores: { [modelId]: number 0-1 }
- recommendedHouseTypes: string[] (top 3 style names)

ownerLookupUrl: ${JSON.stringify(registryConnectorUrl || '')}`;
}
