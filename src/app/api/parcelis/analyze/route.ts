import { NextResponse } from 'next/server';
import { runAllConnectors } from '../../../../lib/property-intelligence/connectors';
import { buildPropertyIntelligence, buildHazardProfile } from '../../../../lib/property-intelligence/ontology';
import { buildQuantSystemPrompt, buildQuantUserPrompt } from '../../../../lib/property-intelligence/prompts';
import { generateQuantAnalysisJson } from '../../../../lib/property-intelligence/llm';
import { mergeAndValidateParcelisResponse } from '../../../../lib/property-intelligence/mergeResponse';
import { cacheGet, cacheSet, cacheKeyGeo } from '../../../../lib/property-intelligence/cache';
import { parseJsonFromModelOutput } from '../../../../lib/property-intelligence/extractJson';
import type { IngestionBundle } from '../../../../lib/property-intelligence/connectors';
import type { PropertyIntelligenceObject } from '../../../../lib/property-intelligence/ontology';

const ANALYSIS_SCHEMA_VER = 'v2';

function getRegistryConnector(streetAddress: string, cleanCounty: string | undefined) {
  if (!cleanCounty) return null;
  const registries: Record<string, { name: string; url: string }> = {
    Bexar: {
      name: 'Bexar CAD',
      url: `https://bexar.trueautomation.com/clientdb/propertysearch.aspx?cid=110&property_address=${encodeURIComponent(streetAddress)}`,
    },
    Travis: {
      name: 'Travis CAD',
      url: `https://travis.prodigycad.com/property-search?search_text=${encodeURIComponent(streetAddress)}`,
    },
    Williamson: {
      name: 'Williamson CAD',
      url: `https://search.wcad.org/Search?SearchText=${encodeURIComponent(streetAddress)}`,
    },
    Bastrop: {
      name: 'Bastrop CAD',
      url: `https://bastrop.trueautomation.com/clientdb/propertysearch.aspx?cid=94&property_address=${encodeURIComponent(streetAddress)}`,
    },
    Hays: {
      name: 'Hays CAD',
      url: `https://hays.trueautomation.com/clientdb/propertysearch.aspx?cid=91&property_address=${encodeURIComponent(streetAddress)}`,
    },
  };
  return registries[cleanCounty] ?? null;
}

function buildPropertyData(ontology: PropertyIntelligenceObject, bundle: IngestionBundle) {
  const nominatim = (bundle.osm?.nominatim || {}) as Record<string, any>;
  const building = bundle.osm?.building;
  const rentcast = bundle.rentcast?.property as Record<string, unknown> | null | undefined;
  const lotSize = ontology.site.lotSize_sqft;
  const { lat, lon } = ontology.site.coordinates;
  const elevationFt = bundle.usgs?.elevation_ft ?? null;

  return {
    address: {
      street: ontology.address.street,
      city: ontology.address.city,
      state: ontology.address.state,
      postcode: ontology.address.postcode,
      county: ontology.address.county,
      country: nominatim?.address?.country || 'USA',
      coordinates: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    },
    site: {
      lotSize_sqft: lotSize,
      lotSize_acres: (lotSize / 43560).toFixed(2),
      elevation_ft: elevationFt,
      topography: elevationFt != null ? (elevationFt > 1000 ? 'High Elevation' : 'Coastal/Lowland') : 'Unknown',
    },
    existingStructure:
      rentcast || building
        ? {
            type: String(rentcast?.propertyType || building?.buildingType || 'Building'),
            stories: rentcast?.stories || building?.buildingLevels || 'Unknown',
            yearBuilt: rentcast?.yearBuilt || 'Unknown',
            sqft: rentcast?.squareFootage || 'Unknown',
          }
        : null,
    extraTags: { ...building, ...rentcast },
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const land = body.land || {};
    const lat = Number(land.latitude);
    const lon = Number(land.longitude);
    const address = land.address as string | undefined;
    const houseModels = body.houseModels || [];
    const requestedModel = body.model || 'claude-sonnet-4-6';

    if (isNaN(lat) || isNaN(lon)) {
      throw new Error('Invalid or missing coordinates in request. Please select a point on the map.');
    }

    const cacheKey = cacheKeyGeo(`parcelis_${ANALYSIS_SCHEMA_VER}`, lat, lon, requestedModel);
    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      console.log('[Parcelis] Returning cached analysis for:', cacheKey);
      return NextResponse.json(cached);
    }

    const bundle = await runAllConnectors(lat, lon, address);
    const displayName = (bundle.osm?.nominatim as { display_name?: string } | undefined)?.display_name;
    const streetFallback = address || displayName?.split(',')[0]?.trim() || 'Unknown Site';
    const ontology = buildPropertyIntelligence(bundle, lat, lon, streetFallback);

    const cleanCounty = ontology.address.county?.replace(' County', '') || undefined;
    const streetForLink = ontology.address.street;
    const registryConnector = getRegistryConnector(streetForLink, cleanCounty);

    const hazardForPrompt = buildHazardProfile(
      bundle.fema,
      bundle.usgs,
      bundle.osm,
      ontology.identifiers.countyFips
    );

    const userPrompt = buildQuantUserPrompt({
      ontology,
      bundle,
      hazardJson: hazardForPrompt as unknown as Record<string, unknown>,
      houseModels,
      registryConnectorUrl: registryConnector?.url ?? null,
      streetAddress: `${ontology.address.street}, ${ontology.address.city}, ${ontology.address.state} ${ontology.address.postcode}`,
    });

    if (!process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
      throw new Error('Missing AI API Key');
    }

    const raw = await generateQuantAnalysisJson(
      requestedModel,
      buildQuantSystemPrompt(),
      userPrompt
    );

    const parsed = parseJsonFromModelOutput(raw);
    if (!parsed) {
      console.error('[Parcelis] Non-JSON model output (first 400 chars):', raw.slice(0, 400));
      return NextResponse.json({ error: 'Model returned non-JSON output' }, { status: 502 });
    }

    const merged = mergeAndValidateParcelisResponse({
      parsed,
      ontology,
      bundle,
      houseModels,
      lat,
      lon,
      registryConnector,
      cadPresent: Boolean(bundle.cad),
    });

    if (!merged.ok) {
      return NextResponse.json({ error: merged.error }, { status: 500 });
    }

    const propertyData = buildPropertyData(ontology, bundle);

    const result = {
      ...merged.data,
      propertyData,
    };

    await cacheSet(cacheKey, result, 60 * 60 * 24);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Parcelis Analysis Error:', error);
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
