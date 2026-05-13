import type { Page } from 'puppeteer';
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
  const result = (await page.evaluate(`
    (() => {
      const norm = (s) => s.replace(/\\s+/g, ' ').trim();
      const stripColon = (s) => s.replace(/:\\s*$/, '').trim();
      const lc = (s) =>
        stripColon(norm(s))
          .replace(/^[^a-z0-9]+/i, '')
          .toLowerCase();

      const OWNER = ['owner name', 'owner', 'owner(s)', 'property owner', 'name'];
      const APPRAISED_VALUE = [
        'appraised value',
        'total appraised value',
      ];
      const FALLBACK_VALUE = [
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
      const UPDATED = ['last updated', 'database last updated on', 'certified values', 'tax year'];

      const ALL = new Set([
        ...OWNER,
        ...APPRAISED_VALUE,
        ...FALLBACK_VALUE,
        ...LEGAL,
        ...PARCEL,
        ...UPDATED,
      ]);

      let ownerName = null;
      let appraisedValue = null;
      let hasPreferredAppraisedValue = false;
      let parcelId = null;
      let legalDescription = null;
      let lastUpdated = null;

      const toInt = (raw) => {
        if (!raw) return null;
        const cleaned = String(raw).replace(/[^0-9.-]+/g, '');
        if (!cleaned) return null;
        const n = parseInt(cleaned, 10);
        return Number.isFinite(n) ? n : null;
      };
      const looksLikeDate = (raw) =>
        /\\d{4}-\\d{2}-\\d{2}/.test(raw) ||
        /\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}/.test(raw) ||
        /[A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4}/.test(raw) ||
        /^\\s*\\d{4}\\s*$/.test(raw);

      const labelNodes = Array.from(document.querySelectorAll('th, td, dt'));
      for (const node of labelNodes) {
        const raw = norm(node.textContent || '');
        if (!raw) continue;

        let labelText = raw;
        let inCellValue = null;
        const colonIdx = raw.indexOf(':');
        if (colonIdx > 0 && colonIdx < raw.length - 1) {
          labelText = raw.slice(0, colonIdx);
          inCellValue = raw.slice(colonIdx + 1).trim();
        }

        const L = lc(labelText);
        if (!ALL.has(L)) continue;

        let val = inCellValue;
        if (!val) {
          const sib = node.nextElementSibling;
          val = sib ? norm(sib.textContent || '') : null;
        }
        if (!val) continue;

        if (OWNER.includes(L) && !ownerName) {
          ownerName = val;
        } else if (APPRAISED_VALUE.includes(L)) {
          const n = toInt(val);
          if (n != null) {
            appraisedValue = n;
            hasPreferredAppraisedValue = true;
          }
        } else if (FALLBACK_VALUE.includes(L) && appraisedValue == null && !hasPreferredAppraisedValue) {
          appraisedValue = toInt(val);
        } else if (LEGAL.includes(L) && !legalDescription) {
          legalDescription = val;
        } else if (PARCEL.includes(L) && !parcelId) {
          parcelId = val;
        } else if (UPDATED.includes(L) && !lastUpdated && looksLikeDate(val)) {
          lastUpdated = val;
        }
      }

      const missing = [];
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
    })()
  `)) as { fields: ParsedCadFields; missing: string[]; htmlSnippet: string };

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
