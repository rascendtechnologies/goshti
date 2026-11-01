/**
 * Puts personal stories into the Supabase catalogue (table personal_stories).
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_KEY=… npx tsx scripts/library/catalog-push.ts [--publish] [--file rows.json] [story-id …]
 *
 * With no --file it copies the stories built into the code (all, or the ids you name); with --drafts it
 * copies the not-yet-reviewed stories in story-engine/personal/drafts.ts instead. Rows are
 * saved as DRAFTS unless you pass --publish. Every row is checked first; a row that fails is not sent.
 * Voices for a new or changed story must be pre-rendered (Actions → "Pre-render personal story voices")
 * BEFORE it is published, otherwise the first listeners wait for the shared parts.
 */
import { readFileSync } from 'node:fs';

import { catalogRowToStory, DRAFT_PERSONAL_STORIES, PERSONAL_STORIES, type CatalogRow } from '../../story-engine/personal';

const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const service = process.env.SUPABASE_SERVICE_KEY ?? '';
if (!base || !service) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}

const args = process.argv.slice(2);
const publish = args.includes('--publish');
const drafts = args.includes('--drafts');
const fileAt = args.indexOf('--file');
const file = fileAt >= 0 ? args[fileAt + 1] : '';
const ids = args.filter((a, i) => !a.startsWith('--') && !(fileAt >= 0 && i === fileAt + 1));

const rows: CatalogRow[] = file
  ? (JSON.parse(readFileSync(file, 'utf8')) as CatalogRow[])
  : (drafts ? DRAFT_PERSONAL_STORIES : PERSONAL_STORIES).filter((s) => !ids.length || ids.includes(s.id)).map((s) => ({
      id: s.id,
      title: s.title,
      age_band: s.ageBand,
      category: s.category,
      positive_value: s.positiveValue,
      voices: s.voices,
      quote_speakers: s.quoteSpeakers,
      ambience: s.ambience ?? null,
      template: s.template,
    }));

async function main() {
  const good: CatalogRow[] = [];
  for (const row of rows) {
    const parsed = catalogRowToStory(row);
    if ('errors' in parsed) {
      console.error(`SKIPPED ${String(row.id)}: ${parsed.errors.join('; ')}`);
    } else {
      good.push({ ...row, published: publish });
    }
  }
  if (!good.length) {
    console.error('nothing to send');
    process.exit(1);
  }

  const res = await fetch(`${base}/rest/v1/personal_stories?on_conflict=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: service,
      Authorization: `Bearer ${service}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(good),
  });
  if (!res.ok) {
    console.error(`Supabase said ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  console.log(`${good.length} story(ies) saved as ${publish ? 'PUBLISHED' : 'drafts'}: ${good.map((r) => String(r.id)).join(', ')}`);
}

main().catch((e) => {
  console.error(`Failed: ${(e as Error).message}`);
  process.exit(1);
});
