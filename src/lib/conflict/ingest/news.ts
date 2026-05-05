import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { getSupabaseAdmin } from '../supabase';
import { extractConflictIndicators } from '../nlp/conflictExtractor';
import { analyzeSentiment } from '../nlp/sentiment';

const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
const USER_AGENT = 'PropertyVisionConflictLens/1.0';

const RSS_FEEDS: Record<string, string> = {
  Reuters: 'https://feeds.feedburner.com/reuters/topNews',
  BBC: 'http://feeds.bbci.co.uk/news/world/rss.xml',
  AlJazeera: 'https://www.aljazeera.com/xml/rss/all.xml',
  AP: 'https://feeds.apnews.com/rss/apf-worldnews',
  France24: 'https://www.france24.com/en/rss',
};

interface RawArticle {
  source: string;
  title: string;
  url: string;
  content: string;
  publishedAt: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 15000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init?.headers },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml,application/xml,text/xml' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchNewsAPI(): Promise<RawArticle[]> {
  if (!NEWS_API_KEY) return [];
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
    'conflict OR war OR attack OR coup OR ceasefire'
  )}&language=en&sortBy=publishedAt&pageSize=100&from=${since}&apiKey=${NEWS_API_KEY}`;
  try {
    const data = (await fetchJson(url)) as {
      articles?: Array<{
        source?: { name?: string };
        title?: string;
        url?: string;
        content?: string;
        description?: string;
        publishedAt?: string;
      }>;
    };
    return (data.articles ?? [])
      .filter((a) => a.url && a.title)
      .map((a) => ({
        source: a.source?.name ?? 'NewsAPI',
        title: a.title!,
        url: a.url!,
        content: a.content || a.description || '',
        publishedAt: a.publishedAt || new Date().toISOString(),
      }));
  } catch (e) {
    console.warn('[news] NewsAPI fetch failed', String(e));
    return [];
  }
}

async function fetchGdelt(): Promise<RawArticle[]> {
  const url =
    'https://api.gdeltproject.org/api/v2/doc/doc?query=conflict&mode=ArtList&maxrecords=250&timespan=6h&format=JSON';
  try {
    const data = (await fetchJson(url, undefined, 20000)) as {
      articles?: Array<{
        url?: string;
        title?: string;
        seendate?: string;
        sourcecountry?: string;
        domain?: string;
      }>;
    };
    return (data.articles ?? [])
      .filter((a) => a.url && a.title)
      .map((a) => ({
        source: a.domain ?? 'GDELT',
        title: a.title!,
        url: a.url!,
        content: '',
        publishedAt: a.seendate || new Date().toISOString(),
      }));
  } catch (e) {
    console.warn('[news] GDELT fetch failed', String(e));
    return [];
  }
}

interface RssItem {
  title?: string | { '#text'?: string };
  link?: string | { '#text'?: string; '@_href'?: string };
  description?: string;
  summary?: string;
  pubDate?: string;
  published?: string;
  updated?: string;
}

function pickText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const v = value as Record<string, unknown>;
    if (typeof v['#text'] === 'string') return v['#text'] as string;
    if (typeof v['@_href'] === 'string') return v['@_href'] as string;
  }
  return '';
}

async function fetchRss(): Promise<RawArticle[]> {
  const out: RawArticle[] = [];
  for (const [source, url] of Object.entries(RSS_FEEDS)) {
    try {
      const xml = await fetchText(url);
      const parsed = xmlParser.parse(xml) as Record<string, unknown>;

      let items: RssItem[] = [];
      const channel = (parsed.rss as { channel?: { item?: RssItem | RssItem[] } } | undefined)?.channel;
      if (channel?.item) {
        items = Array.isArray(channel.item) ? channel.item : [channel.item];
      } else if ((parsed.feed as { entry?: RssItem | RssItem[] } | undefined)?.entry) {
        const entry = (parsed.feed as { entry?: RssItem | RssItem[] }).entry;
        items = Array.isArray(entry) ? entry! : [entry!];
      }

      for (const item of items.slice(0, 30)) {
        const title = pickText(item.title);
        const link = pickText(item.link);
        if (!title || !link) continue;
        out.push({
          source,
          title,
          url: link,
          content: pickText(item.description) || pickText(item.summary) || '',
          publishedAt:
            item.pubDate || item.published || item.updated || new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn(`[news] RSS fetch failed for ${source}`, String(e));
    }
  }
  return out;
}

function parseDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex');
}

export interface NewsIngestResult {
  fetched: number;
  inserted: number;
  skipped_duplicates: number;
}

export async function ingestAllNews(): Promise<NewsIngestResult> {
  const [api, gdelt, rss] = await Promise.all([fetchNewsAPI(), fetchGdelt(), fetchRss()]);
  const all = [...api, ...gdelt, ...rss];

  const seen = new Set<string>();
  const supabase = getSupabaseAdmin();

  const rows: Array<{
    country_iso: string | null;
    source_name: string;
    title: string;
    url: string;
    content_hash: string;
    published_at: string;
    sentiment_score: number;
    conflict_score: number;
    keywords: string[];
    raw_text: string;
  }> = [];

  let skipped = 0;
  for (const art of all) {
    if (!art.url || !art.title) continue;
    const hash = hashUrl(art.url);
    if (seen.has(hash)) {
      skipped++;
      continue;
    }
    seen.add(hash);

    const fullText = `${art.title} ${art.content}`.slice(0, 8000);
    const sentiment = analyzeSentiment(fullText);
    const indicators = extractConflictIndicators(fullText);

    rows.push({
      country_iso: indicators.country_iso,
      source_name: art.source,
      title: art.title.slice(0, 1000),
      url: art.url,
      content_hash: hash,
      published_at: parseDate(art.publishedAt),
      sentiment_score: sentiment,
      conflict_score: indicators.score,
      keywords: indicators.keywords,
      raw_text: fullText.slice(0, 5000),
    });
  }

  let inserted = 0;
  if (rows.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error, count } = await supabase
        .from('news_articles')
        .upsert(chunk, { onConflict: 'url', ignoreDuplicates: true, count: 'exact' });
      if (error) {
        console.error('[news] insert chunk failed', error);
      } else if (count != null) {
        inserted += count;
      } else {
        inserted += chunk.length;
      }
    }
  }

  return { fetched: all.length, inserted, skipped_duplicates: skipped };
}
