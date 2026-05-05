import { NOMINATIM_USER_AGENT, OVERPASS_USER_AGENT } from '../constants';
import { cacheGet, cacheKeyGeo, cacheSet } from '../cache';
import type { ConnectorResult } from './types';
import { fail, ok } from './types';

export interface OSMData {
  nominatim: Record<string, unknown>;
  building: Record<string, string> | null;
  landuseTags: string[];
  zoningTags: string[];
  otherLandTags: string[];
}

function collectTagValues(elements: { tags?: Record<string, string> }[] | undefined, keys: string[]): string[] {
  const out = new Set<string>();
  for (const el of elements || []) {
    const t = el.tags;
    if (!t) continue;
    for (const k of keys) {
      const v = t[k];
      if (v) out.add(`${k}=${v}`);
    }
  }
  return [...out];
}

export async function connectOSM(lat: number, lon: number): Promise<ConnectorResult<OSMData>> {
  const cacheKey = cacheKeyGeo('osm', lat, lon);
  try {
    const cached = await cacheGet<OSMData>(cacheKey);
    if (cached) return ok('osm', cached);

    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'User-Agent': NOMINATIM_USER_AGENT } }
    );
    const nominatim = nomRes.ok ? ((await nomRes.json()) as Record<string, unknown>) : {};

    const radius = 80;
    const overpassQuery = `
[out:json][timeout:25];
(
  way(around:${radius},${lat},${lon})["building"];
  way(around:${radius},${lat},${lon})["landuse"];
  way(around:${radius},${lat},${lon})["zoning"];
  node(around:${radius},${lat},${lon})["natural"];
  way(around:${radius},${lat},${lon})["natural"];
);
out body;
`;
    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': OVERPASS_USER_AGENT,
      },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });
    const overpass = overpassRes.ok ? await overpassRes.json() : { elements: [] };
    const elements = overpass.elements as { tags?: Record<string, string> }[];

    let building: Record<string, string> | null = null;
    for (const el of elements) {
      if (el.tags?.building) {
        building = el.tags;
        break;
      }
    }

    const landuseTags = collectTagValues(elements, ['landuse']);
    const zoningTags = collectTagValues(elements, ['zoning']);
    const otherLandTags = collectTagValues(elements, ['natural', 'amenity', 'boundary']);

    const data: OSMData = {
      nominatim,
      building,
      landuseTags,
      zoningTags,
      otherLandTags,
    };
    await cacheSet(cacheKey, data, 60 * 60 * 6);
    return ok('osm', data);
  } catch (e) {
    console.error('connectOSM', e);
    return fail('osm', e);
  }
}
