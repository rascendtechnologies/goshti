import type { PlanId, Subscription } from '@/types/models';

import { NoBilling, type BillingClient, type BillingOffer, type BillingPeriod, type PurchaseOutcome } from './billing';
import type { StorageService } from './storageService';

export interface PlanPrice {
  amount: number;
  currency: 'INR';
  label: string;
  period: 'month' | 'year';
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  monthlyLimit: number;
  prices: PlanPrice[];
}

/** Mock plan model. Prices are display-only until RevenueCat is wired in. */
export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: { id: 'FREE', name: 'आजीची पेटी', monthlyLimit: 2, prices: [] },
  PLUS: {
    id: 'PLUS',
    name: 'आजीची पेटी Plus',
    monthlyLimit: 15,
    prices: [
      { amount: 249, currency: 'INR', label: '₹249', period: 'month' },
      { amount: 1999, currency: 'INR', label: '₹1,999', period: 'year' },
    ],
  },
};

export interface SubscriptionService {
  getSubscription(): Promise<Subscription>;
  canGenerateStory(): Promise<boolean>;
  /** Call once per successfully generated new story (replays are free). */
  recordStoryGenerated(): Promise<Subscription>;
  /** True when real store purchases work (a store build with RevenueCat keys, not Expo Go). */
  purchasesAvailable(): boolean;
  /** Real store prices (parent's currency); empty when purchases are not available. */
  offers(): Promise<BillingOffer[]>;
  /** Opens the store's payment sheet. Throws BillingError when it fails. */
  purchase(period: BillingPeriod): Promise<PurchaseOutcome>;
  /** Brings back a subscription bought earlier (new phone, reinstall). Returns whether Plus is active. */
  restore(): Promise<boolean>;
  /** Store page where the parent manages / cancels the subscription, if known. */
  manageUrl(): Promise<string | null>;
  /** DEVELOPMENT ONLY (the Parent screen shows these in dev builds): reset usage / switch plan for testing. */
  devResetUsage(): Promise<Subscription>;
  devSetPlan(plan: PlanId): Promise<Subscription>;
}

export class PurchasesNotAvailableError extends Error {
  constructor() {
    super('Purchases are not available yet.');
    this.name = 'PurchasesNotAvailableError';
  }
}

function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export class LocalSubscriptionService implements SubscriptionService {
  constructor(
    private readonly storage: StorageService,
    /** Plan for a fresh install (test builds start on PLUS). */
    private readonly defaultPlan: PlanId = 'FREE',
  ) {}

  async getSubscription(): Promise<Subscription> {
    const stored = await this.storage.getSubscription();
    const plan = stored?.plan ?? this.defaultPlan;
    let subscription: Subscription = {
      plan,
      monthlyLimit: PLANS[plan].monthlyLimit,
      storiesGeneratedThisMonth: stored?.storiesGeneratedThisMonth ?? 0,
    };

    // Reset the counter when a new calendar month starts.
    const month = currentMonth();
    if ((await this.storage.getUsageMonth()) !== month) {
      subscription = { ...subscription, storiesGeneratedThisMonth: 0 };
      await this.storage.saveUsageMonth(month);
      await this.storage.saveSubscription(subscription);
    }
    return subscription;
  }

  async canGenerateStory(): Promise<boolean> {
    const s = await this.getSubscription();
    return s.storiesGeneratedThisMonth < s.monthlyLimit;
  }

  async recordStoryGenerated(): Promise<Subscription> {
    const s = await this.getSubscription();
    const next = { ...s, storiesGeneratedThisMonth: s.storiesGeneratedThisMonth + 1 };
    await this.storage.saveSubscription(next);
    return next;
  }

  purchasesAvailable(): boolean {
    return false;
  }
  async offers(): Promise<BillingOffer[]> {
    return [];
  }
  async purchase(_period?: BillingPeriod): Promise<PurchaseOutcome> {
    throw new PurchasesNotAvailableError();
  }
  async restore(): Promise<boolean> {
    throw new PurchasesNotAvailableError();
  }
  async manageUrl(): Promise<string | null> {
    return null;
  }

  async devResetUsage(): Promise<Subscription> {
    const next = { ...(await this.getSubscription()), storiesGeneratedThisMonth: 0 };
    await this.storage.saveSubscription(next);
    return next;
  }

  async devSetPlan(plan: PlanId): Promise<Subscription> {
    const next = { ...(await this.getSubscription()), plan, monthlyLimit: PLANS[plan].monthlyLimit };
    await this.storage.saveSubscription(next);
    return next;
  }
}

/**
 * Plan from the store (via RevenueCat) + usage count kept on the phone. When purchases are not
 * available (Expo Go, test builds without keys) it behaves exactly like the local service.
 */
export class PurchasesSubscriptionService extends LocalSubscriptionService {
  private lastKnownPlus: boolean | null = null;
  private lastManageUrl: string | null = null;

  constructor(
    storage: StorageService,
    defaultPlan: PlanId,
    private readonly billing: BillingClient = new NoBilling(),
  ) {
    super(storage, defaultPlan);
  }

  override purchasesAvailable(): boolean {
    return this.billing.isAvailable();
  }

  private async refresh(): Promise<void> {
    try {
      const status = await this.billing.status();
      this.lastKnownPlus = status.plusActive;
      this.lastManageUrl = status.manageUrl;
    } catch {
      // Offline: keep the last known answer (the store SDK also caches it).
    }
  }

  override async getSubscription(): Promise<Subscription> {
    const local = await super.getSubscription();
    if (!this.billing.isAvailable()) return local;
    await this.refresh();
    const plan: PlanId = this.lastKnownPlus ? 'PLUS' : 'FREE';
    return { ...local, plan, monthlyLimit: PLANS[plan].monthlyLimit };
  }

  override offers(): Promise<BillingOffer[]> {
    return this.billing.isAvailable() ? this.billing.offers().catch(() => []) : Promise.resolve([]);
  }

  override async purchase(period: BillingPeriod): Promise<PurchaseOutcome> {
    const outcome = await this.billing.purchase(period);
    if (outcome === 'purchased') this.lastKnownPlus = true;
    return outcome;
  }

  override async restore(): Promise<boolean> {
    const status = await this.billing.restore();
    this.lastKnownPlus = status.plusActive;
    this.lastManageUrl = status.manageUrl;
    return status.plusActive;
  }

  override async manageUrl(): Promise<string | null> {
    if (this.billing.isAvailable()) await this.refresh();
    return this.lastManageUrl;
  }

  override async devSetPlan(plan: PlanId): Promise<Subscription> {
    // Test tools only make sense without real purchases.
    return this.billing.isAvailable() ? this.getSubscription() : super.devSetPlan(plan);
  }
}
