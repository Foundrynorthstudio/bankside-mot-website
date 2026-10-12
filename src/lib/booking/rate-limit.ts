import { env as workerEnv } from 'cloudflare:workers';

type KvNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

const memoryHits = new Map<string, number[]>();

function sessionKv(): KvNamespace | undefined {
  try {
    return (workerEnv as { SESSION?: KvNamespace }).SESSION;
  } catch {
    return undefined;
  }
}

function limitKey(bucket: string, ip: string) {
  return `rl:${bucket}:${ip || 'unknown'}`;
}

async function readHits(key: string): Promise<number[]> {
  const kv = sessionKv();
  if (kv) {
    try {
      const raw = await kv.get(key);
      return raw ? (JSON.parse(raw) as number[]) : [];
    } catch {
      return [];
    }
  }
  return memoryHits.get(key) ?? [];
}

async function writeHits(key: string, hits: number[], windowMs: number) {
  const kv = sessionKv();
  if (kv) {
    try {
      await kv.put(key, JSON.stringify(hits), {
        expirationTtl: Math.ceil(windowMs / 1000) + 60,
      });
    } catch {
      // Local or prerender has no KV write path.
    }
    return;
  }
  memoryHits.set(key, hits);
}

function freshHits(hits: number[], windowMs: number, now = Date.now()) {
  return hits.filter((stamp) => now - stamp < windowMs);
}

export async function isRateLimited(bucket: string, ip: string, limit: number, windowMs: number) {
  const key = limitKey(bucket, ip);
  const recent = freshHits(await readHits(key), windowMs);
  if (!sessionKv()) memoryHits.set(key, recent);
  return recent.length >= limit;
}

export async function consumeRateLimit(bucket: string, ip: string, limit: number, windowMs: number) {
  const key = limitKey(bucket, ip);
  const now = Date.now();
  const recent = freshHits(await readHits(key), windowMs, now);
  if (recent.length >= limit) {
    await writeHits(key, recent, windowMs);
    return false;
  }
  recent.push(now);
  await writeHits(key, recent, windowMs);
  return true;
}

export const rateLimits = {
  login: { limit: 5, windowMs: 15 * 60 * 1000 },
  contact: { limit: 5, windowMs: 15 * 60 * 1000 },
  booking: { limit: 10, windowMs: 60 * 60 * 1000 },
  lookup: { limit: 20, windowMs: 10 * 60 * 1000 },
} as const;
