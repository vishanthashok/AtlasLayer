import { cacheGet, cacheSet } from './property-intelligence/cache';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSec: number;
}

/**
 * Sliding-window rate limiter backed by Upstash Redis (or in-memory fallback).
 * Uses an increment counter key with a TTL.
 */
export async function rateLimit(
  identifier: string,
  options: { limit: number; windowSec: number }
): Promise<RateLimitResult> {
  const { limit, windowSec } = options;
  const key = `rl:${identifier}`;

  try {
    const current = (await cacheGet<number>(key)) ?? 0;

    if (current >= limit) {
      return { allowed: false, remaining: 0, resetInSec: windowSec };
    }

    await cacheSet(key, current + 1, windowSec);
    return { allowed: true, remaining: limit - current - 1, resetInSec: windowSec };
  } catch {
    // Cache unavailable — fail open (don't block legitimate traffic)
    return { allowed: true, remaining: limit, resetInSec: windowSec };
  }
}

/**
 * Extract a stable client identifier from a request.
 * Uses CF-Connecting-IP → X-Forwarded-For → X-Real-IP → 'unknown'.
 */
export function getClientId(req: Request): string {
  const headers = req.headers;
  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  );
}
