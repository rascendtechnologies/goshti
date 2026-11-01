import { hasPlaceholder, renderTemplate } from './template';

export interface PersonalCheck {
  errors: string[];
  warnings: string[];
  stats: {
    sentences: number;
    /** Sentences with a name placeholder. */
    nameSentences: number;
    /** Sentences that only change for boy/girl. */
    genderOnlySentences: number;
    /** Share of the story's words that sit in per-child sentences (0–1). */
    personalShare: number;
    /** Separate per-child recordings the story needs. */
    personalParts: number;
  };
  /** The per-child sentences, for a quick read of what could be rewritten. */
  personalLines: { kind: 'name' | 'gender'; text: string }[];
}

/** Most of the story's words that may sit in per-child sentences. */
export const LIMITS = { warnShare: 0.3, errorShare: 0.45, warnNameSentences: 8, errorNameSentences: 12, longPersonalWords: 22 } as const;

const SENTENCE = /[^.!?।]+[.!?।]+["”']?|[^.!?।]+$/g;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Measures a personal story template and says what to fix. Heuristic: a human still reads it. */
export function checkPersonalTemplate(template: string, meta: { quoteSpeakers?: string[] } = {}): PersonalCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Placeholders must all be understood, for both genders.
  for (const gender of ['BOY', 'GIRL'] as const) {
    try {
      const out = renderTemplate(template, { name: 'सई', gender });
      if (hasPlaceholder(out)) errors.push('a "{" or "}" is left over after filling in the placeholders');
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  const sentences = template.split(/\n{2,}/).flatMap((p) => p.replace(/\n/g, ' ').match(SENTENCE) ?? []).map((s) => s.trim()).filter(Boolean);
  const personalLines: PersonalCheck['personalLines'] = [];
  let personalWords = 0;
  let totalWords = 0;
  let nameSentences = 0;
  let genderOnly = 0;
  let runs = 0;
  let inRun = false;
  for (const s of sentences) {
    const w = words(s);
    totalWords += w;
    const hasName = /\{नाव/.test(s);
    const hasGender = /\{[^{}|]*\|[^{}]*\}/.test(s);
    const personal = hasName || hasGender;
    if (personal) {
      personalWords += w;
      if (hasName) nameSentences++;
      else genderOnly++;
      personalLines.push({ kind: hasName ? 'name' : 'gender', text: s });
      if (!inRun) runs++;
      if (w > LIMITS.longPersonalWords) warnings.push(`long sentence with a placeholder (${w} words) — shorten it so only a few words are re-recorded: "${s.slice(0, 50)}…"`);
    }
    if (!personal && /(तिने|तिला|तिचा|तिची|तिचे|तिच्या|त्याने|त्याला|त्याचा|त्याची|त्याचे|त्याच्या)(?![^\s]*\{)/.test(s) && !/काजव|ससा|हत्ती|प्राणी/.test(s)) {
      warnings.push(`shared sentence uses a he/she word — make sure it is not about the child: "${s.slice(0, 50)}"`);
    }
    inRun = personal;
  }

  const personalShare = totalWords ? personalWords / totalWords : 0;
  if (nameSentences === 0) errors.push('the name is never used — the child is not the hero');
  if (personalShare > LIMITS.errorShare) errors.push(`${Math.round(personalShare * 100)}% of the words are in per-child sentences (limit ${LIMITS.errorShare * 100}%) — too little is shared`);
  else if (personalShare > LIMITS.warnShare) warnings.push(`${Math.round(personalShare * 100)}% of the words are in per-child sentences — aim for under ${LIMITS.warnShare * 100}%`);
  if (nameSentences > LIMITS.errorNameSentences) errors.push(`the name is used in ${nameSentences} sentences (limit ${LIMITS.errorNameSentences})`);
  else if (nameSentences > LIMITS.warnNameSentences) warnings.push(`the name is used in ${nameSentences} sentences — about ${LIMITS.warnNameSentences} or fewer reads better and shares more`);
  if (genderOnly > 4) warnings.push(`${genderOnly} sentences change only for boy/girl — rewrite them gender-neutral so they can be shared`);

  const quotes = (template.match(/"[^"]+"/g) ?? []).length;
  if (meta.quoteSpeakers && meta.quoteSpeakers.length !== quotes) errors.push(`${quotes} quoted lines but ${meta.quoteSpeakers.length} speakers listed`);

  return {
    errors,
    warnings,
    stats: { sentences: sentences.length, nameSentences, genderOnlySentences: genderOnly, personalShare, personalParts: runs },
    personalLines,
  };
}
