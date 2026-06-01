import type { Page } from 'puppeteer-core';
import { pickPuppeteerUserAgent } from '../../lib/property-intelligence/constants';

/** Configure viewport + headers consistent across CAD portals. */
export async function configureCadPage(page: Page): Promise<void> {
  const ua = pickPuppeteerUserAgent();
  await page.setUserAgent(ua);
  await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  });
}

/** Raw fields parsed off a CAD detail page. All nullable — no fallbacks. */
export interface ParsedCadFields {
  ownerName: string | null;
  appraisedValue: number | null;
  parcelId: string | null;
  legalDescription: string | null;
  lastUpdated: string | null;
}

export interface ParseDiagnostics {
  url: string;
  missing: string[];
  htmlSnippet: string;
}

export interface ParsedCadPage {
  fields: ParsedCadFields;
  diag: ParseDiagnostics;
}

/**
 * Wait for the detail page to actually render registry content (not just a blank shell).
 * Combines text-presence + body length to defeat partial loads.
 */
export async function waitForRegistryContent(page: Page, timeoutMs = 9000): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText || '';
        return /Owner|Appraised Value|Property ID|Account/i.test(t) && t.length > 2000;
      },
      { timeout: timeoutMs }
    )
    .catch(() => {});
  // Small settle so late-mounted async cells can populate
  await new Promise((r) => setTimeout(r, 500));
}

/**
 * Generic label-based parse for TrueAutomation / Prodigy / WCAD detail pages.
 * Runs in browser context. Returns null fields rather than placeholder strings.
 */
export async function parseCadDetailPage(page: Page): Promise<ParsedCadPage> {
  const url = page.url();
  const result = await page.evaluate(() => {
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const stripColon = (s: string) => s.replace(/:\s*$/, '').trim();
    const lc = (s: string) => stripColon(norm(s)).toLowerCase();

    const OWNER = ['owner name', 'owner', 'owner(s)', 'property owner'];
    const VALUE = [
      'appraised value',
      'total appraised value',
      'market value',
      'total market value',
      'total value',
    ];
    const LEGAL = ['legal description', 'legal desc', 'legal'];
    const PARCEL = [
      'property id',
      'account',
      'account #',
      'account number',
      'geographic id',
      'geo id',
      'quick ref id',
    ];
    const UPDATED = ['last updated', 'certified values', 'tax year'];

    const ALL = new Set<string>([...OWNER, ...VALUE, ...LEGAL, ...PARCEL, ...UPDATED]);

    let ownerName: string | null = null;
    let appraisedValue: number | null = null;
    let parcelId: string | null = null;
    let legalDescription: string | null = null;
    let lastUpdated: string | null = null;

    const toInt = (raw: string | null | undefined): number | null => {
      if (!raw) return null;
      const cleaned = String(raw).replace(/[^0-9.-]+/g, '');
      if (!cleaned) return null;
      const n = parseInt(cleaned, 10);
      return Number.isFinite(n) ? n : null;
    };

    const labelNodes = Array.from(document.querySelectorAll('th, td, dt'));
    for (const node of labelNodes) {
      const raw = norm(node.textContent || '');
      if (!raw) continue;

      // Support same-cell "Label: Value" pattern
      let labelText = raw;
      let inCellValue: string | null = null;
      const colonIdx = raw.indexOf(':');
      if (colonIdx > 0 && colonIdx < raw.length - 1) {
        labelText = raw.slice(0, colonIdx);
        inCellValue = raw.slice(colonIdx + 1).trim();
      }

      const L = lc(labelText);
      if (!ALL.has(L)) continue;

      let val: string | null = inCellValue;
      if (!val) {
        const sib = node.nextElementSibling;
        val = sib ? norm(sib.textContent || '') : null;
      }
      if (!val) continue;

      if (OWNER.includes(L) && !ownerName) {
        ownerName = val;
      } else if (VALUE.includes(L) && appraisedValue == null) {
        appraisedValue = toInt(val);
      } else if (LEGAL.includes(L) && !legalDescription) {
        legalDescription = val;
      } else if (PARCEL.includes(L) && !parcelId) {
        parcelId = val;
      } else if (UPDATED.includes(L) && !lastUpdated) {
        lastUpdated = val;
      }
    }

    const missing: string[] = [];
    if (!ownerName) missing.push('ownerName');
    if (appraisedValue == null) missing.push('appraisedValue');
    if (!parcelId) missing.push('parcelId');
    if (!legalDescription) missing.push('legalDescription');
    if (!lastUpdated) missing.push('lastUpdated');

    const htmlSnippet = (document.body?.innerText || '').slice(0, 400);

    return {
      fields: {
        ownerName,
        appraisedValue,
        parcelId,
        legalDescription,
        lastUpdated,
      },
      missing,
      htmlSnippet,
    };
  });

  if (result.missing.length > 0) {
    console.warn('[CAD parser] Missing fields', {
      url,
      missing: result.missing,
      htmlSnippet: result.htmlSnippet,
    });
  }

  return {
    fields: result.fields,
    diag: { url, missing: result.missing, htmlSnippet: result.htmlSnippet },
  };
}
