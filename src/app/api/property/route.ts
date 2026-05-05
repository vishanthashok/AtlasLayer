import { NextResponse } from 'next/server';
import { scrapeBexarCAD, type CadScrapeResult, type CadSource } from '../../../services/cadScraper';
import { lookupRentCastByAddress } from '../../../lib/property-intelligence/rentcastAddressLookup';
import { scrapeTravisCAD } from '../../../services/cad/travisCad';
import { scrapeWilliamsonCAD } from '../../../services/cad/williamsonCad';
import {
  CadTimeoutError,
  normalizeAddress,
  normalizeCadResult,
  normalizeDate,
  scoreResult,
  withRetries,
  withTimeout,
} from '../../../services/cad/normalize';
import { detectCountyFromAddress, type CadCounty } from '../../../lib/property-intelligence/countyFromAddress';
import { cacheGet, cacheSet } from '../../../lib/property-intelligence/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PER_SCRAPER_TIMEOUT_MS = 9000;
const SCRAPE_RETRIES = 3;
const SUCCESS_TTL_SEC = 60 * 60 * 24; // 24h
const NEGATIVE_TTL_SEC = 60 * 5; // 5min — prevents retry storms

export type PropertyDataSource = CadSource | 'rentcast_estimate';

interface PropertyResponseSuccess {
  status: 'success' | 'partial';
  ownerName: string | null;
  appraisedValue: number | null;
  parcelId: string | null;
  legalDescription: string | null;
  lastUpdated: string | null;
  source: PropertyDataSource;
}

interface PropertyResponseError {
  status: 'error';
  reason: string;
  ownerName: null;
  appraisedValue: null;
  parcelId: null;
  legalDescription: null;
  lastUpdated: null;
  source: null;
}

type PropertyResponse = PropertyResponseSuccess | PropertyResponseError;

const SCRAPERS: Record<CadCounty, (addr: string) => Promise<CadScrapeResult | null>> = {
  bexar: scrapeBexarCAD,
  travis: scrapeTravisCAD,
  williamson: scrapeWilliamsonCAD,
};

const SOURCE_OF: Record<CadCounty, CadSource> = {
  bexar: 'bexar_cad',
  travis: 'travis_cad',
  williamson: 'williamson_cad',
};

/**
 * Run one CAD scraper with retries, capped by a hard timeout.
 * Logs timeouts/failures with per-attempt context.
 */
async function runScraper(
  county: CadCounty,
  address: string
): Promise<CadScrapeResult | null> {
  const fn = SCRAPERS[county];
  try {
    return await withTimeout(
      () => withRetries(() => fn(address), SCRAPE_RETRIES, 750),
      PER_SCRAPER_TIMEOUT_MS
    );
  } catch (e) {
    if (e instanceof CadTimeoutError) {
      console.warn(`[property] ${county} scraper timed out after ${PER_SCRAPER_TIMEOUT_MS}ms`);
    } else {
      console.warn(`[property] ${county} scraper failed:`, e instanceof Error ? e.message : e);
    }
    return null;
  }
}

function buildResponse(
  result: CadScrapeResult
): PropertyResponseSuccess {
  const status: 'success' | 'partial' =
    result.ownerName != null &&
    result.appraisedValue != null &&
    result.parcelId != null &&
    result.legalDescription != null
      ? 'success'
      : 'partial';

  return {
    status,
    ownerName: result.ownerName,
    appraisedValue: result.appraisedValue,
    parcelId: result.parcelId,
    legalDescription: result.legalDescription,
    lastUpdated: result.lastUpdated,
    source: result.source,
  };
}

function errorResponse(reason: string): PropertyResponseError {
  return {
    status: 'error',
    reason,
    ownerName: null,
    appraisedValue: null,
    parcelId: null,
    legalDescription: null,
    lastUpdated: null,
    source: null,
  };
}

/**
 * Tie-breaker for fan-out results: prefer the detected-county result, then Bexar→Travis→Williamson.
 */
