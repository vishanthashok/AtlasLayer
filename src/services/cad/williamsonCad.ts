import { launchCadBrowser } from './launchBrowser';
import type { CadScrapeResult } from '../cadScraper';
import { configureCadPage, parseCadDetailPage, waitForRegistryContent } from './puppeteerShared';

/**
 * Williamson County Appraisal District (WCAD) — search.wcad.org
 */
export async function scrapeWilliamsonCAD(address: string): Promise<CadScrapeResult | null> {
  let browser;
  try {
    console.log(`[WCAD] Search: ${address.slice(0, 80)}...`);
    browser = await launchCadBrowser();
    const page = await browser.newPage();
    await configureCadPage(page);

    const listUrl = `https://search.wcad.org/Search?SearchText=${encodeURIComponent(address)}`;
    await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const u = page.url();
    const onDetail =
      u.includes('/Property/') || u.includes('PropertyView') || u.includes('property-detail');

    if (!onDetail) {
      const firstLink =
        (await page.$('a[href*="/Property/"]')) ||
        (await page.$('a[href*="PropertyView"]')) ||
        (await page.$('table tbody tr a[href^="http"]')) ||
        (await page.$('a.property-link')) ||
        (await page.$('main a[href*="/"]'));

      if (!firstLink) {
        console.warn('[WCAD] No result link found for address:', address);
        return null;
      }

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}),
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

    return { ...fields, source: 'williamson_cad' };
  } catch (e) {
    console.error('[WCAD] Failed:', e);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}
