/**
 * Paid plan on the server. RevenueCat (which talks to the App Store and Google Play) tells this
 * webhook when a parent subscribes, renews, cancels or the plan ends. We keep only
 * "this hashed install id has Plus until <date>" — never a name, email or card detail.
 *
 * Off until REVENUECAT_WEBHOOK_SECRET is set: every call is refused with 503 before that.
 */
import { hash } from './usageLimit';

export type Plan = 'FREE' | 'PLUS';

export interface SubscriptionChange {
  /** Hashed install id. */
  subject: string;
  /** When the paid period ends (now, for an ended plan). */
  expiresAt: string;
  /** When RevenueCat made the event (older events never overwrite newer ones). */
  eventAt: string;
  productId: string;
}

export interface EntitlementStore {
  apply(change: SubscriptionChange): Promise<void>;
  plan(subject: string): Promise<Plan>;
}

export interface EntitlementEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STORY_STATE_SECRET?: string;
  REVENUECAT_WEBHOOK_SECRET?: string;
  [key: string]: string | undefined;
}

interface RevenueCatEvent {
  type?: unknown;
  id?: unknown;
  app_user_id?: unknown;
  product_id?: unknown;
  expiration_at_ms?: unknown;
  event_timestamp_ms?: unknown;
  cancel_reason?: unknown;
}

/** Events that mean "paid until expiration_at_ms" (cancelling keeps the plan until the period ends). */
const ACTIVE_UNTIL_EXPIRY = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'CANCELLATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_EXTENDED',
]);

export type ParsedEvent =
  | { kind: 'change'; change: Omit<SubscriptionChange, 'subject'>; appUserId: string }
  | { kind: 'ignore'; why: string };

/** Turns a RevenueCat webhook body into a plan change (or says why it is ignored). */
export function parseRevenueCatEvent(body: unknown, now: Date = new Date()): ParsedEvent {
  const e = ((body ?? {}) as { event?: RevenueCatEvent }).event;
  if (!e || typeof e.type !== 'string') return { kind: 'ignore', why: 'no event' };
  const appUserId = typeof e.app_user_id === 'string' ? e.app_user_id : '';
  if (e.type === 'TEST') return { kind: 'ignore', why: 'test event' };
  if (!appUserId || appUserId.startsWith('$RCAnonymousID')) return { kind: 'ignore', why: 'no install id' };
  const eventMs = Number(e.event_timestamp_ms);
  const eventAt = new Date(Number.isFinite(eventMs) && eventMs > 0 ? eventMs : now.getTime()).toISOString();
  const productId = typeof e.product_id === 'string' ? e.product_id : '';

  // The plan ends now: expired, or refunded through the store's support.
  const refunded = e.type === 'CANCELLATION' && (e.cancel_reason === 'CUSTOMER_SUPPORT' || e.cancel_reason === 'REFUND');
  if (e.type === 'EXPIRATION' || refunded) {
    return { kind: 'change', appUserId, change: { expiresAt: now.toISOString(), eventAt, productId } };
  }
  if (ACTIVE_UNTIL_EXPIRY.has(e.type)) {
    const expMs = Number(e.expiration_at_ms);
    if (!Number.isFinite(expMs) || expMs <= 0) return { kind: 'ignore', why: 'no expiry date' };
    return { kind: 'change', appUserId, change: { expiresAt: new Date(expMs).toISOString(), eventAt, productId } };
  }
  return { kind: 'ignore', why: `not used: ${e.type}` };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface WebhookResult {
  status: number;
  body: { ok: boolean; note?: string };
}

/** The whole webhook: check the secret, read the event, save the change. */
export async function handleRevenueCatWebhook(
  body: unknown,
  authorization: string | null,
  env: EntitlementEnv,
  store: EntitlementStore | null,
  now: Date = new Date(),
): Promise<WebhookResult> {
  const secret = env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret || !store) return { status: 503, body: { ok: false, note: 'payments are not switched on' } };
  const given = (authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!given || !safeEqual(given, secret)) return { status: 401, body: { ok: false } };

  const parsed = parseRevenueCatEvent(body, now);
  if (parsed.kind === 'ignore') return { status: 200, body: { ok: true, note: parsed.why } };
  const subject = await hash(parsed.appUserId, env.STORY_STATE_SECRET || 'goshti');
  try {
    await store.apply({ subject, ...parsed.change });
  } catch {
    // RevenueCat retries on a server error, so the change is not lost.
    return { status: 500, body: { ok: false, note: 'could not save' } };
  }
  return { status: 200, body: { ok: true } };
}

/** The plan for an install id (FREE if unknown, expired, or the store is unreachable). */
export async function planFor(store: EntitlementStore | null, deviceId: string | undefined, env: EntitlementEnv): Promise<Plan> {
  if (!store || !deviceId) return 'FREE';
  try {
    return await store.plan(await hash(deviceId, env.STORY_STATE_SECRET || 'goshti'));
  } catch {
    return 'FREE';
  }
}

/** Subscriptions in Supabase Postgres, through the server-only functions. */
export class SupabaseEntitlementStore implements EntitlementStore {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    const res = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}` },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  }

  async apply(c: SubscriptionChange): Promise<void> {
    await this.rpc('apply_subscription_event', {
      p_subject: c.subject,
      p_expires: c.expiresAt,
      p_event_at: c.eventAt,
      p_product: c.productId,
    });
  }

  async plan(subject: string): Promise<Plan> {
    return (await this.rpc('get_plan', { p_subject: subject })) === 'PLUS' ? 'PLUS' : 'FREE';
  }
}

/** In memory — for tests. */
export class MemoryEntitlementStore implements EntitlementStore {
  constructor(private readonly clock: () => number = Date.now) {}
  readonly rows = new Map<string, SubscriptionChange>();
  async apply(c: SubscriptionChange): Promise<void> {
    const old = this.rows.get(c.subject);
    if (!old || old.eventAt <= c.eventAt) this.rows.set(c.subject, c);
  }
  async plan(subject: string): Promise<Plan> {
    const r = this.rows.get(subject);
    return r && Date.parse(r.expiresAt) > this.clock() ? 'PLUS' : 'FREE';
  }
}
