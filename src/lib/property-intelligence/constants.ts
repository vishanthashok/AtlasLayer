/** Realistic desktop Chrome UAs for public API and browser automation. */
export const PUPPETEER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
] as const;

export const NOMINATIM_USER_AGENT = 'PropertyVision-Parcelis/1.0 (property intelligence)';

export const OVERPASS_USER_AGENT = 'PropertyVision-Parcelis/1.0 (property intelligence)';

export function pickPuppeteerUserAgent(): string {
  return PUPPETEER_USER_AGENTS[Math.floor(Math.random() * PUPPETEER_USER_AGENTS.length)]!;
}
