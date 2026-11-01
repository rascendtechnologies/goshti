/**
 * Placeholders for stories that star the listening child without asking an AI to write them again.
 *
 *   {नाव}        the child's name, as it is          →  सई, राम
 *   {नाव+ला}     the name with a Marathi ending       →  सईला, रामाला   (names ending in a consonant
 *                                                          take "ा" first: राम → रामा-ला)
 *   {गेला|गेली}  boy form | girl form                 →  picked by the child's gender
 *
 * Everything else in the story is fixed text, so the voice for it can be recorded once and shared.
 */
export type ChildGender = 'BOY' | 'GIRL';

export interface PersonalChild {
  name: string;
  gender: ChildGender;
}

/** Devanagari letters only (no digits, no punctuation, no English) — 1 to 15 characters. */
const NAME = /^[ऄ-हक़-ॡ][ऄ-ह़-्क़-ॡ]{0,14}$/u;

export function cleanChildName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').trim();
  return NAME.test(name) ? name : null;
}

/** Marathi nouns that end in a consonant sound take "ा" before an ending: राम → रामाला. */
const ENDS_IN_CONSONANT = /[क-हक़-य़]$/u;

export function withEnding(name: string, ending: string): string {
  return ENDS_IN_CONSONANT.test(name) ? `${name}ा${ending}` : `${name}${ending}`;
}

const TOKEN = /\{([^{}]+)\}/g;
const ENDING = /^[ऀ-ॿ]{1,6}$/u;

/** Fills in the name and the boy/girl words. Throws on a placeholder it does not understand. */
export function renderTemplate(template: string, child: PersonalChild): string {
  return template.replace(TOKEN, (_all, inner: string) => {
    if (inner.includes('|')) {
      const [boy, girl, ...rest] = inner.split('|');
      if (!boy || !girl || rest.length) throw new Error(`bad gender placeholder {${inner}}`);
      return child.gender === 'GIRL' ? girl : boy;
    }
    if (inner === 'नाव') return child.name;
    if (inner.startsWith('नाव+')) {
      const ending = inner.slice('नाव+'.length);
      if (!ENDING.test(ending)) throw new Error(`bad name ending {${inner}}`);
      return withEnding(child.name, ending);
    }
    throw new Error(`unknown placeholder {${inner}}`);
  });
}

/** True when the text still has a placeholder (it must never reach the voice like that). */
export function hasPlaceholder(text: string): boolean {
  return /[{}]/.test(text);
}
