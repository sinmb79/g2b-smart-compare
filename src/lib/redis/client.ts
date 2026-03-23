/**
 * Redis client singleton using the 'redis' npm package
 * Handles connection reuse across Next.js hot reloads
 */

import { createClient, RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const TTL = {
  SEARCH: Number(process.env.REDIS_TTL_SEARCH ?? 300),     // 5 minutes
  PRODUCT: Number(process.env.REDIS_TTL_PRODUCT ?? 600),   // 10 minutes
  VENDOR: Number(process.env.REDIS_TTL_VENDOR ?? 600),     // 10 minutes
  AUTOCOMPLETE: 120,                                         // 2 minutes
  ETL_STATUS: 60,                                           // 1 minute
} as const;

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: RedisClientType | undefined;
}

let redisClient: RedisClientType;

async function getRedisClient(): Promise<RedisClientType> {
  if (global.__redisClient?.isReady) {
    return global.__redisClient;
  }

  const client = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 5) {
          console.error("[Redis] Max reconnection attempts reached");
          return new Error("Redis connection failed");
        }
        return Math.min(retries * 100, 3000);
      },
    },
  }) as RedisClientType;

  client.on("error", (err) => {
    console.error("[Redis] Client error:", err);
  });

  client.on("connect", () => {
    console.debug("[Redis] Connected");
  });

  await client.connect();
  global.__redisClient = client;
  redisClient = client;
  return client;
}

/**
 * Cache wrapper — get from Redis, or compute and store result
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const client = await getRedisClient();
    const cached = await client.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    const result = await fetcher();
    await client.setEx(key, ttl, JSON.stringify(result));
    return result;
  } catch (err) {
    // Redis failure should not break the app — fall through to fetcher
    console.warn("[Redis] Cache miss (error):", err);
    return fetcher();
  }
}

/**
 * Build a consistent cache key
 */
export function cacheKey(namespace: string, ...parts: (string | number)[]): string {
  return `g2b:${namespace}:${parts.join(":")}`;
}

export { getRedisClient };
export default getRedisClient;
