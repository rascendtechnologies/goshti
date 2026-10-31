/**
 * Pre-renders Aaji's voice for every library story ONCE and uploads it to the public Supabase
 * bucket `library-voice`, so phones download it instead of each making their own (and paying for it).
 * Two versions per story: "young" (children up to 5 — a slightly different pause pattern) and "older".
 *
 *   STORY_API_URL=… SUPABASE_ANON_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_KEY=… npx tsx scripts/library/prerender.ts [id,id…]
 *
 * Uploads <id>/<variant>/part-N.wav and <id>/<variant>/manifest.json (written last, so a phone never
 * sees a half-finished set). Every part already went through the server's listening check.
 * Never prints a key.
 */
import { appendFileSync } from 'node:fs';

import { LIBRARY } from '../../story-engine/library';

const api = process.env.STORY_API_URL ?? '';
const anon = process.env.SUPABASE_ANON_KEY ?? '';
const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const service = process.env.SUPABASE_SERVICE_KEY ?? '';
if (!api || !anon || !base || !service) {
  console.error('STORY_API_URL, SUPABASE_ANON_KEY, SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}
const only = (process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean);
const VARIANTS = [
  { name: 'young', age: 4 },
  { name: 'older', age: 7 },
];

type Json = Record<string, any>;

async function call(body: Json): Promise<Json> {
  const res = await fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(170_000),
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new Error(String(json.reason || ((json.errors as string[]) || []).join('; ') || `HTTP ${res.status}`));
  return json;
}

async function upload(path: string, bytes: Uint8Array | string, type: string) {
  const res = await fetch(`${base}/storage/v1/object/library-voice/${path}`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': type, 'x-upsert': 'true' },
    body: bytes as BodyInit,
  });
  if (!res.ok) throw new Error(`upload ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
}

let failed = 0;
const lines = ['| Story | Version | Parts | Seconds | Result |', '|---|---|---|---|---|'];
for (const story of LIBRARY) {
  if (only.length && !only.includes(story.id)) continue;
  for (const v of VARIANTS) {
    const label = `${story.id}/${v.name}`;
    try {
      const ticket = await call({ action: 'library-voice', id: story.id, age: v.age });
      if (!ticket.ttsAvailable) throw new Error('voice is not configured on the server');
      const parts: { file: string; pauseAfterMs: number; bytes: number }[] = [];
      let seconds = 0;
      for (let i = 0; i < ticket.audioChunks; i++) {
        let part: Json | undefined;
        for (let attempt = 0; attempt < 2 && !part; attempt++) {
          try {
            part = await call({ action: 'tts-render', audioToken: ticket.audioToken, chunk: i });
          } catch (e) {
            if (attempt === 1) throw e;
          }
        }
        const bytes = Buffer.from(String(part!.base64), 'base64');
        await upload(`${story.id}/${v.name}/part-${i}.wav`, bytes, 'audio/wav');
        parts.push({ file: `part-${i}.wav`, pauseAfterMs: Number(part!.pauseAfterMs) || 0, bytes: bytes.length });
        seconds += Math.max(0, (bytes.length - 44) / 48000);
      }
      const manifest = { v: 1, id: story.id, variant: v.name, chunks: parts, madeAt: new Date().toISOString() };
      await upload(`${story.id}/${v.name}/manifest.json`, JSON.stringify(manifest), 'application/json');
      console.log(`✓ ${label}: ${parts.length} parts, ${seconds.toFixed(0)} s`);
      lines.push(`| ${story.title} | ${v.name} | ${parts.length} | ${seconds.toFixed(0)} | ✓ |`);
    } catch (e) {
      failed++;
      const msg = (e as Error).message;
      console.log(`✗ ${label}: ${msg}`);
      lines.push(`| ${story.title} | ${v.name} | – | – | ✗ ${msg} |`);
    }
  }
}
console.log('\n' + lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
process.exit(failed ? 1 : 0);
