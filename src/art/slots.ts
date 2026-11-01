/**
 * Every place the app can show real artwork. Drop a file named `<slot>.png` (or .jpg/.webp) into
 * assets/art/ and run `npm run art` — the picture replaces the code-drawn one. Slots with no file
 * keep the built-in drawing, so artwork can arrive one picture at a time.
 *
 * Sizes are for 3x phone screens; see docs/ART_GUIDE.md for what each picture should show.
 */
export const ART_SLOTS = {
  /** Aaji with two children listening (Welcome). 1300x1000 (13:10). */
  welcome: { size: '1300x1000', what: 'Aaji in her chair telling a story, two children listening' },
  /** Aaji telling a story in her room / under the night sky / in the courtyard. 1300x1000. */
  'scene-room': { size: '1300x1000', what: "Aaji in her room by the lamp" },
  'scene-night': { size: '1300x1000', what: 'Aaji under the big tree on a starry night, lantern glowing' },
  'scene-courtyard': { size: '1300x1000', what: 'Aaji in the courtyard near the tulsi at dusk' },
  /** Aaji's peti (the box of kept stories), open with a glow. 560x400 (7:5), transparent background. */
  peti: { size: '560x400', what: "Aaji's wooden trunk, lid open, a warm glow" },
  /** One card picture per category (Home). 600x600, square. */
  'category-animals': { size: '600x600', what: 'a friendly elephant' },
  'category-adventure': { size: '600x600', what: 'a child with a compass at a hill path' },
  'category-magic': { size: '600x600', what: 'a glowing lamp / sparkling flower' },
  'category-funny': { size: '600x600', what: 'a laughing monkey or silly crow' },
  'category-mystery': { size: '600x600', what: 'a magnifying glass and footprints' },
  'category-bedtime': { size: '600x600', what: 'a sleepy moon with a small cloud blanket' },
  'category-festivals': { size: '600x600', what: 'diyas and rangoli' },
  'category-space': { size: '600x600', what: 'a friendly rocket and stars' },
} as const;

export type ArtSlot = keyof typeof ART_SLOTS;

export const ART_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;
