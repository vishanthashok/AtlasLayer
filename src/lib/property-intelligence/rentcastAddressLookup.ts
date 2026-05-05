import { NOMINATIM_USER_AGENT } from './constants';

export async function nominatimForwardGeocode(
  address: string
): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as { lat?: string; lon?: string }[];
    if (!Array.isArray(arr) || !arr[0]) return null;
    const lat = parseFloat(String(arr[0].lat));
    const lon = parseFloat(String(arr[0].lon));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

/**
 * Fallback when CAD scrapers fail: geocode address, then nearest RentCast parcel + AVM.
 */
export async function lookupRentCastByAddress(address: string): Promise<{
  ownerName: string | null;
  appraisedValue: number | null;
  parcelId: string | null;
  legalDescription: string | null;
  lastUpdated: string | null;
} | null> {
  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey || apiKey === 'your_rentcast_api_key_here') return null;

  const geo = await nominatimForwardGeocode(address);
  if (!geo) return null;

  const { lat, lon } = geo;
  try {
    const propRes = await fetch(
      `https://api.rentcast.io/v1/properties?latitude=${lat}&longitude=${lon}&radius=0.05&limit=1`,
      { headers: { 'X-Api-Key': apiKey } }
    );
    const properties = (propRes.ok ? await propRes.json() : []) as Record<string, unknown>[];
    const property = properties[0];
    if (!property || typeof property !== 'object') return null;

    let ownerName: string | null = null;
    const owners = property.owners;
    if (Array.isArray(owners) && owners[0] && typeof owners[0] === 'object') {
      ownerName = String((owners[0] as { name?: string }).name || '').trim() || null;
    }
    if (!ownerName && property.ownerName != null) {
      ownerName = String(property.ownerName).trim() || null;
    }

    const parcelId =
      property.assessorID != null
        ? String(property.assessorID)
        : property.id != null
          ? String(property.id)
          : property.apn != null
            ? String(property.apn)
            : null;

    const legalDescription =
      property.legalDescription != null ? String(property.legalDescription).trim() || null : null;

    const line1 = String(property.addressLine1 || '');
    const city = String(property.city || '');
    const st = String(property.state || '');
    const zip = String(property.zipCode || '');
    let appraisedValue: number | null = null;
    if (line1) {
      const valRes = await fetch(
        `https://api.rentcast.io/v1/avm/value?address=${encodeURIComponent(`${line1}, ${city}, ${st} ${zip}`)}`,
        { headers: { 'X-Api-Key': apiKey } }
      );
      if (valRes.ok) {
        const val = (await valRes.json()) as { price?: number };
        if (typeof val.price === 'number' && Number.isFinite(val.price)) {
          appraisedValue = Math.round(val.price);
        }
      }
    }

    const lastRaw = property.lastSaleDate ?? property.updatedDate;
    const lastUpdated =
      lastRaw != null && String(lastRaw).trim() ? String(lastRaw).slice(0, 10) : null;

    if (!ownerName && appraisedValue == null && !parcelId && !legalDescription) {
      return null;
    }

    return {
      ownerName,
      appraisedValue,
      parcelId,
      legalDescription,
      lastUpdated,
    };
  } catch (e) {
    console.warn('[rentcastAddressLookup]', e);
    return null;
  }
}
