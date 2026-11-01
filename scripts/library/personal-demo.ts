/**
 * Makes one personal story for one child, the way the app will: the parts that never change are
 * recorded once and kept in the public bucket `library-voice` (reused by every later child); only
 * the parts that say the child's name or a boy/girl word are recorded for this child.
 *
 *   STORY_API_URL=… SUPABASE_ANON_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_KEY=… \
 *     npx tsx scripts/library/personal-demo.ts <story-id> <name in Devanagari> <BOY|GIRL> [age]
 *
 * Writes the whole story as one WAV and uploads it so it can be played from a phone. Never prints a key.
 */
import { appendFileSync } from 'node:fs';

import { cleanChildName, findPersonalStory, personalParts, renderTemplate, type ChildGender } from '../../story-engine/personal';

const api = process.env.STORY_API_URL ?? '';
const anon = process.env.SUPABASE_ANON_KEY ?? '';
const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const service = process.env.SUPABASE_SERVICE_KEY ?? '';
if (!api || !anon || !base || !service) {
  console.error('STORY_API_URL, SUPABASE_ANON_KEY, SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}

const [id = '', rawName = '', rawGender = '', rawAge = '6'] = process.argv.slice(2);
const story = findPersonalStory(id);
const name = cleanChildName(rawName);
const gender = rawGender.toUpperCase() as ChildGender;
const age = Number(rawAge);
if (!story) throw new Error(`unknown personal story "${id}"`);
if (!name) throw new Error('the name must be written in Devanagari letters only (for example केतू)');
if (gender !== 'BOY' && gender !== 'GIRL') throw new Error('gender must be BOY or GIRL');
if (!Number.isInteger(age) || age < 2 || age > 9) throw new Error('age must be 2–9');

const variant = age <= 5 ? 'young' : 'older';
const child = { name, gender };

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

async function render(index: number, personal: boolean): Promise<Json> {
  const body: Json = { action: 'personal-render', id: story!.id, age, part: index };
  if (personal) Object.assign(body, { name, gender });
  for (let attempt = 0; ; attempt++) {
    try {
      return await call(body);
    } catch (e) {
      if (attempt >= 1) throw e;
    }
  }
}

async function upload(path: string, bytes: Uint8Array, type: string) {
  const res = await fetch(`${base}/storage/v1/object/library-voice/${path}`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': type, 'x-upsert': 'true' },
    body: bytes as BodyInit,
  });
  if (!res.ok) throw new Error(`upload ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
}

async function download(path: string): Promise<Uint8Array | null> {
  const res = await fetch(`${base}/storage/v1/object/public/library-voice/${path}`);
  return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}

// --- WAV helpers (every part is the same format: 16-bit mono PCM) ----------------------------
interface Pcm {
  rate: number;
  channels: number;
  bits: number;
  data: Uint8Array;
}

function readWav(bytes: Uint8Array): Pcm {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(...bytes.slice(o, o + 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let o = 12;
  let fmt: { rate: number; channels: number; bits: number } | null = null;
  while (o + 8 <= bytes.length) {
    const size = v.getUint32(o + 4, true);
    if (tag(o) === 'fmt ') fmt = { channels: v.getUint16(o + 10, true), rate: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
    if (tag(o) === 'data') {
      if (!fmt) throw new Error('WAV has no format');
      return { ...fmt, data: bytes.slice(o + 8, Math.min(bytes.length, o + 8 + size)) };
    }
    o += 8 + size + (size % 2);
  }
  throw new Error('WAV has no audio');
}

function writeWav(pcm: Pcm): Uint8Array {
  const out = new Uint8Array(44 + pcm.data.length);
  const v = new DataView(out.buffer);
  const put = (o: number, s: string) => [...s].forEach((c, i) => (out[o + i] = c.charCodeAt(0)));
  put(0, 'RIFF');
  v.setUint32(4, 36 + pcm.data.length, true);
  put(8, 'WAVE');
  put(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, pcm.channels, true);
  v.setUint32(24, pcm.rate, true);
  v.setUint32(28, (pcm.rate * pcm.channels * pcm.bits) / 8, true);
  v.setUint16(32, (pcm.channels * pcm.bits) / 8, true);
  v.setUint16(34, pcm.bits, true);
  put(36, 'data');
  v.setUint32(40, pcm.data.length, true);
  out.set(pcm.data, 44);
  return out;
}

async function main() {
  const parts = personalParts(story!, child, age);
  console.log(`"${renderTemplate(story!.title, child)}" for ${name} (${gender}), ${parts.length} parts, ${parts.filter((p) => p.personal).length} made for this child.`);

  const rows = ['| Part | Kind | What happened | Seconds |', '|---|---|---|---|'];
  const pcms: { pcm: Pcm; pauseMs: number }[] = [];
  let reused = 0;
  let madeShared = 0;
  let madePersonal = 0;

  for (const part of parts) {
    let wav: Uint8Array | null = null;
    let what: string;
    let pauseMs = part.chunk.pauseAfterMs;
    if (!part.personal) {
      const path = `personal/${story!.id}/${variant}/shared-${part.index}-${part.hash}.wav`;
      wav = await download(path);
      if (wav) {
        reused++;
        what = 'reused (made earlier)';
      } else {
        const r = await render(part.index, false);
        wav = new Uint8Array(Buffer.from(String(r.base64), 'base64'));
        await upload(path, wav, 'audio/wav');
        madeShared++;
        pauseMs = Number(r.pauseAfterMs) || pauseMs;
        what = 'made now, kept for every child';
      }
    } else {
      const r = await render(part.index, true);
      wav = new Uint8Array(Buffer.from(String(r.base64), 'base64'));
      pauseMs = Number(r.pauseAfterMs) || pauseMs;
      madePersonal++;
      what = `made for ${name}`;
    }
    const pcm = readWav(wav);
    pcms.push({ pcm, pauseMs });
    const text = part.chunk.parts.map((x) => x.text).join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const secs = pcm.data.length / ((pcm.rate * pcm.channels * pcm.bits) / 8);
    rows.push(`| ${part.index} | ${part.personal ? '**for this child**' : 'shared'} | ${what}: ${text.slice(0, 60)} | ${secs.toFixed(1)} |`);
    console.log(`${String(part.index).padStart(2)} ${part.personal ? 'PERSONAL' : 'shared  '} ${what}`);
  }

  const first = pcms[0].pcm;
  for (const { pcm } of pcms) {
    if (pcm.rate !== first.rate || pcm.channels !== first.channels || pcm.bits !== first.bits) throw new Error('parts are not all the same audio format');
  }
  const bytesPerMs = (first.rate * first.channels * first.bits) / 8 / 1000;
  const pieces: Uint8Array[] = [];
  pcms.forEach(({ pcm, pauseMs }, i) => {
    pieces.push(pcm.data);
    if (i < pcms.length - 1) pieces.push(new Uint8Array(Math.round((pauseMs * bytesPerMs) / 2) * 2));
  });
  const total = pieces.reduce((n, p) => n + p.length, 0);
  const all = new Uint8Array(total);
  let at = 0;
  for (const p of pieces) {
    all.set(p, at);
    at += p.length;
  }
  const final = writeWav({ ...first, data: all });
  const seconds = total / (bytesPerMs * 1000);

  const file = `personal-demo/${story!.id}-${variant}-${gender.toLowerCase()}-${Date.now()}.wav`;
  await upload(file, final, 'audio/wav');
  const url = `${base}/storage/v1/object/public/library-voice/${file}`;

  const summary = [
    `## ${renderTemplate(story!.title, child)} — ${name} (${gender === 'GIRL' ? 'girl' : 'boy'}, age ${age})`,
    '',
    `**Listen:** ${url}`,
    '',
    `Whole story: ${seconds.toFixed(0)} s. Made for this child: **${madePersonal}** of ${parts.length} parts. ` +
      `Reused from earlier: **${reused}**. Shared parts made now (first time only): ${madeShared}.`,
    '',
    ...rows,
    '',
  ].join('\n');
  console.log(`\n${summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}

main().catch((e) => {
  console.error(`Failed: ${(e as Error).message}`);
  process.exit(1);
});
