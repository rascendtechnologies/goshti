import { checkPersonalTemplate } from '../../story-engine/personal/check';
import { DRAFT_PERSONAL_STORIES, PERSONAL_STORIES } from '../../story-engine/personal';

let bad = 0;
for (const s of [...PERSONAL_STORIES, ...DRAFT_PERSONAL_STORIES]) {
  const r = checkPersonalTemplate(s.template, { quoteSpeakers: s.quoteSpeakers });
  console.log(`${s.id}: ${r.stats.nameSentences} name sentences, ${Math.round(r.stats.personalShare * 100)}% per-child, ${r.stats.personalParts} recordings`);
  for (const w of r.warnings) console.log(`   warning: ${w}`);
  for (const e of r.errors) console.log(`   ERROR: ${e}`);
  if (r.errors.length) bad++;
}
process.exit(bad ? 1 : 0);
