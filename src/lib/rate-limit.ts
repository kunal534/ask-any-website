import { redis } from "./redis";

/**
 * Fixed-window rate limiter backed by Upstash Redis.
 * Returns { allowed, remaining } — safe to fail-open if Redis is down
 * so local dev without env doesn't hard-block.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    return { allowed: true, remaining: limit };
  }
}