function pickBest(
  candidates: Array<{ county: CadCounty; result: CadScrapeResult }>,
  preferred: CadCounty | null
): { county: CadCounty; result: CadScrapeResult } | null {
  if (candidates.length === 0) return null;
  const order: Record<CadCounty, number> = { bexar: 0, travis: 1, williamson: 2 };

  const sorted = [...candidates].sort((a, b) => {
    const sa = scoreResult(a.result);
    const sb = scoreResult(b.result);
    if (sb !== sa) return sb - sa;
    if (preferred) {
      if (a.county === preferred && b.county !== preferred) return -1;
      if (b.county === preferred && a.county !== preferred) return 1;
    }
    return order[a.county] - order[b.county];
  });

  return sorted[0] ?? null;
}

export async function GET(req: Request) {
  const t0 = Date.now();
  const url = new URL(req.url);
  const rawAddress = url.searchParams.get('address');

  if (!rawAddress || rawAddress.trim().length < 3) {
    return NextResponse.json(errorResponse('Missing or invalid address parameter'), {
      status: 400,
    });
  }

  const address = rawAddress.trim();
  const cacheKey = `property:v1:${normalizeAddress(address)}`;

  const cached = await cacheGet<PropertyResponse>(cacheKey);
  if (cached) {
    console.log('[property] cache hit', { address, status: cached.status });
    return NextResponse.json(cached);
  }

  const detected = detectCountyFromAddress(address);

  const counties: CadCounty[] = detected
    ? [detected]
    : (['bexar', 'travis', 'williamson'] as CadCounty[]);

  const settled = await Promise.allSettled(
    counties.map((c) => runScraper(c, address).then((r) => ({ county: c, result: r })))
  );

  const candidates: Array<{ county: CadCounty; result: CadScrapeResult }> = [];
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value.result) {
      candidates.push({
        county: s.value.county,
        result: { ...s.value.result, source: SOURCE_OF[s.value.county] },
      });
    }
  }

  if (candidates.length === 0) {
    const rentcast = await lookupRentCastByAddress(address);
    if (rentcast) {
      const owner = rentcast.ownerName?.replace(/\s+/g, ' ').trim() ?? null;
      const legal = rentcast.legalDescription?.replace(/\s+/g, ' ').trim() ?? null;
      const parcel = rentcast.parcelId?.replace(/\s+/g, ' ').trim() ?? null;
      const body: PropertyResponseSuccess = {
        status:
          owner && rentcast.appraisedValue != null && parcel && legal ? 'success' : 'partial',
        ownerName: owner ? owner.toUpperCase() : null,
        appraisedValue: rentcast.appraisedValue,
        parcelId: parcel,
        legalDescription: legal ? legal.toUpperCase() : null,
        lastUpdated: normalizeDate(rentcast.lastUpdated),
        source: 'rentcast_estimate',
      };
      console.log('[property] rentcast fallback', { address, durationMs: Date.now() - t0 });
      await cacheSet(cacheKey, body, SUCCESS_TTL_SEC);
      return NextResponse.json(body);
    }

    const reason = detected
      ? `No data from ${detected} CAD after ${SCRAPE_RETRIES} attempts, and RentCast lookup failed or is not configured`
      : 'All CAD scrapers returned no data, and RentCast lookup failed or is not configured';
    const body = errorResponse(reason);
    console.warn('[property] all scrapers empty', {
      address,
      detected,
      durationMs: Date.now() - t0,
    });
    await cacheSet(cacheKey, body, NEGATIVE_TTL_SEC);
    return NextResponse.json(body, { status: 502 });
  }

  const best = pickBest(candidates, detected);
  if (!best) {
    const body = errorResponse('No usable CAD result');
    await cacheSet(cacheKey, body, NEGATIVE_TTL_SEC);
    return NextResponse.json(body, { status: 502 });
  }

  const normalized = normalizeCadResult(best.result);
  const body = buildResponse(normalized);

  console.log('[property] success', {
    county: best.county,
    score: scoreResult(normalized),
    status: body.status,
    durationMs: Date.now() - t0,
    address,
  });

  await cacheSet(cacheKey, body, SUCCESS_TTL_SEC);

  return NextResponse.json(body);
}
