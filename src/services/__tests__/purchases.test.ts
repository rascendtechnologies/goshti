import { describe, expect, it } from 'vitest';

import { BillingError, type BillingClient, type BillingStatus } from '../billing';
import { RevenueCatBilling } from '../revenueCatBilling';
import { PurchasesSubscriptionService } from '../subscriptionService';
import type { StorageService } from '../storageService';

function memoryStorage(): StorageService {
  let sub: unknown = null;
  let month: string | null = null;
  return {
    getSubscription: async () => sub,
    saveSubscription: async (s: unknown) => void (sub = s),
    getUsageMonth: async () => month,
    saveUsageMonth: async (m: string) => void (month = m),
  } as unknown as StorageService;
}

function fakeBilling(opts: { available?: boolean; plus?: boolean; fail?: boolean } = {}): BillingClient & { plus: boolean } {
  const state = { plus: opts.plus ?? false };
  const status = async (): Promise<BillingStatus> => {
    if (opts.fail) throw new Error('offline');
    return { plusActive: state.plus, manageUrl: 'https://manage' };
  };
  return {
    get plus() {
      return state.plus;
    },
    set plus(v: boolean) {
      state.plus = v;
    },
    isAvailable: () => opts.available ?? true,
    status,
    offers: async () => [{ period: 'month', priceLabel: '₹249.00' }],
    purchase: async () => {
      state.plus = true;
      return 'purchased';
    },
    restore: status,
  };
}

describe('PurchasesSubscriptionService', () => {
  it('uses the local plan when purchases are not available (Expo Go)', async () => {
    const svc = new PurchasesSubscriptionService(memoryStorage(), 'PLUS', fakeBilling({ available: false }));
    expect((await svc.getSubscription()).plan).toBe('PLUS');
    expect(svc.purchasesAvailable()).toBe(false);
  });

  it('is FREE until the store says plus is active, then PLUS with the bigger limit', async () => {
    const billing = fakeBilling();
    const svc = new PurchasesSubscriptionService(memoryStorage(), 'PLUS', billing);
    expect((await svc.getSubscription()).plan).toBe('FREE');
    expect(await svc.purchase('month')).toBe('purchased');
    const s = await svc.getSubscription();
    expect(s.plan).toBe('PLUS');
    expect(s.monthlyLimit).toBe(15);
  });

  it('keeps the usage count across a plan change', async () => {
    const svc = new PurchasesSubscriptionService(memoryStorage(), 'FREE', fakeBilling({ plus: true }));
    await svc.recordStoryGenerated();
    expect((await svc.getSubscription()).storiesGeneratedThisMonth).toBe(1);
  });

  it('keeps the last known plan when the store cannot be reached', async () => {
    const billing = fakeBilling({ plus: true });
    const svc = new PurchasesSubscriptionService(memoryStorage(), 'FREE', billing);
    expect((await svc.getSubscription()).plan).toBe('PLUS');
    const offline = new PurchasesSubscriptionService(memoryStorage(), 'FREE', { ...fakeBilling({ fail: true }) });
    expect((await offline.getSubscription()).plan).toBe('FREE');
  });

  it('restore returns whether plus is active and exposes the manage link', async () => {
    const svc = new PurchasesSubscriptionService(memoryStorage(), 'FREE', fakeBilling({ plus: true }));
    expect(await svc.restore()).toBe(true);
    expect(await svc.manageUrl()).toBe('https://manage');
  });
});

describe('RevenueCatBilling', () => {
  const info = (plus: boolean) => ({ entitlements: { active: plus ? { plus: {} } : {} }, managementURL: null });
  function module(calls: string[], purchaseError?: unknown) {
    const pkg = { product: { priceString: '₹249.00' } };
    return {
      configure: (o: { apiKey: string; appUserID?: string }) => void calls.push(`configure:${o.apiKey}:${o.appUserID}`),
      getCustomerInfo: async () => info(false),
      getOfferings: async () => ({ current: { monthly: pkg, annual: { product: { priceString: '₹1,999.00' } } } }),
      purchasePackage: async () => {
        if (purchaseError) throw purchaseError;
        return { customerInfo: info(true) };
      },
      restorePurchases: async () => info(true),
    };
  }

  it('is unavailable without a key or module', () => {
    expect(new RevenueCatBilling({ apiKey: '', appUserId: async () => 'x', load: () => module([]) }).isAvailable()).toBe(false);
    expect(new RevenueCatBilling({ apiKey: 'appl_x', appUserId: async () => 'x', load: () => null }).isAvailable()).toBe(false);
  });

  it('configures once with the install id and lists store prices', async () => {
    const calls: string[] = [];
    const b = new RevenueCatBilling({ apiKey: 'appl_x', appUserId: async () => 'dev1', load: () => module(calls) });
    expect(await b.offers()).toEqual([
      { period: 'month', priceLabel: '₹249.00' },
      { period: 'year', priceLabel: '₹1,999.00' },
    ]);
    await b.status();
    expect(calls).toEqual(['configure:appl_x:dev1']);
  });

  it('turns a cancelled sheet into "cancelled" and other failures into BillingError', async () => {
    const mk = (err: unknown) => new RevenueCatBilling({ apiKey: 'k', appUserId: async () => 'd', load: () => module([], err) });
    expect(await mk({ userCancelled: true }).purchase('month')).toBe('cancelled');
    await expect(mk(new Error('boom')).purchase('month')).rejects.toBeInstanceOf(BillingError);
    expect(await mk(undefined).purchase('year')).toBe('purchased');
    expect((await mk(undefined).restore()).plusActive).toBe(true);
  });
});
