import { LRUCache } from "lru-cache";

const rateLimitCache = new LRUCache<string, number[]>({
  max: 500,
  ttl: 60 * 1000, // 1 minute window
});

export function checkRateLimit(ip: string, maxRequests = 20): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = rateLimitCache.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  recent.push(now);
  rateLimitCache.set(ip, recent);
  return { allowed: true, remaining: maxRequests - recent.length };
}
