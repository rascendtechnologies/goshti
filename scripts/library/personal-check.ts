/**
 * Checks a personal story (name placeholders) before it is added: are the placeholders valid, and
 * how much of the story is re-recorded for every child?
 *
 *   npm run personal:check -- path/to/story.txt          (the STORY: text, or a whole AI reply)
 *   npm run personal:check -- --prompt 4-5               (prints the writing brief for an age band)
 */
import { readFileSync } from 'node:fs';

import { checkPersonalTemplate, LIMITS } from '../../story-engine/personal/check';
import { personalPrompt } from '../../story-engine/personal/prompt';

const args = process.argv.slice(2);
if (args[0] === '--prompt') {
  console.log(personalPrompt(args[1] ?? '4-5'));
  process.exit(0);
}
const file = args[0];
if (!file) {
  console.error('Usage: npm run personal:check -- <file>   or   npm run personal:check -- --prompt 4-5');
  process.exit(1);
}
const raw = readFileSync(file, 'utf8');
// Accept a whole AI reply (TITLE / CHARACTERS / STORY:) or just the story.
const story = raw.includes('STORY:') ? raw.slice(raw.indexOf('STORY:') + 'STORY:'.length).trim() : raw.trim();
const result = checkPersonalTemplate(story);

const pct = Math.round(result.stats.personalShare * 100);
console.log(`${result.stats.sentences} sentences; ${result.stats.nameSentences} use the name, ${result.stats.genderOnlySentences} change only for boy/girl.`);
console.log(`${pct}% of the words are re-recorded for each child (aim under ${LIMITS.warnShare * 100}%), in about ${result.stats.personalParts} separate recordings.\n`);
console.log('Per-child sentences:');
for (const l of result.personalLines) console.log(`  [${l.kind === 'name' ? 'name  ' : 'gender'}] ${l.text}`);
console.log('');
for (const w of result.warnings) console.log(`warning: ${w}`);
for (const e of result.errors) console.log(`ERROR:   ${e}`);
console.log(result.errors.length ? '\nNot ready.' : result.warnings.length ? '\nUsable; the warnings would make it better.' : '\nLooks good.');
process.exit(result.errors.length ? 1 : 0);
