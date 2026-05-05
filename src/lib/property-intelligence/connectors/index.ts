import type { CensusData } from './census';
import { connectCensus } from './census';
import type { OSMData } from './osm';
import { connectOSM } from './osm';
import type { USGSData } from './usgs';
import { connectUSGS } from './usgs';
import type { RentCastBundle } from './rentcast';
import { connectRentCast } from './rentcast';
import type { FemaFloodData } from './fema';
import { connectFEMA } from './fema';
import { connectCAD } from './cad';
import type { CadScrapeResult } from '../../../services/cadScraper';
import type { ConnectorSource } from './types';
import type { ConnectorResult } from './types';

export type IngestionBundle = {
  census: CensusData | null;
  osm: OSMData | null;
  usgs: USGSData | null;
  rentcast: RentCastBundle | null;
  cad: CadScrapeResult | null;
  fema: FemaFloodData | null;
  connectorErrors: Partial<Record<ConnectorSource, string>>;
};

function unwrapSettled<T>(
  settled: PromiseSettledResult<ConnectorResult<T>>,
  source: ConnectorSource,
  fallback: T,
  errors: Partial<Record<ConnectorSource, string>>
): T {
  if (settled.status === 'rejected') {
    errors[source] = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
    return fallback;
  }
  const r = settled.value;
  if (!r.ok) {
    errors[r.source] = r.error;
    return fallback;
  }
  return r.data as T;
}

/**
 * Census county name or OSM Nominatim county (Helotes→Bexar, Leander→Williamson vs Travis by pin).
 */
export function deriveCountyNameForCad(
  census: CensusData | null,
  osm: OSMData | null
): string | null {
  const c = census?.county;
  if (c && c !== 'Unknown') {
    return c.replace(/\s+County$/i, '').trim();
  }
  const nom = osm?.nominatim as { address?: { county?: string } } | undefined;
  const oc = nom?.address?.county;
  if (oc && typeof oc === 'string') {
    return oc.replace(/\s+County$/i, '').trim();
  }
  return null;
}

/**
 * Phase 1: parallel ingestion without CAD (county unknown until Census/OSM return).
 * Phase 2: CAD scrape routed by derived county + address.
 */
export async function runAllConnectors(
  lat: number,
  lon: number,
  address: string | undefined
): Promise<IngestionBundle> {
  const errors: Partial<Record<ConnectorSource, string>> = {};

  const settled = await Promise.allSettled([
    connectCensus(lat, lon),
    connectOSM(lat, lon),
    connectUSGS(lat, lon),
    connectRentCast(lat, lon),
    connectFEMA(lat, lon),
  ]);

  const census = unwrapSettled(settled[0]!, 'census', null, errors) as CensusData | null;
  const osm = unwrapSettled(settled[1]!, 'osm', null, errors) as OSMData | null;
  const usgs = unwrapSettled(settled[2]!, 'usgs', null, errors) as USGSData | null;
  const rentcast = unwrapSettled(settled[3]!, 'rentcast', null, errors) as RentCastBundle | null;
  const fema = unwrapSettled(settled[4]!, 'fema', null, errors) as FemaFloodData | null;

  const countyForCad = deriveCountyNameForCad(census, osm);

  const cadSettled = await Promise.allSettled([connectCAD(address, countyForCad)]);
  const cad = unwrapSettled(cadSettled[0]!, 'cad', null, errors) as CadScrapeResult | null;

  return {
    census,
    osm,
    usgs,
    rentcast,
    cad,
    fema,
    connectorErrors: errors,
  };
}

export * from './census';
export * from './osm';
export * from './usgs';
export * from './rentcast';
export * from './fema';
export * from './cad';
export * from './types';
