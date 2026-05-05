import type { IngestionBundle } from './connectors';
import { zoningHintForCountyFips } from './countyZoningHints';
import type { FemaFloodData } from './connectors/fema';
import type { USGSData } from './connectors/usgs';
import type { OSMData } from './connectors/osm';

export type FieldProvenance = 'cad' | 'rentcast' | 'merged' | 'none';

export interface ProvenanceField<T> {
  value: T;
  source: FieldProvenance;
  confidence: 'high' | 'medium' | 'low';
}

export interface PropertyIntelligenceObject {
  identifiers: {
    apn: string | null;
    parcelId: string | null;
    legalDescription: ProvenanceField<string>;
    countyFips: string | null;
  };
  registry: {
    ownerName: ProvenanceField<string>;
    appraisedValueUsd: ProvenanceField<number | null>;
  };
  address: {
    street: string;
    city: string;
    state: string;
    postcode: string;
    county: string;
  };
  site: {
    lotSize_sqft: number;
    coordinates: { lat: number; lon: number };
  };
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function buildPropertyIntelligence(
  bundle: IngestionBundle,
  lat: number,
  lon: number,
  streetFallback: string
): PropertyIntelligenceObject {
  const { census, osm, rentcast, cad } = bundle;
  const nominatim = (osm?.nominatim || {}) as Record<string, any>;
  const addr = (nominatim.address || {}) as Record<string, string>;

  const prop = rentcast?.property;
  const street =
    str(prop?.addressLine1) || streetFallback || str(nominatim.display_name)?.split(',')[0]?.trim() || 'Unknown Site';
  const city =
    str(prop?.city) || census?.city || addr.city || addr.town || 'Unknown';
  const state = str(prop?.state) || addr.state || 'TX';
  const postcode = str(prop?.zipCode) || addr.postcode || '';
  const county = census?.county || addr.county || 'Unknown';

  const countyFips = census?.countyFIPS && census.countyFIPS !== 'Unknown' ? census.countyFIPS : null;

  const building = osm?.building;
  const lotSize = num(prop?.lotSize) ?? (building ? 4500 : 7500);

  let rentOwner: string | null = null;
  if (prop && Array.isArray(prop.owners) && prop.owners[0] && typeof prop.owners[0] === 'object') {
    rentOwner = str((prop.owners[0] as { name?: string }).name);
  }
  rentOwner = rentOwner || str(prop?.ownerName);
  const rentLegal = str(prop?.legalDescription);
  const rentAssessorId = str(prop?.assessorID) || str(prop?.id);

  const cadOwner = cad?.ownerName ?? null;
  const cadValue = cad?.appraisedValue ?? null;
  const cadLegal = cad?.legalDescription ?? null;

  const ownerName: ProvenanceField<string> = cadOwner
    ? { value: cadOwner, source: 'cad', confidence: 'high' }
    : rentOwner
      ? { value: rentOwner, source: 'rentcast', confidence: 'medium' }
      : { value: 'Private Owner', source: 'none', confidence: 'low' };

  const rentPrice = num(rentcast?.valuation?.price);
  const appraisedValueUsd: ProvenanceField<number | null> =
    cadValue != null
      ? { value: cadValue, source: 'cad', confidence: 'high' }
      : rentPrice != null
        ? { value: rentPrice, source: 'rentcast', confidence: 'medium' }
        : { value: lotSize * 10, source: 'rentcast', confidence: 'low' };

  const legalDescription: ProvenanceField<string> =
    cadLegal && cadLegal.length > 0
      ? { value: cadLegal, source: 'cad', confidence: 'high' }
      : rentLegal
        ? { value: rentLegal, source: 'rentcast', confidence: 'medium' }
        : {
            value: 'Access official county records via connector or assessor search.',
            source: 'none',
            confidence: 'low',
          };

  return {
    identifiers: {
      apn: rentAssessorId,
      parcelId: rentAssessorId,
      legalDescription,
      countyFips,
    },
    registry: {
      ownerName,
      appraisedValueUsd,
    },
    address: {
      street,
      city,
      state,
      postcode,
      county,
    },
    site: {
      lotSize_sqft: lotSize,
      coordinates: { lat, lon },
    },
  };
}

export function buildHazardProfile(
  fema: FemaFloodData | null,
  usgs: USGSData | null,
  osm: OSMData | null,
  countyFips: string | null
) {
  const flood = fema ?? {
    inFloodZone: false,
    zone: null,
    zoneDescription: null,
    baseFloodElevation_ft: null,
    staticBfe: null,
    source: 'unavailable',
    disclaimer: 'FEMA connector did not return data.',
    rawAttributes: null,
  };

  const elevation_ft = usgs?.elevation_ft ?? null;
  const slopePct = usgs?.estimatedMaxSlopePercent ?? null;

  const notes: string[] = [];
  if (slopePct != null && slopePct >= 15) {
    notes.push(`Estimated max slope ~${slopePct.toFixed(1)}% (EPQS heuristic; confirm with survey).`);
  }
  if (flood?.inFloodZone) {
    notes.push('Special Flood Hazard Area likely — engineered flood determination required for build decisions.');
  }

  const countyHint = zoningHintForCountyFips(countyFips || undefined);

  const zu = osm?.zoningTags?.length ? osm.zoningTags : [];
  const lu = osm?.landuseTags?.length ? osm.landuseTags : [];

  return {
    flood: {
      inFloodZone: flood.inFloodZone,
      zone: flood.zone,
      zoneDescription: flood.zoneDescription,
      baseFloodElevation_ft: flood.baseFloodElevation_ft,
      source: flood.source,
      disclaimer: flood.disclaimer,
    },
    elevation_ft,
    siteConstraints: {
      estimatedMaxSlopePercent: slopePct,
      slopeMethod: usgs?.slopeMethod ?? 'USGS EPQS unavailable',
      notes,
    },
    zoningInference: {
      landuseTags: lu,
      zoningTags: zu,
      countyZoningHint: countyHint,
      confidence: zu.length || lu.length ? ('medium' as const) : ('low' as const),
      disclaimer:
        'OSM-inferred land use / zoning tags only — not a substitute for municipal zoning verification.',
    },
  };
}
