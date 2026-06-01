import type { Browser } from 'puppeteer-core';

/**
 * Launch headless Chrome for CAD scraping.
 * On Vercel: @sparticuz/chromium (serverless bundle).
 * Locally: full puppeteer with bundled Chromium (devDependency).
 */
export async function launchCadBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = await import('@sparticuz/chromium');
    const puppeteer = await import('puppeteer-core');
    return puppeteer.default.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  }

  const puppeteer = await import('puppeteer');
  return puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
}
