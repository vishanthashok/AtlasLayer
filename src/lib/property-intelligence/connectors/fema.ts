import { cacheGet, cacheKeyGeo, cacheSet } from '../cache';
import type { ConnectorResult } from './types';
import { fail, ok } from './types';

/** NFHL Flood Hazard Zones layer (public MapServer). */
const FEMA_NFHL_ZONE_LAYER =
  'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query';

export interface FemaFloodData {
  inFloodZone: boolean;
  zone: string | null;
  zoneDescription: string | null;
  baseFloodElevation_ft: number | null;
  staticBfe: string | null;
  source: string;
  disclaimer: string;
  rawAttributes: Record<string, unknown> | null;
}

function pickString(attr: Record<string, unknown> | null, keys: string[]): string | null {
  if (!attr) return null;
  for (const k of keys) {
    const v = attr[k];
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return null;
}

function pickNumber(attr: Record<string, unknown> | null, keys: string[]): number | null {
  if (!attr) return null;
  for (const k of keys) {
    const v = attr[k];
    if (v == null) continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export async function connectFEMA(lat: number, lon: number): Promise<ConnectorResult<FemaFloodData>> {
  const cacheKey = cacheKeyGeo('fema', lat, lon);
  try {
    const cached = await cacheGet<FemaFloodData>(cacheKey);
    if (cached) return ok('fema', cached);

    const params = new URLSearchParams({
      geometry: `${lon},${lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'false',
      f: 'json',
    });
    const url = `${FEMA_NFHL_ZONE_LAYER}?${params.toString()}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      return ok('fema', {
        inFloodZone: false,
        zone: null,
        zoneDescription: null,
        baseFloodElevation_ft: null,
        staticBfe: null,
        source: 'FEMA NFHL (unavailable)',
        disclaimer: 'FEMA service returned a non-OK response; consult official maps before decisions.',
        rawAttributes: null,
      });
    }
    const json = (await res.json()) as {
      features?: { attributes?: Record<string, unknown> }[];
    };
    const attr = json.features?.[0]?.attributes ?? null;
    const zone = pickString(attr, ['FLD_ZONE', 'FLDZONE', 'ZONE', 'ZONE_SUBTY']);
    const zoneDesc = pickString(attr, ['ZONE_DESC', 'FLDZONE_DESC', 'SFHA_TF']);
    const bfe = pickNumber(attr, ['STATIC_BFE', 'DEPTH', 'ELEV']);
    const staticBfe = pickString(attr, ['STATIC_BFE']);

    const inZone = Boolean(zone && !/^X/i.test(zone.replace(/\s/g, '')) && zone !== 'OPEN WATER');

    const data: FemaFloodData = {
      inFloodZone: Boolean(attr && (inZone || /^(A|AE|AH|AO|AR|A99|V|VE)/i.test(zone || ''))),
      zone,
      zoneDescription: zoneDesc,
      baseFloodElevation_ft: bfe,
      staticBfe,
      source: 'FEMA NFHL via ArcGIS REST (layer 28)',
      disclaimer:
        'Informational only. Official flood determination requires engineering study and current FIRM panels.',
      rawAttributes: attr,
    };

    // Refine inFloodZone: if we have a zone letter A/V or AE etc.
    if (zone && /^(A|AE|AH|AO|AR|V|VE)/i.test(zone)) {
      data.inFloodZone = true;
    }

    await cacheSet(cacheKey, data, 60 * 60 * 24);
    return ok('fema', data);
  } catch (e) {
    console.error('connectFEMA', e);
    return fail('fema', e);
  }
}
