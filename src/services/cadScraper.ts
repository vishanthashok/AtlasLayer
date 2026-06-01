import { launchCadBrowser } from './cad/launchBrowser';
import { pickPuppeteerUserAgent } from '../lib/property-intelligence/constants';
import {
  configureCadPage,
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

export async function scrapeBexarCAD(address: string): Promise<CadScrapeResult | null> {
  let browser;
  try {
    console.log(`[Bexar CAD] Search: ${address.slice(0, 80)}...`);
    browser = await launchCadBrowser();

    const page = await browser.newPage();
    const ua = pickPuppeteerUserAgent();
    await page.setUserAgent(ua);
    await configureCadPage(page);

    await page.goto('https://bexar.trueautomation.com/clientdb/PropertySearch.aspx?cid=110', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await page.waitForSelector('#propertySearchOptions_searchBox', { timeout: 10000 });
    await page.type('#propertySearchOptions_searchBox', address);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
      page.click('#propertySearchOptions_searchButton'),
    ]);

    const currentUrl = page.url();
    if (!currentUrl.includes('Property.aspx?prop_id=')) {
      const firstLink = await page.$('a[href*="Property.aspx?prop_id="]');
      if (!firstLink) {
        console.warn('[Bexar CAD] No property link found for address:', address);
        return null;
      }
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
        firstLink.click(),
      ]);
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
