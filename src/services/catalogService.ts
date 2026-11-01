/**
 * The story catalogue in the app: published personal stories from Supabase are fetched, checked and
 * kept on the phone, so new stories (or a corrected word) arrive WITHOUT an app update. Nothing here
 * can break a story: any problem leaves the stories built into the app in use.
 */
import { parseCatalogRows, setCatalogStories } from '@engine/index';

export interface CatalogCache {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
}

export interface CatalogServiceDeps {
  /** e.g. https://xyz.supabase.co (empty = catalogue off). */
  supabaseUrl: string;
  anonKey: string;
  cache: CatalogCache;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Do not ask Supabase again before this long has passed. */
  minRefreshMs?: number;
  now?: () => number;
}

export class CatalogService {
  private cacheLoaded: Promise<void> | null = null;
  private lastFetchAt = 0;

  constructor(private readonly deps: CatalogServiceDeps) {}

  /** Resolves once the saved copy (if any) is in use. Fast, never throws, never waits for the network. */
  ready(): Promise<void> {
    this.cacheLoaded ??= this.applyCache();
    return this.cacheLoaded;
  }

  /** Applies the saved copy, then fetches a fresh one in the background. */
  start(): void {
    void this.ready().then(() => this.refresh());
  }

  /** Fetches the published stories and keeps them. Returns how many are in use. Never throws. */
  async refresh(): Promise<number | null> {
    const { supabaseUrl, anonKey } = this.deps;
    if (!supabaseUrl || !anonKey) return null;
    const now = (this.deps.now ?? Date.now)();
    if (now - this.lastFetchAt < (this.deps.minRefreshMs ?? 10 * 60_000)) return null;
    this.lastFetchAt = now;
    try {
      const res = await (this.deps.fetchImpl ?? fetch)(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/personal_stories?published=eq.true&select=*`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(this.deps.timeoutMs ?? 6000),
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as unknown;
      const stories = parseCatalogRows(rows);
      setCatalogStories(stories);
      await this.deps.cache.set(JSON.stringify(rows)).catch(() => {});
      return stories.length;
    } catch {
      this.lastFetchAt = 0; // try again next time
      return null;
    }
  }

  private async applyCache(): Promise<void> {
    try {
      const saved = await this.deps.cache.get();
      if (saved) setCatalogStories(parseCatalogRows(JSON.parse(saved)));
    } catch {
      // a damaged copy is simply not used
    }
  }
}
