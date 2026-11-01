import { BillingError, type BillingClient, type BillingOffer, type BillingPeriod, type BillingStatus, type PurchaseOutcome } from './billing';

/** The RevenueCat entitlement that unlocks आजीची पेटी Plus. */
export const PLUS_ENTITLEMENT = 'plus';

// Only the few members we use — the real module is loaded lazily so Expo Go and the web build
// (which have no native purchases module) never touch it.
interface RcCustomerInfo {
  entitlements: { active: Record<string, unknown> };
  managementURL: string | null;
}
interface RcPackage {
  product: { priceString: string };
}
export interface RcModule {
  configure(options: { apiKey: string; appUserID?: string }): void;
  getCustomerInfo(): Promise<RcCustomerInfo>;
  getOfferings(): Promise<{ current: { monthly: RcPackage | null; annual: RcPackage | null } | null }>;
  purchasePackage(pkg: RcPackage): Promise<{ customerInfo: RcCustomerInfo }>;
  restorePurchases(): Promise<RcCustomerInfo>;
}

export interface RevenueCatOptions {
  /** Public SDK key for this platform (appl_… / goog_…). Never a secret key. */
  apiKey: string;
  /** The install id the server also sees, so the webhook and the app agree on who subscribed. */
  appUserId: () => Promise<string | undefined>;
  /** Injectable for tests. */
  load: () => RcModule | null;
}

function toStatus(info: RcCustomerInfo): BillingStatus {
  return { plusActive: !!info.entitlements.active[PLUS_ENTITLEMENT], manageUrl: info.managementURL ?? null };
}

function isCancel(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { userCancelled?: boolean }).userCancelled === true;
}

export class RevenueCatBilling implements BillingClient {
  private rc: RcModule | null = null;
  private ready: Promise<RcModule> | null = null;

  constructor(private readonly options: RevenueCatOptions) {
    if (options.apiKey) this.rc = options.load();
  }

  isAvailable(): boolean {
    return !!this.rc && !!this.options.apiKey;
  }

  private async sdk(): Promise<RcModule> {
    if (!this.rc || !this.options.apiKey) throw new BillingError('Purchases are not available.');
    const rc = this.rc;
    this.ready ??= (async () => {
      rc.configure({ apiKey: this.options.apiKey, appUserID: await this.options.appUserId() });
      return rc;
    })();
    try {
      return await this.ready;
    } catch (e) {
      this.ready = null;
      throw e;
    }
  }

  async status(): Promise<BillingStatus> {
    return toStatus(await (await this.sdk()).getCustomerInfo());
  }

  async offers(): Promise<BillingOffer[]> {
    const current = (await (await this.sdk()).getOfferings()).current;
    const out: BillingOffer[] = [];
    if (current?.monthly) out.push({ period: 'month', priceLabel: current.monthly.product.priceString });
    if (current?.annual) out.push({ period: 'year', priceLabel: current.annual.product.priceString });
    return out;
  }

  async purchase(period: BillingPeriod): Promise<PurchaseOutcome> {
    try {
      const rc = await this.sdk();
      const current = (await rc.getOfferings()).current;
      const pkg = period === 'month' ? current?.monthly : current?.annual;
      if (!pkg) throw new BillingError('This plan is not available right now.');
      const { customerInfo } = await rc.purchasePackage(pkg);
      if (!toStatus(customerInfo).plusActive) throw new BillingError('Purchase is not active yet.');
      return 'purchased';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      if (e instanceof BillingError) throw e;
      throw new BillingError(e instanceof Error ? e.message : undefined);
    }
  }

  async restore(): Promise<BillingStatus> {
    try {
      return toStatus(await (await this.sdk()).restorePurchases());
    } catch (e) {
      if (e instanceof BillingError) throw e;
      throw new BillingError(e instanceof Error ? e.message : undefined);
    }
  }
}
