import Redis from 'ioredis';
import logger from './logger';
import config from '../config';

let client: Redis | null = null;
let connected = false;

/** Returns the shared Redis client, or null if Redis is unavailable. */
export function getRedis(): Redis | null {
  if (client) return connected ? client : null;

  client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: (config.redis as any).password || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3000,
  });

  client.on('connect', () => {
    connected = true;
    logger.info('Redis connected');
  });

  client.on('error', (err) => {
    if (connected) logger.warn('Redis error:', err.message);
    connected = false;
  });

  client.connect().catch(() => {
    connected = false;
    logger.warn('Redis unavailable — caching disabled');
  });

  return connected ? client : null;
}

/** Get a JSON-parsed value from Redis, or null on miss/error. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

/** Set a JSON value in Redis with TTL seconds. No-op if Redis unavailable. */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch { /* silent */ }
}

/** Delete a key from Redis. No-op if Redis unavailable. */
export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch { /* silent */ }
}
