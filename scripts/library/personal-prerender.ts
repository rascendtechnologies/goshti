/**
 * Records the SHARED parts (the sentences without a name) of every personal story, for both the
 * younger and the older listener, and keeps them in the public bucket `library-voice`. The app then
 * only downloads them; a child's own parts are the only ones made on demand.
 *
 *   STORY_API_URL=… SUPABASE_ANON_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_KEY=… \
 *     npx tsx scripts/library/personal-prerender.ts [story-id]
 *
 * Parts already stored are skipped, so it is safe to run again after adding a story.
 */
import { appendFileSync } from 'node:fs';

import { allPersonalStories, parseCatalogRows, personalParts, personalVariant, setCatalogStories } from '../../story-engine/personal';

const api = process.env.STORY_API_URL ?? '';
const anon = process.env.SUPABASE_ANON_KEY ?? '';
const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const service = process.env.SUPABASE_SERVICE_KEY ?? '';
if (!api || !anon || !base || !service) {
  console.error('STORY_API_URL, SUPABASE_ANON_KEY, SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}
const only = process.argv[2];

// Catalogue stories (published rows in Supabase) are recorded too, ahead of the built-in ones.
try {
  const res = await fetch(`${base}/rest/v1/personal_stories?published=eq.true&select=*`, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
  if (res.ok) {
    setCatalogStories(parseCatalogRows(await res.json(), (id, errors) => console.warn(`catalogue row "${id}" ignored: ${errors.join('; ')}`)));
  } else console.warn(`catalogue not read (HTTP ${res.status}) — built-in stories only`);
} catch (e) {
  console.warn(`catalogue not read (${(e as Error).message}) — built-in stories only`);
}
const CONCURRENCY = 6;
const REFERENCE = { name: 'सई', gender: 'GIRL' as const };

async function exists(path: string) {
  const res = await fetch(`${base}/storage/v1/object/public/library-voice/${path}`, { method: 'HEAD' });
  return res.ok;
}

async function render(id: string, age: number, part: number, hash: string): Promise<Uint8Array> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
        body: JSON.stringify({ action: 'personal-render', id, age, part, hash }),
        signal: AbortSignal.timeout(170_000),
      });
      const json = (await res.json().catch(() => ({}))) as { base64?: string; reason?: string };
      if (!res.ok || !json.base64) throw new Error(json.reason ?? `HTTP ${res.status}`);
      return new Uint8Array(Buffer.from(json.base64, 'base64'));
    } catch (e) {
      if (attempt >= 1) throw e;
    }
  }
}

async function upload(path: string, bytes: Uint8Array) {
  const res = await fetch(`${base}/storage/v1/object/library-voice/${path}`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'audio/wav', 'x-upsert': 'true' },
    body: bytes as BodyInit,
  });
  if (!res.ok) throw new Error(`upload ${path}: HTTP ${res.status}`);
}

async function main() {
  const jobs: { id: string; age: number; part: number; hash: string; path: string }[] = [];
  for (const story of allPersonalStories().filter((s) => !only || s.id === only)) {
    // One representative age per recorded set: 4 (younger, longer pauses) and 7 (older).
    for (const age of [4, 7]) {
      for (const p of personalParts(story, REFERENCE, age)) {
        if (!p.personal) jobs.push({ id: story.id, age, part: p.index, hash: p.hash, path: `personal/${story.id}/${personalVariant(age)}/shared-${p.index}-${p.hash}.wav` });
      }
    }
  }
  console.log(`${jobs.length} shared parts to check.`);
  let made = 0;
  let kept = 0;
  const failed: string[] = [];
  let next = 0;
  async function work() {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        if (await exists(job.path)) {
          kept++;
          continue;
        }
        await upload(job.path, await render(job.id, job.age, job.part, job.hash));
        made++;
        console.log(`made ${job.path}`);
      } catch (e) {
        failed.push(`${job.path}: ${(e as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, work));
  const summary = `Shared voice parts: ${made} made now, ${kept} already stored, ${failed.length} failed.${failed.length ? '\n\n' + failed.map((f) => `- ${f}`).join('\n') : ''}`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(`Failed: ${(e as Error).message}`);
  process.exit(1);
});
