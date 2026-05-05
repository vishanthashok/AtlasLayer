import * as cheerio from 'cheerio';
import { cacheSet } from '../../property-intelligence/cache';
import { CONFLICT_UPDATES_KEY } from '../constants';
import { normalizeIso2 } from '../iso';
import { getSupabaseAdmin } from '../supabase';
import { nameToIso } from '../nlp/conflictExtractor';

const BASE_URL = 'https://travel.state.gov';

/** Primary landing page + legacy deep link (tried in order until rows parse). */
const ADVISORY_LIST_URLS = [
  `${BASE_URL}/content/travel/en/international-travel/travel-advisories.html`,
  `${BASE_URL}/content/travel/en/traveladvisories/traveladvisories.html/`,
];

const LEVEL_PATTERNS: Array<[number, RegExp]> = [
  [4, /Do Not Travel|Level\s*4/i],
  [3, /Reconsider Travel|Level\s*3/i],
  [2, /Exercise Increased Caution|Level\s*2/i],
  [1, /Exercise Normal Precautions|Level\s*1/i],
];

const USER_AGENT =
  'PropertyVisionConflictLens/1.0 (+https://example.com; data ingestion bot)';

interface RawAdvisory {
  countryName: string;
  level: number;
  url: string | null;
  levelText: string;
}

async function fetchHtml(url: string, timeoutMs = 30000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!resp.ok) {
      throw new Error(`State Dept HTTP ${resp.status} for ${url}`);
    }
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

function detectLevel(text: string): number | null {
  for (const [lvl, re] of LEVEL_PATTERNS) {
    if (re.test(text)) return lvl;
  }
  return null;
}

function parseAdvisoryHtml(html: string): RawAdvisory[] {
  const $ = cheerio.load(html);
  const advisories: RawAdvisory[] = [];

  const tables = $('table.table-data, table');
  tables.each((_, table) => {
    $(table)
      .find('tr')
      .each((idx, row) => {
        if (idx === 0) return;
        const cols = $(row).find('td');
        if (cols.length < 2) return;
        const countryName = $(cols[0]).text().trim();
        const levelText = $(cols[1]).text().trim();
        if (!countryName) return;

        const link = $(cols[0]).find('a').attr('href');
        const url = link
          ? link.startsWith('http')
            ? link
            : `${BASE_URL}${link.startsWith('/') ? '' : '/'}${link}`
          : null;

        const level = detectLevel(levelText) ?? detectLevel(countryName);
        if (level == null) return;

        advisories.push({ countryName, level, url, levelText });
      });
  });

  if (advisories.length === 0) {
    $('li').each((_, el) => {
      const text = $(el).text().trim();
      const level = detectLevel(text);
      if (!level) return;
      const link = $(el).find('a').attr('href');
      const countryName = $(el).find('a').first().text().trim() || text.slice(0, 40);
      advisories.push({
        countryName,
        level,
        url: link
          ? link.startsWith('http')
            ? link
            : `${BASE_URL}${link.startsWith('/') ? '' : '/'}${link}`
          : null,
        levelText: text,
      });
    });
  }

  return advisories;
}

async function fetchAdvisoryList(): Promise<RawAdvisory[]> {
  for (const listUrl of ADVISORY_LIST_URLS) {
    try {
      const html = await fetchHtml(listUrl);
      const parsed = parseAdvisoryHtml(html);
      if (parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.warn('[stateDept] advisory list URL failed', listUrl, String(e));
    }
  }
  return [];
}

async function fetchCountryDetail(url: string | null): Promise<string> {
  if (!url) return '';
  try {
    const html = await fetchHtml(url, 15000);
    const $ = cheerio.load(html);
    const candidates = $('div.tsg-rte-band, div.advisory-text, div.content, article');
    if (candidates.length > 0) {
      return $(candidates[0]).text().replace(/\s+\n/g, '\n').trim();
    }
    return $('body').text().slice(0, 5000).trim();
  } catch (e) {
    console.warn('[stateDept] detail fetch failed', { url, err: String(e) });
    return '';
  }
}

/** Concurrency-limited Promise.all. */
async function pMap<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await worker(items[i]!);
    }
  });
  await Promise.all(runners);
  return out;
}

export interface StateDeptIngestResult {
  fetched: number;
  inserted: number;
  unmatchedCountries: string[];
}

/** Main entry — fetch list, enrich details, persist. */
export async function fetchAllAdvisories(): Promise<StateDeptIngestResult> {
  const advisories = await fetchAdvisoryList();
  if (advisories.length === 0) {
    console.warn('[stateDept] zero advisories parsed (HTML structure may have changed)');
    return { fetched: 0, inserted: 0, unmatchedCountries: [] };
  }

  const enriched = await pMap(
    advisories,
    async (adv) => {
      const fullText = await fetchCountryDetail(adv.url);
      await new Promise((r) => setTimeout(r, 500));
      return { ...adv, fullText };
    },
    5
  );

  const supabase = getSupabaseAdmin();
  const unmatched: string[] = [];
  const rows: Array<{
    country_iso: string;
    level: number;
    headline: string | null;
    full_text: string | null;
    url: string | null;
    fetched_at: string;
  }> = [];

  for (const adv of enriched) {
    const iso = nameToIso(adv.countryName);
    if (!iso) {
      unmatched.push(adv.countryName);
      continue;
    }
    rows.push({
      country_iso: normalizeIso2(iso),
      level: adv.level,
      headline: adv.levelText.slice(0, 500) || null,
      full_text: adv.fullText.slice(0, 20000) || null,
      url: adv.url,
      fetched_at: new Date().toISOString(),
    });
  }

  let inserted = 0;
  if (rows.length > 0) {
    const { error, count } = await supabase
      .from('travel_advisories')
      .insert(rows, { count: 'exact' });
    if (error) {
      console.error('[stateDept] insert failed', error);
    } else {
      inserted = count ?? rows.length;
    }
  }

  if (inserted > 0) {
    await cacheSet(
      CONFLICT_UPDATES_KEY,
      {
        event: 'advisories_refreshed',
        timestamp: new Date().toISOString(),
      },
      60 * 60
    );
  }

  if (unmatched.length > 0) {
    console.warn('[stateDept] unmatched country names', unmatched.slice(0, 20));
  }

  return { fetched: enriched.length, inserted, unmatchedCountries: unmatched };
}
