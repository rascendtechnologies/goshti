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

WHY THE RULES BELOW MATTER: Aaji's voice for every sentence WITHOUT a placeholder is recorded once and reused for every child. Every sentence WITH a placeholder is recorded again for each child. So fewer placeholder sentences = cheaper and more natural. Aim for under 30% of the story's words in placeholder sentences.

RULES
1. Name only where it matters. Use the name in about 6 sentences at most: the opening, 2–3 key moments, the child's own line that says the name (if the story needs it), and the closing "शुभ रात्री, {नाव}!". Everywhere else write about "the child" without a name or gender: the sound, the place, what the other characters do.
2. Keep gender out of every other sentence. Rewrite so no verb depends on the child's gender: use other characters as the subject ("काजवा हसला"), sounds and things ("दगड दिसू लागले"), passive or neutral wording ("वाट सापडली"), and plurals.
3. The child's OWN spoken lines: use forms that are the same for a boy and a girl. First-person FUTURE and IMPERATIVE are neutral ("मी तुला घरी पोहोचवीन", "चल, आपण जाऊ", "काळजी करू नकोस"). Avoid first-person present with gender ("नेतो/नेते").
4. Dialogue tags: do not attach the child's name or a gendered verb to every quote. Put the child's quotes after a short sentence that already names the child, or let the voice change show who speaks. Never write a tag like "{नाव} {म्हणाला|म्हणाली}" more than twice in the story.
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
