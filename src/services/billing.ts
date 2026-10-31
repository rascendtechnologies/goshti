/**
 * Billing — the only file that knows about RevenueCat. Everything else (and every test) talks to
 * the small `BillingClient` interface, so the store provider can change without touching screens.
 *
 * No card or payment details ever pass through the app: Apple / Google take the payment and
 * RevenueCat only tells us whether the "plus" entitlement is active.
 */
export type BillingPeriod = 'month' | 'year';

export interface BillingOffer {
  period: BillingPeriod;
  /** Price text from the store itself, in the parent's currency (e.g. "₹249.00"). */
  priceLabel: string;
}

export interface BillingStatus {
  plusActive: boolean;
  /** Where the parent manages or cancels (App Store / Play subscriptions page). */
  manageUrl: string | null;
}

export type PurchaseOutcome = 'purchased' | 'cancelled';

export interface BillingClient {
  /** False in Expo Go, on web, or when no store key is set — the app then uses the local plan. */
  isAvailable(): boolean;
  status(): Promise<BillingStatus>;
  offers(): Promise<BillingOffer[]>;
  purchase(period: BillingPeriod): Promise<PurchaseOutcome>;
  restore(): Promise<BillingStatus>;
}

export class BillingError extends Error {
  constructor(message = 'Purchase could not be completed.') {
    super(message);
    this.name = 'BillingError';
  }
}

/** Always off: used when purchases are not set up (Expo Go, no keys). */
export class NoBilling implements BillingClient {
  isAvailable() {
    return false;
  }
  async status(): Promise<BillingStatus> {
    return { plusActive: false, manageUrl: null };
  }
  async offers(): Promise<BillingOffer[]> {
    return [];
  }
  async purchase(): Promise<PurchaseOutcome> {
    throw new BillingError('Purchases are not available.');
  }
  async restore(): Promise<BillingStatus> {
    return this.status();
  }
}
