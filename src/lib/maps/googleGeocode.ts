/** Browser-callable Geocoding API (requires Geocoding API enabled for the key). */

export async function googleReverseGeocode(
  lat: number,
  lng: number,
  apiKey: string
): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    results?: { formatted_address: string }[];
  };
  if (data.status !== 'OK' || !data.results?.[0]) return null;
  return data.results[0].formatted_address;
}

export async function googleForwardGeocode(
  address: string,
  apiKey: string
): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
  };
  if (data.status !== 'OK' || !data.results?.[0]) return null;
  const r = data.results[0];
  const { lat, lng } = r.geometry.location;
  return { lat, lng, formatted: r.formatted_address };
}
