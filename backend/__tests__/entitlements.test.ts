import { describe, expect, it } from 'vitest';

import { handleRevenueCatWebhook, MemoryEntitlementStore, parseRevenueCatEvent, planFor } from '../entitlements';
import { hash } from '../usageLimit';

const NOW = new Date('2026-11-01T00:00:00Z');
const ENV = { REVENUECAT_WEBHOOK_SECRET: 'whsec-test', STORY_STATE_SECRET: 's' };
const DEVICE = 'abcdef0123456789abcdef';
const future = NOW.getTime() + 30 * 86_400_000;

const event = (type: string, extra: Record<string, unknown> = {}) => ({
  event: { type, app_user_id: DEVICE, product_id: 'plus_monthly', expiration_at_ms: future, event_timestamp_ms: NOW.getTime(), ...extra },
});

describe('parseRevenueCatEvent', () => {
  it('a purchase or renewal means Plus until the period ends', () => {
    for (const type of ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION']) {
      const p = parseRevenueCatEvent(event(type), NOW);
      expect(p.kind, type).toBe('change');
      if (p.kind === 'change') expect(p.change.expiresAt).toBe(new Date(future).toISOString());
    }
  });

  it('a cancellation keeps Plus until the paid period ends, but a refund ends it now', () => {
    const cancelled = parseRevenueCatEvent(event('CANCELLATION', { cancel_reason: 'UNSUBSCRIBE' }), NOW);
    if (cancelled.kind !== 'change') throw new Error('expected a change');
    expect(cancelled.change.expiresAt).toBe(new Date(future).toISOString());
    const refunded = parseRevenueCatEvent(event('CANCELLATION', { cancel_reason: 'CUSTOMER_SUPPORT' }), NOW);
    if (refunded.kind !== 'change') throw new Error('expected a change');
    expect(refunded.change.expiresAt).toBe(NOW.toISOString());
  });

  it('an expiry ends the plan now', () => {
    const p = parseRevenueCatEvent(event('EXPIRATION'), NOW);
    if (p.kind !== 'change') throw new Error('expected a change');
    expect(p.change.expiresAt).toBe(NOW.toISOString());
  });

  it('ignores test events, anonymous ids, unknown events and a missing expiry', () => {
    expect(parseRevenueCatEvent(event('TEST'), NOW).kind).toBe('ignore');
    expect(parseRevenueCatEvent(event('RENEWAL', { app_user_id: '$RCAnonymousID:abc' }), NOW).kind).toBe('ignore');
    expect(parseRevenueCatEvent(event('SOMETHING_NEW'), NOW).kind).toBe('ignore');
    expect(parseRevenueCatEvent(event('RENEWAL', { expiration_at_ms: null }), NOW).kind).toBe('ignore');
    expect(parseRevenueCatEvent({}, NOW).kind).toBe('ignore');
  });
});

describe('handleRevenueCatWebhook', () => {
  it('is off (503) until the secret is set', async () => {
    const store = new MemoryEntitlementStore(() => NOW.getTime() + 3_600_000);
    expect((await handleRevenueCatWebhook(event('RENEWAL'), 'x', {}, store, NOW)).status).toBe(503);
  });

  it('refuses a wrong or missing secret', async () => {
    const store = new MemoryEntitlementStore(() => NOW.getTime() + 3_600_000);
    expect((await handleRevenueCatWebhook(event('RENEWAL'), 'nope', ENV, store, NOW)).status).toBe(401);
    expect((await handleRevenueCatWebhook(event('RENEWAL'), null, ENV, store, NOW)).status).toBe(401);
    expect(store.rows.size).toBe(0);
  });

  it('saves a purchase under a hashed id and the plan then reads as PLUS', async () => {
    const store = new MemoryEntitlementStore(() => NOW.getTime() + 3_600_000);
    const r = await handleRevenueCatWebhook(event('INITIAL_PURCHASE'), 'Bearer whsec-test', ENV, store, NOW);
    expect(r.status).toBe(200);
    const key = await hash(DEVICE, 's');
    expect([...store.rows.keys()]).toEqual([key]);
    expect(key).not.toContain(DEVICE);
    expect(await planFor(store, DEVICE, ENV)).toBe('PLUS');
    expect(await planFor(store, 'someone-else-0123456789', ENV)).toBe('FREE');
  });

  it('an older event never overwrites a newer one', async () => {
    const store = new MemoryEntitlementStore(() => NOW.getTime() + 3_600_000);
    await handleRevenueCatWebhook(event('EXPIRATION', { event_timestamp_ms: NOW.getTime() + 1000 }), 'whsec-test', ENV, store, NOW);
    await handleRevenueCatWebhook(event('RENEWAL', { event_timestamp_ms: NOW.getTime() }), 'whsec-test', ENV, store, NOW);
    expect(await planFor(store, DEVICE, ENV)).toBe('FREE');
  });

  it('answers 500 (so RevenueCat retries) when saving fails', async () => {
    const store = { apply: async () => Promise.reject(new Error('down')), plan: async () => 'FREE' as const };
    expect((await handleRevenueCatWebhook(event('RENEWAL'), 'whsec-test', ENV, store, NOW)).status).toBe(500);
  });

  it('a plan lookup that fails reads as FREE', async () => {
    const store = { apply: async () => {}, plan: async () => Promise.reject(new Error('down')) };
    expect(await planFor(store, DEVICE, ENV)).toBe('FREE');
  });
});
