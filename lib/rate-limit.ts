/**
 * Simple in-memory rate limiter. Per-instance (not distributed), but effective
 * against single-IP abuse in Vercel's single-region invocations and appropriate
 * for a beta product. Upgrade to Upstash Redis if multi-instance rate limiting
 * becomes necessary.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Clean up expired entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (bucket.resetAt < now) store.delete(key);
  }
}, 60_000);

/**
 * Returns true if the request should be blocked.
 * @param key      Unique identifier (IP + endpoint)
 * @param limit    Max requests per window
 * @param windowMs Time window in milliseconds
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count++;
  if (bucket.count > limit) return true;
  return false;
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
