import { getRedis } from '../config/redis';
import { env } from '../config/env';

/**
 * Atomic Redis Lua script for rate limiting.
 * Increments the counter for a given key (hourly window).
 * Returns 0 if limit exceeded (rolled back), or the new count if allowed.
 */
const RATE_LIMIT_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], 3600)
end
if count > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return 0
end
return count
`;

interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfterMs: number;
}

/**
 * Check and enforce per-sender hourly rate limit using Redis atomic counters.
 * Key format: rate:{senderId}:{YYYY-MM-DD-HH}
 *
 * Safe across multiple workers because INCR + EXPIRE + check is done atomically via Lua.
 */
export async function checkRateLimit(
  senderId: string,
  limitPerHour?: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  const now = new Date();
  const hourWindow = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}`;
  const key = `rate:${senderId}:${hourWindow}`;
  const limit = limitPerHour ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER;

  const result = await redis.eval(RATE_LIMIT_LUA, 1, key, String(limit)) as number;

  if (result === 0) {
    // Calculate ms until next hour window
    const msUntilNextHour = (60 - now.getUTCMinutes()) * 60 * 1000
      - now.getUTCSeconds() * 1000
      - now.getUTCMilliseconds()
      + 1000; // small buffer

    return { allowed: false, count: limit, retryAfterMs: msUntilNextHour };
  }

  return { allowed: true, count: result, retryAfterMs: 0 };
}

/**
 * Get current usage for a sender in the current hour window.
 */
export async function getCurrentUsage(senderId: string): Promise<number> {
  const redis = getRedis();
  const now = new Date();
  const hourWindow = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}`;
  const key = `rate:${senderId}:${hourWindow}`;
  const val = await redis.get(key);
  return val ? parseInt(val, 10) : 0;
}
