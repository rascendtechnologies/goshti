/**
 * Puts a story you have read and approved onto the "महान व्यक्तींच्या गोष्टी" shelf.
 * Runs on YOUR computer after `npm run retell`.
 *
 *   npm run add-retelling -- --id buddha-ghayal-hans --age 8
 *
 * Reads library-drafts/<id>-age<N>.json (made by `npm run retell`) and adds the story to
 * story-engine/library/added.ts. Then run the "Library voice pre-render" workflow so Aaji's
 * voice for it is made once.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { addToLibrary } from '../../backend/libraryWriter';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const id = arg('id');
const age = arg('age') ?? '8';
if (!id) {
  console.error('Usage: npm run add-retelling -- --id <retelling id> [--age 8]');
  process.exit(1);
}
const file = join('library-drafts', `${id}-age${age}.json`);
const draft = JSON.parse(readFileSync(file, 'utf8')) as { status?: string; result?: { status?: string; story?: Record<string, unknown> } };
const story = draft.result?.story;
if (draft.result?.status !== 'APPROVED' || !story) {
  console.error(`${file} is not an approved story. Run: npm run retell -- --id ${id} --age ${age}`);
  process.exit(1);
}
const added = addToLibrary({ story: { ...story, shelf: 'GREAT_PEOPLE' } }, join('story-engine', 'library', 'added.ts'));
if (!added.ok) {
  console.error(`Could not add: ${added.error}`);
  process.exit(1);
}
console.log(`Added "${String(story.title)}" to the great-people shelf as ${added.id}.`);
console.log('Next: commit it, push, then run the "Library voice pre-render" workflow.');
