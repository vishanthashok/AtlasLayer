import puppeteer from 'puppeteer';
import type { CadScrapeResult } from '../cadScraper';
import { configureCadPage, parseCadDetailPage, waitForRegistryContent } from './puppeteerShared';

/**
 * Travis Central Appraisal District (Prodigy) — travis.prodigycad.com
 */
export async function scrapeTravisCAD(address: string): Promise<CadScrapeResult | null> {
  let browser;
  try {
    console.log(`[Travis CAD] Search: ${address.slice(0, 80)}...`);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await configureCadPage(page);

    const listUrl = `https://travis.prodigycad.com/property-search?search_text=${encodeURIComponent(address)}`;
    await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const u = page.url();
    const onDetail =
      u.includes('/property/') || u.includes('Property.aspx') || u.includes('property-detail');

    if (!onDetail) {
      const firstLink =
        (await page.$('a[href*="/property/"]')) ||
        (await page.$('a[href*="Property"]')) ||
        (await page.$('table tbody tr a')) ||
        (await page.$('[data-testid="property-link"]')) ||
        (await page.$('main a[href*="property"]'));

      if (!firstLink) {
        console.warn('[Travis CAD] No result link found for address:', address);
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

    return { ...fields, source: 'travis_cad' };
  } catch (e) {
    console.error('[Travis CAD] Failed:', e);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}
