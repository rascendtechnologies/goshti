/**
 * Reads the catalogue from Supabase and says which rows would be used and which are refused (and why).
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_KEY=… npx tsx scripts/library/catalog-check.ts
 */
import { catalogRowToStory, checkPersonalTemplate, type CatalogRow } from '../../story-engine/personal';

const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const service = process.env.SUPABASE_SERVICE_KEY ?? '';
if (!base || !service) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}
const res = await fetch(`${base}/rest/v1/personal_stories?select=*&order=id`, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
if (!res.ok) {
  console.error(`Supabase said ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const rows = (await res.json()) as CatalogRow[];
let bad = 0;
for (const row of rows) {
  const parsed = catalogRowToStory(row);
  const state = row.published ? 'PUBLISHED' : 'draft';
  if ('errors' in parsed) {
    bad++;
    console.log(`${String(row.id)} [${state}] REFUSED`);
    for (const e of parsed.errors) console.log(`   ${e}`);
  } else {
    const c = checkPersonalTemplate(parsed.story.template, { quoteSpeakers: parsed.story.quoteSpeakers });
    console.log(`${parsed.story.id} [${state}] ok — ${parsed.story.ageBand} ${parsed.story.category}, ${c.stats.nameSentences} name sentences, ${Math.round(c.stats.personalShare * 100)}% per child`);
    for (const w of c.warnings) console.log(`   warning: ${w}`);
  }
}
console.log(`${rows.length} row(s), ${bad} refused`);
process.exit(bad ? 1 : 0);
