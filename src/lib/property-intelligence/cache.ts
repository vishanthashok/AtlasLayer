import { Redis } from '@upstash/redis';

const DEFAULT_TTL_SEC = 60 * 60 * 24; // 24h

type Entry = { value: unknown; expires: number };

const memoryStore = new Map<string, Entry>();

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redisClient) {
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

/** Generic Redis URL (ioredis-style) — not used by Upstash REST; reserved for future ioredis support. */
export function hasRedisUrl(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const v = await redis.get<T>(key);
      return v ?? null;
    } catch (e) {
      console.warn('[cache] Redis get failed, falling back to memory:', e);
    }
  }
  const ent = memoryStore.get(key);
  if (!ent || Date.now() > ent.expires) {
    if (ent) memoryStore.delete(key);
    return null;
  }
  return ent.value as T;
}

export async function cacheSet(key: string, value: unknown, ttlSec: number = DEFAULT_TTL_SEC): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSec });
      return;
    } catch (e) {
      console.warn('[cache] Redis set failed, using memory:', e);
    }
  }
  memoryStore.set(key, {
    value,
    expires: Date.now() + ttlSec * 1000,
  });
}

export function cacheKeyGeo(prefix: string, lat: number, lon: number, extra?: string): string {
  const g = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
  return extra ? `${prefix}:${g}:${extra}` : `${prefix}:${g}`;
}
