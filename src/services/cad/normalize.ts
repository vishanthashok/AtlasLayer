import type { CadScrapeResult } from '../cadScraper';

const MONTHS: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Best-effort YYYY-MM-DD parse. Accepts:
 *  - "2026-05-04"
 *  - "5/4/2026" or "05/04/2026"
 *  - "May 4, 2026"
 *  - bare year "2026" (returns "2026-01-01")
 * Returns null when no recognizable date is present so we never fabricate a value.
 */
export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const isoMatch = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const m = parseInt(slashMatch[1]!, 10);
    const d = parseInt(slashMatch[2]!, 10);
    let y = parseInt(slashMatch[3]!, 10);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }
  }

  const wordMatch = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (wordMatch) {
    const mm = MONTHS[wordMatch[1]!.toLowerCase()];
    const d = parseInt(wordMatch[2]!, 10);
    const y = parseInt(wordMatch[3]!, 10);
    if (mm && d >= 1 && d <= 31) {
      return `${y}-${mm}-${pad2(d)}`;
    }
  }

  const yearOnly = s.match(/^\s*(\d{4})\s*$/);
  if (yearOnly) {
    return `${yearOnly[1]}-01-01`;
  }

  return null;
}

/**
 * Trim, uppercase owner/legal, coerce currency to integer, normalize date.
 * lastUpdated stays null when the page didn't expose one (no fabricated dates).
 */
export function normalizeCadResult(raw: CadScrapeResult): CadScrapeResult {
  const trim = (v: string | null): string | null => {
    if (!v) return null;
    const t = v.replace(/\s+/g, ' ').trim();
    return t.length > 0 ? t : null;
  };

  const owner = trim(raw.ownerName);
  const legal = trim(raw.legalDescription);
  const parcel = trim(raw.parcelId);

  let value: number | null = raw.appraisedValue;
  if (value != null && !Number.isFinite(value)) value = null;
  if (typeof value === 'number') value = Math.round(value);

  return {
    ownerName: owner ? owner.toUpperCase() : null,
    appraisedValue: value,
    parcelId: parcel,
    legalDescription: legal ? legal.toUpperCase() : null,
    lastUpdated: normalizeDate(raw.lastUpdated),
    source: raw.source,
  };
}

/** Lowercase, trim, collapse whitespace. Used as a stable cache key component. */
export function normalizeAddress(addr: string): string {
  return addr.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** +2 owner, +2 value, +1 parcel, +1 legal — used to select the strongest fan-out result. */
export function scoreResult(r: CadScrapeResult | null): number {
  if (!r) return 0;
  let s = 0;
  if (r.ownerName) s += 2;
  if (r.appraisedValue != null) s += 2;
  if (r.parcelId) s += 1;
  if (r.legalDescription) s += 1;
  return s;
}

/** Run `fn` with up to `attempts` tries and a small backoff between failures. */
export async function withRetries<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 750
): Promise<T> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`withRetries: failed after ${attempts} attempts`);
}

export class CadTimeoutError extends Error {
  constructor(ms: number) {
    super(`CAD scrape timed out after ${ms}ms`);
    this.name = 'CadTimeoutError';
  }
}

/** Race `fn` against a timer. On timeout the promise rejects with CadTimeoutError. */
export async function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race<T>([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new CadTimeoutError(ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
