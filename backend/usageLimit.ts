/**
 * Abuse limits for the story server. The app only holds a PUBLIC key, so without limits anyone
 * could call the server in a loop and run up the Google bill. Every expensive request is counted:
 *   - per device  (a random install id the app makes; stored hashed)
 *   - per network address (hashed) — catches someone who keeps changing the device id
 *   - globally per day — the hard ceiling on spend
 * Counters live in Supabase (public.usage_counters via take_usage); nothing about the child is stored.
 * If the counter store is unreachable the request is allowed (a database hiccup must not stop a
 * bedtime story) — the global ceiling and the Google Cloud budget are the backstop.
 */
export type UsageKind = 'story' | 'voice' | 'audition';

export interface UsageLimiter {
  /** Adds one use; false = this limit is already reached. */
  take(scope: string, kind: string, period: string, limit: number): Promise<boolean>;
}

export interface Caller {
  deviceId?: string;
  ip?: string;
}

export interface UsageEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STORY_STATE_SECRET?: string;
  /** "off" turns the limits off (local development). */
  USAGE_LIMITS?: string;
  [key: string]: string | undefined;
}

interface Rule {
  scope: 'device' | 'ip' | 'global';
  window: 'day' | 'month';
  env: string;
  limit: number;
}

/** Defaults are generous for a family and tight for a script. Override with the env names shown. */
const RULES: Record<UsageKind, Rule[]> = {
  // a new story (the start of a story request; continuation steps are free)
  story: [
    { scope: 'device', window: 'day', env: 'USAGE_STORY_DEVICE_DAY', limit: 10 },
    { scope: 'device', window: 'month', env: 'USAGE_STORY_DEVICE_MONTH', limit: 40 },
    { scope: 'ip', window: 'day', env: 'USAGE_STORY_IP_DAY', limit: 80 },
    { scope: 'global', window: 'day', env: 'USAGE_STORY_GLOBAL_DAY', limit: 1500 },
  ],
  // one chunk of Aaji's voice (a story is about 4–6 chunks)
  voice: [
    { scope: 'device', window: 'day', env: 'USAGE_VOICE_DEVICE_DAY', limit: 250 },
    { scope: 'ip', window: 'day', env: 'USAGE_VOICE_IP_DAY', limit: 1200 },
    { scope: 'global', window: 'day', env: 'USAGE_VOICE_GLOBAL_DAY', limit: 20000 },
  ],
  // voice samples / voice tests (not used by children)
  audition: [
    { scope: 'device', window: 'day', env: 'USAGE_AUDITION_DEVICE_DAY', limit: 20 },
    { scope: 'ip', window: 'day', env: 'USAGE_AUDITION_IP_DAY', limit: 60 },
    { scope: 'global', window: 'day', env: 'USAGE_AUDITION_GLOBAL_DAY', limit: 400 },
  ],
};

export function usageKindFor(body: unknown): UsageKind | null {
  const b = (body ?? {}) as { action?: unknown; request?: unknown; continuation?: unknown };
  if (b.action === 'tts-render') return 'voice';
  if (b.action === 'tts-audition' || b.action === 'tts-voice-test') return 'audition';
  if (b.action === undefined && b.continuation === undefined && b.request !== undefined) return 'story';
  return null;
}

export function validDeviceId(id: unknown): string | undefined {
  return typeof id === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(id) ? id : undefined;
}

export async function hash(value: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${value}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function periodOf(window: 'day' | 'month', now: Date): string {
  const iso = now.toISOString();
  return window === 'day' ? iso.slice(0, 10) : iso.slice(0, 7);
}

function limitOf(rule: Rule, env: UsageEnv): number {
  const raw = env[rule.env];
  if (raw === undefined || raw.trim() === '') return rule.limit;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : rule.limit;
}

export type UsageDecision = { ok: true } | { ok: false; limit: string };

export async function checkUsage(
  limiter: UsageLimiter,
  env: UsageEnv,
  caller: Caller,
  kind: UsageKind,
  now: Date = new Date(),
): Promise<UsageDecision> {
  const salt = env.STORY_STATE_SECRET || 'goshti';
  for (const rule of RULES[kind]) {
    let scope: string;
    if (rule.scope === 'global') scope = 'global';
    else if (rule.scope === 'device') {
      if (!caller.deviceId) continue; // an old app without an id: the network and global limits still apply
      scope = `d:${await hash(caller.deviceId, salt)}`;
    } else {
      if (!caller.ip) continue;
      scope = `i:${await hash(caller.ip, salt)}`;
    }
    const allowed = await limiter.take(scope, kind, periodOf(rule.window, now), limitOf(rule, env));
    if (!allowed) return { ok: false, limit: `${rule.scope}/${rule.window}` };
  }
  return { ok: true };
}

/** Counters in Supabase Postgres, through the server-only take_usage function. */
export class SupabaseUsageLimiter implements UsageLimiter {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly log: (line: string) => void = console.log,
  ) {}

  async take(scope: string, kind: string, period: string, limit: number): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/rest/v1/rpc/take_usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}` },
        body: JSON.stringify({ p_scope: scope, p_kind: kind, p_period: period, p_limit: limit }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) {
        this.log(`usage limiter: HTTP ${res.status} (allowing)`);
        return true;
      }
      const n = Number(await res.json());
      return Number.isFinite(n) ? n !== -1 : true;
    } catch (e) {
      this.log(`usage limiter unavailable (allowing): ${(e as Error).message}`);
      return true;
    }
  }
}

/** In memory — for tests and the local dev server. */
export class MemoryUsageLimiter implements UsageLimiter {
  readonly counts = new Map<string, number>();
  async take(scope: string, kind: string, period: string, limit: number): Promise<boolean> {
    const key = `${scope}|${kind}|${period}`;
    const n = this.counts.get(key) ?? 0;
    if (limit <= 0 || n >= limit) return false;
    this.counts.set(key, n + 1);
    return true;
  }
}

export function limiterFromEnv(env: UsageEnv): UsageLimiter | null {
  if (env.USAGE_LIMITS === 'off') return null;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return new SupabaseUsageLimiter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
