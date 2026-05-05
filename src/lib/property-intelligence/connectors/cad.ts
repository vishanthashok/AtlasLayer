import { scrapeBexarCAD } from '../../../services/cadScraper';
import { scrapeWilliamsonCAD } from '../../../services/cad/williamsonCad';
import { scrapeTravisCAD } from '../../../services/cad/travisCad';
import type { CadScrapeResult } from '../../../services/cadScraper';
import type { ConnectorResult } from './types';
import { fail, ok } from './types';

/**
 * County-based CAD dispatch. Only runs scrapers for counties we support; others return null (RentCast + deep links).
 */
export async function connectCAD(
  address: string | undefined,
  countyName: string | null | undefined
): Promise<ConnectorResult<CadScrapeResult | null>> {
  if (!address || address.length <= 5) {
    return ok('cad', null);
  }
  const key = countyName?.replace(/\s+County$/i, '').trim().toLowerCase();
  if (!key) {
    return ok('cad', null);
  }

  try {
    let data: CadScrapeResult | null = null;
    if (key === 'bexar') {
      data = await scrapeBexarCAD(address);
    } else if (key === 'williamson') {
      data = await scrapeWilliamsonCAD(address);
    } else if (key === 'travis') {
      data = await scrapeTravisCAD(address);
    } else {
      return ok('cad', null);
    }
    return ok('cad', data);
  } catch (e) {
    console.error('connectCAD', e);
    return fail('cad', e);
  }
}
