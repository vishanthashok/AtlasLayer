import { cacheGet, cacheKeyGeo, cacheSet } from '../cache';
import type { ConnectorResult } from './types';
import { fail, ok } from './types';

export interface RentCastBundle {
  property: Record<string, unknown> | null;
  valuation: Record<string, unknown> | null;
}

export async function connectRentCast(lat: number, lon: number): Promise<ConnectorResult<RentCastBundle | null>> {
  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey || apiKey === 'your_rentcast_api_key_here') {
    return ok('rentcast', null);
  }

  const cacheKey = cacheKeyGeo('rentcast', lat, lon);
  try {
    const cached = await cacheGet<RentCastBundle>(cacheKey);
    if (cached) return ok('rentcast', cached);

    const propRes = await fetch(
      `https://api.rentcast.io/v1/properties?latitude=${lat}&longitude=${lon}&radius=0.01&limit=1`,
      { headers: { 'X-Api-Key': apiKey } }
    );
    const properties = (propRes.ok ? await propRes.json() : []) as Record<string, unknown>[];
    const property = (properties[0] as Record<string, unknown>) || null;

    let valuation: Record<string, unknown> | null = null;
    if (property) {
      const line1 = String(property.addressLine1 || '');
      const city = String(property.city || '');
      const st = String(property.state || '');
      const zip = String(property.zipCode || '');
      const valRes = await fetch(
        `https://api.rentcast.io/v1/avm/value?address=${encodeURIComponent(`${line1}, ${city}, ${st} ${zip}`)}`,
        { headers: { 'X-Api-Key': apiKey } }
      );
      valuation = valRes.ok ? ((await valRes.json()) as Record<string, unknown>) : null;
    }

    const result: RentCastBundle = { property, valuation };
    await cacheSet(cacheKey, result, 60 * 60 * 6);
    return ok('rentcast', result);
  } catch (e) {
    console.error('connectRentCast', e);
    return fail('rentcast', e);
  }
}
