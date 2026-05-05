import type { ConnectorResult } from './types';
import { fail, ok } from './types';

export interface CensusData {
  censusTract: string;
  county: string;
  countyFIPS: string;
  city: string;
}

export async function connectCensus(lat: number, lon: number): Promise<ConnectorResult<CensusData | null>> {
  try {
    const res = await fetch(
      `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`
    );
    if (!res.ok) return ok('census', null);
    const data = await res.json();
    if (!data?.result?.geographies) return ok('census', null);

    const result = data.result.geographies;
    const out: CensusData = {
      censusTract: result['Census Tracts']?.[0]?.NAME || 'Unknown',
      county: result['Counties']?.[0]?.NAME || 'Unknown',
      countyFIPS: result['Counties']?.[0]?.GEOID || 'Unknown',
      city: result['Place']?.[0]?.NAME || 'Unincorporated Area',
    };
    return ok('census', out);
  } catch (e) {
    console.error('connectCensus', e);
    return fail('census', e);
  }
}
