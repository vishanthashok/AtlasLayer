import { getSupabaseAdmin } from '../supabase';
import { extractConflictIndicators } from '../nlp/conflictExtractor';
import { analyzeSentiment } from '../nlp/sentiment';

const USER_AGENT = 'PropertyVisionConflictLens/1.0';

const SUBREDDITS = ['worldnews', 'geopolitics', 'news', 'UkraineWarVideoReport'];
const MIN_CONFLICT_SCORE_TO_PERSIST = 0.3;

interface RedditPost {
  data?: {
    title?: string;
    selftext?: string;
    score?: number;
    num_comments?: number;
    permalink?: string;
  };
}

async function fetchRedditSub(sub: string): Promise<Array<{ text: string; engagement: number }>> {
  const url = `https://www.reddit.com/r/${sub}/new.json?limit=25`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return [];
    const data = (await resp.json()) as { data?: { children?: RedditPost[] } };
    const posts = data.data?.children ?? [];
    return posts
      .map((p) => p.data)
      .filter((p): p is NonNullable<RedditPost['data']> => Boolean(p && p.title))
      .map((p) => ({
        text: `${p.title ?? ''} ${p.selftext ?? ''}`.slice(0, 4000),
        engagement: (p.score ?? 0) + (p.num_comments ?? 0),
      }));
  } catch (e) {
    console.warn(`[social] Reddit /r/${sub} fetch failed`, String(e));
    return [];
  }
}

export interface SocialIngestResult {
  fetched: number;
  inserted: number;
  filtered_low_signal: number;
}

/** Reddit-only Tier-1 social ingestion. */
export async function fetchRedditSignals(): Promise<SocialIngestResult> {
  const supabase = getSupabaseAdmin();
  let fetched = 0;
  let inserted = 0;
  let filtered = 0;

  const rows: Array<{
    platform: string;
    country_iso: string | null;
    content: string;
    sentiment: number;
    conflict_indicators: string[];
    engagement: number;
  }> = [];

  for (const sub of SUBREDDITS) {
    const posts = await fetchRedditSub(sub);
    fetched += posts.length;
    for (const post of posts) {
      const indicators = extractConflictIndicators(post.text);
      if (indicators.score < MIN_CONFLICT_SCORE_TO_PERSIST) {
        filtered++;
        continue;
      }
      const sentiment = analyzeSentiment(post.text);
      rows.push({
        platform: 'reddit',
        country_iso: indicators.country_iso,
        content: post.text.slice(0, 1000),
        sentiment,
        conflict_indicators: indicators.keywords,
        engagement: post.engagement,
      });
    }
  }

  if (rows.length > 0) {
    const { error, count } = await supabase
      .from('social_signals')
      .insert(rows, { count: 'exact' });
    if (error) {
      console.error('[social] insert failed', error);
    } else {
      inserted = count ?? rows.length;
    }
  }

  return { fetched, inserted, filtered_low_signal: filtered };
}

/**
 * Twitter stream stub. Real-time filtered streaming requires a server with
 * persistent connections (not available on Vercel functions). This function
 * intentionally no-ops unless TWITTER_BEARER_TOKEN is set; we leave it for a
 * future worker-mode deployment.
 */
export async function streamTwitterSignals(): Promise<SocialIngestResult> {
  if (!process.env.TWITTER_BEARER_TOKEN) {
    return { fetched: 0, inserted: 0, filtered_low_signal: 0 };
  }
  console.warn('[social] Twitter streaming not implemented in serverless mode');
  return { fetched: 0, inserted: 0, filtered_low_signal: 0 };
}
