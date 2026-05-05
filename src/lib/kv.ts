// KV store wrapper for CRM;IN.
//
// Uses Upstash Redis via node-redis in production (when REDIS_URL is set),
// and an in-memory Map fallback for local dev. REDIS_URL is auto-injected
// by Vercel's Upstash Marketplace integration.
//
// What the server holds:
//   - User records (email, name, verifiedAt, lastLoginAt)
//   - Magic-link tokens (15-min TTL)
//   - Session tokens (30-day TTL)
// What the server NEVER holds:
//   - Contacts, message templates, or campaigns (those live in localStorage)
//   - The user's Anthropic API key (BYOK, client-only)

import { createClient, type RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL;
const isRedisConfigured = Boolean(REDIS_URL);

let _client: RedisClientType | null = null;
let _clientPromise: Promise<RedisClientType> | null = null;

async function getClient(): Promise<RedisClientType> {
  if (_client?.isOpen) return _client;
  if (_clientPromise) return _clientPromise;
  _clientPromise = (async () => {
    const client: RedisClientType = createClient({ url: REDIS_URL });
    client.on("error", (err) => console.error("[redis]", err));
    await client.connect();
    _client = client;
    _clientPromise = null;
    return client;
  })();
  return _clientPromise;
}

type MemEntry = { value: unknown; expiresAt?: number };

// Pin the in-memory store to globalThis so it survives Next.js dev-mode
// module reloads (HMR sometimes re-evaluates this module, which would
// reset a normal module-scoped Map and wipe sessions between requests).
// In production this code path is never used (REDIS_URL is set).
const globalForKv = globalThis as unknown as {
  __crminMemoryStore?: Map<string, MemEntry>;
};
const memoryStore =
  globalForKv.__crminMemoryStore ?? new Map<string, MemEntry>();
if (!globalForKv.__crminMemoryStore) {
  globalForKv.__crminMemoryStore = memoryStore;
}

function getMem<T>(key: string): T | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value as T;
}

function setMem<T>(key: string, value: T, ttlSeconds?: number): void {
  memoryStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
  });
}

function delMem(key: string): void {
  memoryStore.delete(key);
}

// Records ----------------------------------------------------------------

export type UserRecord = {
  email: string;
  name: string;
  newsletterConsent: boolean;
  consentTimestamp: number;
  createdAt: number;
  verifiedAt: number | null;
  lastLoginAt: number | null;
};

export type MagicLinkRecord = {
  email: string;
  createdAt: number;
};

export type SessionRecord = {
  email: string;
  createdAt: number;
  lastActiveAt: number;
};

// Keys -------------------------------------------------------------------

const userKey = (email: string) => `crmin:user:${email}`;
const magicLinkKey = (token: string) => `crmin:magic:${token}`;
const sessionKey = (token: string) => `crmin:session:${token}`;
const scrapeRateLimitKey = (email: string, dateIso: string) =>
  `crmin:ratelimit:scrape:${email}:${dateIso}`;
const URL_LOG_LIST = "crmin:urllog";

// Users ------------------------------------------------------------------

export async function getUser(email: string): Promise<UserRecord | null> {
  const key = userKey(email);
  if (isRedisConfigured) {
    const client = await getClient();
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as UserRecord) : null;
  }
  return getMem<UserRecord>(key);
}

export async function setUser(record: UserRecord): Promise<void> {
  const key = userKey(record.email);
  if (isRedisConfigured) {
    const client = await getClient();
    await client.set(key, JSON.stringify(record));
    await client.sAdd("crmin:users:all", record.email);
  } else {
    setMem(key, record);
  }
}

// Magic links ------------------------------------------------------------

export async function getMagicLink(
  token: string
): Promise<MagicLinkRecord | null> {
  const key = magicLinkKey(token);
  if (isRedisConfigured) {
    const client = await getClient();
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as MagicLinkRecord) : null;
  }
  return getMem<MagicLinkRecord>(key);
}

