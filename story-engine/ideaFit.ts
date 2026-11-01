/**
 * Did the story keep the child's own idea? A child who asks for "हत्ती आणि मुंगीची दोस्ती" must get an
 * elephant and an ant, not a story about the moon because the category was "space". The words of
 * the idea are Marathi and change their endings (हत्ती, हत्तीला, हत्तीची), so a word counts as kept
 * when the story contains its first letters.
 */
const STOP = new Set(['आणि', 'एक', 'एका', 'एक', 'ची', 'चा', 'चे', 'ला', 'ने', 'मध्ये', 'गोष्ट', 'सांगा', 'सांग', 'हवी', 'पाहिजे', 'आहे', 'आहेत', 'ऐकायची']);
const STEM = 3;

/** The words of the idea worth keeping an eye on: 4+ letters, not filler. */
export function ideaKeywords(idea: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of idea.normalize('NFC').split(/[\s,.;:!?()"'“”‘’।\-–—/]+/u)) {
    const word = raw.trim();
    if (word.length < 4 || STOP.has(word)) continue;
    const stem = Array.from(word).slice(0, Math.max(STEM, Math.ceil(Array.from(word).length * 0.6))).join('');
    if (!seen.has(stem)) {
      seen.add(stem);
      out.push(word);
    }
  }
  return out;
}

/** Problems to fix when the story ignored the idea (empty = fine, or not enough to judge). */
export function ideaChecks(idea: string | null | undefined, storyText: string): string[] {
  const words = ideaKeywords(idea ?? '');
  if (words.length === 0) return [];
  const text = storyText.normalize('NFC');
  const missing = words.filter((w) => {
    const chars = Array.from(w);
    return !text.includes(chars.slice(0, Math.max(STEM, Math.ceil(chars.length * 0.6))).join(''));
  });
  // Allow one word to go missing (a filler word, or one the story put another way).
  if (missing.length > Math.floor(words.length / 3)) {
    return [`the story must be about the child's idea — its main characters and situation are missing or replaced (not found: ${missing.join(', ')}). Keep the idea whole; the category is only the flavour`];
  }
  return [];
}
