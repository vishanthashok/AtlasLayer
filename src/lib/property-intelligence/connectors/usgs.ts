import destination from '@turf/destination';
import { point } from '@turf/helpers';
import type { ConnectorResult } from './types';
import { fail, ok } from './types';
import { cacheGet, cacheKeyGeo, cacheSet } from '../cache';

export interface EpqsSample {
  lat: number;
  lon: number;
  elevation_ft: number | null;
}

export interface USGSData {
  elevation_ft: number | null;
  estimatedMaxSlopePercent: number | null;
  slopeMethod: string;
  epqsSamples: EpqsSample[];
}

async function epqsElevation(lon: number, lat: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Feet&only_wms=false`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data.value !== 'undefined') {
      return Math.round(Number(data.value));
    }
    return null;
  } catch {
    return null;
  }
}

/** ~80 m cardinal offsets in WGS84 using turf (km input). */
function cardinalOffsets(lat: number, lon: number): { lat: number; lon: number; label: string }[] {
  const origin = point([lon, lat]);
  const km = 0.08;
  const bearings = [
    { b: 0, label: 'N' },
    { b: 90, label: 'E' },
    { b: 180, label: 'S' },
    { b: 270, label: 'W' },
  ];
  return bearings.map(({ b, label }) => {
    // turf distance uses [lng, lat]; destination from turf/helpers
    const dest = destination(origin, km, b, { units: 'kilometers' });
    const coords = dest.geometry.coordinates;
    return { lat: coords[1], lon: coords[0], label };
  });
}

export async function connectUSGS(lat: number, lon: number): Promise<ConnectorResult<USGSData>> {
  const cacheKey = cacheKeyGeo('usgs', lat, lon);
  try {
    const cached = await cacheGet<USGSData>(cacheKey);
    if (cached) return ok('usgs', cached);

    const centerEl = await epqsElevation(lon, lat);
    const offsets = cardinalOffsets(lat, lon);
    const samples: EpqsSample[] = [{ lat, lon, elevation_ft: centerEl }];

    const elevPromises = offsets.map((o) =>
      epqsElevation(o.lon, o.lat).then((e) => ({
        lat: o.lat,
        lon: o.lon,
        elevation_ft: e,
      }))
    );
    samples.push(...(await Promise.all(elevPromises)));

    let maxSlope: number | null = null;
    const center = samples[0]?.elevation_ft;
    if (center != null) {
      const horizontalFt = 80 * 3.28084; // 80 m → ft (approx horizontal leg)
      for (let i = 1; i < samples.length; i++) {
        const e = samples[i]?.elevation_ft;
        if (e == null) continue;
        const riseFt = Math.abs(center - e);
        const pct = (riseFt / horizontalFt) * 100;
        if (maxSlope === null || pct > maxSlope) maxSlope = pct;
      }
    }

    const data: USGSData = {
      elevation_ft: centerEl,
      estimatedMaxSlopePercent: maxSlope,
      slopeMethod:
        'Heuristic: USGS EPQS at center and 4 points ~80 m away; not survey-grade.',
      epqsSamples: samples,
    };
    await cacheSet(cacheKey, data, 60 * 60 * 12);
    return ok('usgs', data);
  } catch (e) {
    console.error('connectUSGS', e);
    return fail('usgs', e);
  }
}
