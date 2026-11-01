/**
 * The story catalogue on the server: published rows of the Supabase `personal_stories` table are
 * loaded (and kept for a few minutes), checked, and registered ahead of the stories built into the
 * code. If Supabase cannot be reached the built-in stories are used — a catalogue problem must never
 * stop a child's story.
 */
import { parseCatalogRows, setCatalogStories } from '../story-engine/personal';

export interface CatalogEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const TTL_MS = 5 * 60_000;
let loadedAt = 0;
let loading: Promise<void> | null = null;

/** Loads the catalogue if it is older than a few minutes. Never throws. */
export async function ensureCatalog(
  env: CatalogEnv,
  log: (line: string) => void = () => {},
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<void> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  if (now() - loadedAt < TTL_MS) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      const res = await fetchImpl(`${env.SUPABASE_URL!.replace(/\/$/, '')}/rest/v1/personal_stories?published=eq.true&select=*`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const stories = parseCatalogRows(await res.json(), (id, errors) => log(`catalog: ignored "${id}": ${errors.join('; ')}`));
      setCatalogStories(stories);
      loadedAt = now();
      log(`catalog: ${stories.length} published story(ies)`);
    } catch (e) {
      // Keep whatever was loaded before; try again soon (not on every request).
      loadedAt = now() - TTL_MS + 30_000;
      log(`catalog: not loaded (${(e as Error).message}) — using the stories built into the code`);
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** For tests. */
export function resetCatalogCache(): void {
  loadedAt = 0;
  loading = null;
  setCatalogStories([]);
}
