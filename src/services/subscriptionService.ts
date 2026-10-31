import type { PlanId, Subscription } from '@/types/models';

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
  /** Placeholder — purchases are not implemented in the POC. */
  purchase(planId: PlanId, period: PlanPrice['period']): Promise<never>;
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

  async purchase(): Promise<never> {
    throw new PurchasesNotAvailableError();
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
