/**
 * The writing brief for PERSONAL stories (name filled in per child, voice shared — see index.ts).
 * Paste it into any writing AI together with the story idea; then check the result with
 * `npm run personal:check -- <file>` before it goes anywhere near a child.
 */
export const PERSONAL_STORY_PROMPT = `You are writing ONE original Marathi bedtime/audio story for GOSHTI (आजीची पेटी), told by Aaji to a child aged {AGE_BAND}. The listening child is the hero. The child's name and boy/girl are NOT known yet, so use placeholders.

PLACEHOLDERS (use exactly these):
- {नाव}            the child's name
- {नाव+ला}         the name with an ending: {नाव+ला}, {नाव+ने}, {नाव+चा}, {नाव+ची}, {नाव+चे}, {नाव+च्या}, {नाव+साठी}, {नाव+सोबत}, {नाव+कडे}
- {गेला|गेली}      boy form | girl form (any word whose form depends on the child's gender)

WHY THE RULES BELOW MATTER: Aaji's voice for every sentence WITHOUT a placeholder is recorded once and reused for every child. Every sentence WITH a placeholder is recorded again for each child. So fewer placeholder sentences = cheaper and more natural. Aim for under 30% of the story's words in placeholder sentences (short sentences keep it low).

RULES
1. The child's NAME is the heart of the story: use it whenever the child does something (about 8–12 sentences), but keep every one of those sentences short and on its own. Never call the child "बाळ" or "the child" in the narration.
2. Make the child's actions gender-free with the ने-form. In the past tense, a verb that takes an object agrees with the OBJECT, not the doer, so it is identical for boy and girl: "{नाव+ने} दार उघडलं", "{नाव+ने} विचारलं", "{नाव+ने} हसून सांगितलं", "{नाव+ने} टाळ्या वाजवल्या". Prefer these. Also gender-free: "आजी आणि {नाव} बसले होते", "{नाव+ला} मजा आली", "{नाव+चे} डोळे जड झाले".
2b. When the subject is "आजी आणि {नाव}" together, intransitive verbs are fine ("बसले", "गेले"), but a verb with an object needs "दोघांनी" / the ने-form: "आजीने आणि {नाव+ने} टाटा केला", "आजी आणि {नाव} दोघांनी आरती म्हटली" — never "आजी आणि {नाव} टाटा केला".
3. Avoid verbs of the child that would change for a girl (गेला/गेली, आला/आली, हसला/हसली, पळाला/पळाली — these do NOT take ने). If you truly need one, write it as a short placeholder sentence: "{नाव} {आला|आली}." Use at most 3 in the story. Everything else (other characters, things, sounds, places) never needs the child's gender.
4. The child's OWN spoken lines: use forms that are the same for a boy and a girl: first-person future and imperative ("मी तुला घरी पोहोचवीन", "चल, आपण जाऊ"). Avoid first-person present with gender ("नेतो/नेते"). Dialogue tags use the ने-form: "…", {नाव+ने} म्हटलं.
5. Put every name-or-gender sentence on its own: short (under 15 words), one idea, so it can be recorded alone. Do not hide the name inside a long sentence of other content.
6. Every placeholder sentence must still make sense and read warmly; the sentences around it must work for any child.
7. Marathi: natural, simple spoken Marathi for the age. No Hindi words. No joined consonants in character names for ages 2–5. Short sentences, repetition, sound words (टप टप, लुकलुक).
8. Story: one gentle problem, the child solves it kindly, a quiet ending. Never frightening, never anyone shamed or hurt. Original — no known characters, no copied plots. Everything that is spoken is in "straight double quotes". End calm.
9. Length: {LENGTH}.

OUTPUT (nothing else):
TITLE: <title, may use {नाव}>
CHARACTERS: <each speaking character and the voice it needs: SMALL_CHILD, OLDER_CHILD, SQUEAKY, GENTLE_GIANT, WISE_OLD, PLAYFUL or GRUFF_KIND; the child is "बाळ">
STORY:
<the story, paragraphs separated by a blank line>`;

/** Age-band wording for the brief. */
export const PERSONAL_LENGTH: Record<string, string> = {
  '2-3': 'about 120–180 words',
  '4-5': 'about 200–320 words',
  '6-7': 'about 350–550 words',
  '8-9': 'about 500–800 words',
};

export function personalPrompt(ageBand: string): string {
  return PERSONAL_STORY_PROMPT.replace('{AGE_BAND}', ageBand).replace('{LENGTH}', PERSONAL_LENGTH[ageBand] ?? PERSONAL_LENGTH['4-5']);
}
