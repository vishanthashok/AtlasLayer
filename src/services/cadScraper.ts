import puppeteer, { type Page } from 'puppeteer';
import {
  parseCadDetailPage,
  waitForRegistryContent,
} from './cad/puppeteerShared';

export type CadSource = 'bexar_cad' | 'travis_cad' | 'williamson_cad';

export interface CadScrapeResult {
  ownerName: string | null;
  appraisedValue: number | null;
  parcelId: string | null;
  legalDescription: string | null;
  /** YYYY-MM-DD when present on page, otherwise null. Never defaulted to today. */
  lastUpdated: string | null;
  source: CadSource;
}

const BEXAR_SEARCH_URL = 'https://bexar.trueautomation.com/clientdb/PropertySearch.aspx?cid=110';
const BEXAR_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0';
const BEXAR_SEARCH_INPUT_SELECTORS = [
  '#propertySearchOptions_searchText',
  'input[name="propertySearchOptions:searchText"]',
  '#propertySearchOptions_searchBox',
];
const BEXAR_SEARCH_BUTTON_SELECTORS = [
  '#propertySearchOptions_search',
  'input[name="propertySearchOptions:search"]',
  '#propertySearchOptions_searchButton',
];
const BEXAR_DETAIL_LINK_SELECTOR = 'a[href*="Property.aspx"][href*="prop_id="]';

function isBexarDetailUrl(url: string): boolean {
  return /\/Property\.aspx/i.test(url) && /[?&]prop_id=/i.test(url);
}

function compactAddressForBexar(address: string): string {
  const streetPart = address
    .split(',')[0]!
    .replace(
      /\b(San Antonio|Helotes|Converse|Universal City|Leon Valley|Alamo Heights|Balcones Heights|Castle Hills|Kirby|Live Oak|Shavano Park|Terrell Hills|Windcrest)\b.*$/i,
      ''
    )
    .trim();

  const words = streetPart
    .replace(/[#].*$/, '')
    .replace(/\b(?:apt|apartment|unit|suite|ste)\b.*$/i, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= 1) return address.trim();

  const suffixes = new Set([
    'aly', 'alley', 'ave', 'avenue', 'blvd', 'boulevard', 'cir', 'circle', 'ct', 'court',
    'cv', 'cove', 'dr', 'drive', 'hwy', 'highway', 'ln', 'lane', 'loop', 'pkwy',
    'parkway', 'pl', 'place', 'rd', 'road', 'st', 'street', 'ter', 'terrace', 'trl',
    'trail', 'way',
  ]);
  const directions = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);

  const [streetNumber, ...rest] = words;
  const streetName = rest
    .filter((word) => {
      const normalized = word.toLowerCase().replace(/\./g, '');
      return !directions.has(normalized) && !suffixes.has(normalized);
    })
    .join(' ');

  return streetName ? `${streetNumber} ${streetName}` : streetPart || address.trim();
}

function bexarSearchTerms(address: string): string[] {
  const compact = compactAddressForBexar(address);
  return Array.from(new Set([compact, address.trim()].filter(Boolean)));
}

async function waitForFirstSelector(
  page: Page,
  selectors: string[],
  timeoutMs: number
): Promise<string> {
  try {
    return await Promise.any(
      selectors.map((selector) =>
        page.waitForSelector(selector, { timeout: timeoutMs }).then(() => selector)
      )
    );
  } catch {
    throw new Error(`None of the expected Bexar CAD selectors were found: ${selectors.join(', ')}`);
  }
}

async function submitBexarSearch(page: Page, searchTerm: string): Promise<void> {
  let inputSelector: string | null = null;
  let buttonSelector: string | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(BEXAR_SEARCH_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    try {
      inputSelector = await waitForFirstSelector(page, BEXAR_SEARCH_INPUT_SELECTORS, 10000);
      buttonSelector = await waitForFirstSelector(page, BEXAR_SEARCH_BUTTON_SELECTORS, 10000);
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
      }
    }
  }

  if (!inputSelector || !buttonSelector) {
    const snippet = await page
      .evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 240))
      .catch(() => '');
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`${message}. Current URL: ${page.url()}. Page text: ${snippet}`);
  }

  await page.click(inputSelector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(inputSelector, searchTerm);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}),
    page.click(buttonSelector),
  ]);
}

export async function scrapeBexarCAD(address: string): Promise<CadScrapeResult | null> {
  let browser;
  try {
    console.log(`[Bexar CAD] Search: ${address.slice(0, 80)}...`);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(BEXAR_USER_AGENT);
    await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });

    let foundDetail = false;
    for (const searchTerm of bexarSearchTerms(address)) {
      await submitBexarSearch(page, searchTerm);

      if (isBexarDetailUrl(page.url())) {
        foundDetail = true;
        break;
      }

      const firstLink = await page.$(BEXAR_DETAIL_LINK_SELECTOR);
      if (firstLink) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}),
          firstLink.click(),
        ]);
        foundDetail = isBexarDetailUrl(page.url());
        if (foundDetail) break;
      }
    }

    if (!foundDetail) {
      console.warn('[Bexar CAD] No property link found for address:', address);
      return null;
    }

    await waitForRegistryContent(page);

    const { fields } = await parseCadDetailPage(page);

    if (
      !fields.ownerName &&
      fields.appraisedValue == null &&
      !fields.parcelId &&
      !fields.legalDescription
    ) {
      return null;
    }

    return {
      ...fields,
      source: 'bexar_cad',
    };
  } catch (error) {
    console.error('[Bexar CAD] Failed:', error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