export async function setMagicLink(
  token: string,
  record: MagicLinkRecord,
  ttlSeconds: number
): Promise<void> {
  const key = magicLinkKey(token);
  if (isRedisConfigured) {
    const client = await getClient();
    await client.set(key, JSON.stringify(record), {
      expiration: { type: "EX", value: ttlSeconds },
    });
  } else {
    setMem(key, record, ttlSeconds);
  }
}

export async function deleteMagicLink(token: string): Promise<void> {
  const key = magicLinkKey(token);
  if (isRedisConfigured) {
    const client = await getClient();
    await client.del(key);
  } else {
    delMem(key);
  }
}

// Sessions ---------------------------------------------------------------

export async function getSession(
  token: string
): Promise<SessionRecord | null> {
  const key = sessionKey(token);
  if (isRedisConfigured) {
    const client = await getClient();
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as SessionRecord) : null;
  }
  return getMem<SessionRecord>(key);
}

export async function setSession(
  token: string,
  record: SessionRecord,
  ttlSeconds: number
): Promise<void> {
  const key = sessionKey(token);
  if (isRedisConfigured) {
    const client = await getClient();
    await client.set(key, JSON.stringify(record), {
      expiration: { type: "EX", value: ttlSeconds },
    });
  } else {
    setMem(key, record, ttlSeconds);
  }
}

export async function refreshSessionTtl(
  token: string,
  ttlSeconds: number
): Promise<void> {
  const key = sessionKey(token);
  if (isRedisConfigured) {
    const client = await getClient();
    await client.expire(key, ttlSeconds);
  } else {
    const entry = memoryStore.get(key);
    if (entry) entry.expiresAt = Date.now() + ttlSeconds * 1000;
  }
}

export async function deleteSession(token: string): Promise<void> {
  const key = sessionKey(token);
  if (isRedisConfigured) {
    const client = await getClient();
    await client.del(key);
  } else {
    delMem(key);
  }
}

// Scrape rate limit (per verified email per day, 36h TTL) -----------------

const SCRAPE_DAILY_CAP = 5;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type ScrapeQuotaResult = {
  allowed: boolean;
  used: number;
  cap: number;
};

export async function consumeScrapeQuota(
  email: string
): Promise<ScrapeQuotaResult> {
  const key = scrapeRateLimitKey(email, todayIso());
  if (isRedisConfigured) {
    const client = await getClient();
    const next = await client.incr(key);
    if (next === 1) {
      await client.expire(key, 36 * 60 * 60);
    }
    if (next > SCRAPE_DAILY_CAP) {
      return { allowed: false, used: next, cap: SCRAPE_DAILY_CAP };
    }
    return { allowed: true, used: next, cap: SCRAPE_DAILY_CAP };
  }
  const current = (getMem<number>(key) ?? 0) + 1;
  setMem(key, current, 36 * 60 * 60);
  if (current > SCRAPE_DAILY_CAP) {
    return { allowed: false, used: current, cap: SCRAPE_DAILY_CAP };
  }
  return { allowed: true, used: current, cap: SCRAPE_DAILY_CAP };
}

export async function refundScrapeQuota(email: string): Promise<void> {
  // Called when a scrape attempt fails before reaching Claude (e.g. SSRF
  // reject). Optional, keeps the user's daily quota fair.
  const key = scrapeRateLimitKey(email, todayIso());
  if (isRedisConfigured) {
    const client = await getClient();
    await client.decr(key);
  } else {
    const current = getMem<number>(key) ?? 0;
    if (current > 0) setMem(key, current - 1, 36 * 60 * 60);
  }
}

// Anonymous URL log -------------------------------------------------------
// Append-only stream of `{ts, url}` for every successful scrape. NOT tied
// to user identity — it's intel about what kinds of public lists CRM;IN
// users find useful. Retained here forever (small, cheap).

export async function appendUrlLog(url: string): Promise<void> {
  const entry = JSON.stringify({ ts: Date.now(), url });
  if (isRedisConfigured) {
    const client = await getClient();
    await client.rPush(URL_LOG_LIST, entry);
  } else {
    const list = getMem<string[]>(URL_LOG_LIST) ?? [];
    list.push(entry);
    setMem(URL_LOG_LIST, list);
  }
}

export const storeMode = isRedisConfigured ? "upstash-redis" : "in-memory-dev";
