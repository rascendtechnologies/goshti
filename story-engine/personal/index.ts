/**
 * Personal stories: the story is written once, the child's name is filled in, and Aaji's voice is
 * made in PARTS. A part that has no name in it is the same for every child (recorded once and
 * shared); only the few parts that say the child's name or a boy/girl word are recorded per child.
 */
import { libraryAudioScript, type LibraryStory } from '../library';
import { buildTtsChunks, type TtsChunk } from '../tts';
import type { AudioSegment } from '../types';
import { findPersonalStory, PERSONAL_STORIES, type PersonalStory } from './stories';
import { cleanChildName, hasPlaceholder, renderTemplate, type ChildGender, type PersonalChild } from './template';

export { cleanChildName, findPersonalStory, hasPlaceholder, PERSONAL_STORIES, renderTemplate };
export type { ChildGender, PersonalChild, PersonalStory };

/** Two stand-in children, used only to find out which sentences change with the child. */
const REFERENCE: [PersonalChild, PersonalChild] = [
  { name: 'सई', gender: 'GIRL' },
  { name: 'राम', gender: 'BOY' },
];

/** Silence between two parts when the story itself does not ask for a longer one. */
const PART_GAP_MS = 300;

/** A short fingerprint (cyrb53) — works the same in the app, the backend and the tests. */
function fingerprint(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0').slice(0, 10);
}

export interface PersonalPart {
  index: number;
  /** True when this part says the child's name (or a boy/girl word): made per child. */
  personal: boolean;
  chunk: TtsChunk;
  /** Fingerprint of a shared part's words and style — a changed story gets a new recording. */
  hash: string;
}

function asLibraryStory(story: PersonalStory, child: PersonalChild): LibraryStory {
  return {
    id: story.id,
    title: renderTemplate(story.title, child),
    ageBand: story.ageBand,
    category: story.category,
    positiveValue: story.positiveValue,
    voices: story.voices,
    quoteSpeakers: story.quoteSpeakers,
    ambience: story.ambience,
    storyText: renderTemplate(story.template, child),
  };
}

/** One sentence per segment, so a name never drags the sentences around it into a re-recording. */
function splitSentences(segments: AudioSegment[]): AudioSegment[] {
  const out: AudioSegment[] = [];
  for (const seg of segments) {
    if (seg.type !== 'NARRATION' && seg.type !== 'DIALOGUE') {
      out.push(seg);
      continue;
    }
    const sentences = seg.text.match(/[^.!?।]+[.!?।]+["”']?|[^.!?।]+$/g) ?? [seg.text];
    for (const s of sentences) {
      const text = s.trim();
      if (text) out.push({ ...seg, text });
    }
  }
  return out;
}

function scriptSegments(story: PersonalStory, child: PersonalChild, age?: number): AudioSegment[] {
  return splitSentences(libraryAudioScript(asLibraryStory(story, child), age).segments);
}

const isSpoken = (s: AudioSegment): s is Extract<AudioSegment, { type: 'NARRATION' | 'DIALOGUE' }> =>
  s.type === 'NARRATION' || s.type === 'DIALOGUE';

/**
 * The story as voice parts for this child. The list has the same shape (same count, same
 * personal/shared flags) for every child; only the words inside the personal parts differ.
 */
export function personalParts(story: PersonalStory, child: PersonalChild, age?: number, baseStyle?: string): PersonalPart[] {
  const mine = scriptSegments(story, child, age);
  const [a, b] = [scriptSegments(story, REFERENCE[0], age), scriptSegments(story, REFERENCE[1], age)];
  if (a.length !== b.length || a.length !== mine.length) throw new Error(`personal story ${story.id}: sentences change with the name`);

  const personalAt = mine.map((_, i) => isSpoken(a[i]) && isSpoken(b[i]) && a[i].text !== b[i].text);

  // Group into runs: shared sentences together, each run of personal sentences by itself.
  const slices: { personal: boolean; segments: AudioSegment[] }[] = [];
  mine.forEach((seg, i) => {
    const last = slices[slices.length - 1];
    if (isSpoken(seg)) {
      const personal = personalAt[i];
      const hasSpoken = last?.segments.some(isSpoken);
      if (!last || (hasSpoken && last.personal !== personal)) slices.push({ personal, segments: [seg] });
      else last.segments.push(seg);
    } else if (last) last.segments.push(seg);
    else slices.push({ personal: false, segments: [seg] });
  });

  const parts: PersonalPart[] = [];
  for (const slice of slices) {
    let segments = slice.segments;
    let trailingMs = 0;
    while (segments.length && segments[segments.length - 1].type === 'PAUSE') {
      trailingMs += (segments[segments.length - 1] as { durationMs: number }).durationMs;
      segments = segments.slice(0, -1);
    }
    const chunks = buildTtsChunks(
      { version: 2, narrator: 'AAJI', language: 'mr-IN', segments },
      { baseStyle, sentencePauses: age !== undefined && age <= 5 },
    );
    chunks.forEach((chunk, i) => {
      const lastOfSlice = i === chunks.length - 1;
      const withGap = { ...chunk, pauseAfterMs: lastOfSlice ? Math.max(trailingMs, PART_GAP_MS) : Math.max(chunk.pauseAfterMs, PART_GAP_MS) };
      const hash = fingerprint(JSON.stringify([withGap.parts, withGap.pauseAfterMs]));
      parts.push({ index: parts.length, personal: slice.personal, chunk: { ...withGap, index: parts.length }, hash });
    });
  }
  return parts;
}
