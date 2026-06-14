/**
 * Distributed rate limiter using Upstash Redis when UPSTASH_REDIS_REST_URL
 * is configured, with an in-memory fallback for local development.
 *
 * Redis uses a fixed-window counter with atomic INCR + EXPIRE, which works
 * correctly across all Vercel function instances. In-memory is per-instance
 * and only suitable for local dev / single-instance deployments.
 */

import { Redis } from "@upstash/redis";

// ── Redis client (lazy, only if env vars are present) ─────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    redis = new Redis({ url, token });
  }
  return redis;
}

// ── In-memory fallback ────────────────────────────────────────────────────────

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (bucket.resetAt < now) store.delete(key);
  }
}, 60_000);

function isRateLimitedMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count++;
  return bucket.count > limit;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if the request should be blocked.
 * Async when Redis is available; synchronous in-memory otherwise.
 */
export async function isRateLimited(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const r = getRedis();
  if (!r) return isRateLimitedMemory(key, limit, windowMs);

  try {
    const windowSecs = Math.ceil(windowMs / 1000);
    const redisKey = `rl:${key}`;
    const count = await r.incr(redisKey);
    if (count === 1) {
      // First request in this window — set TTL
      await r.expire(redisKey, windowSecs);
    }
    return count > limit;
  } catch {
    // Redis unavailable — fall back to in-memory so the app keeps running
    return isRateLimitedMemory(key, limit, windowMs);
  }
}

/** Extract the best available client IP from a Request. */
export function getClientIp(req: Request): string {
  const headers = new Headers((req as any).headers);
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}
