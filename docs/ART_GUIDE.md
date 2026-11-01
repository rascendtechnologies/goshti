# Artwork guide — आजीची पेटी

The app draws Aaji and her scenes in code. Real artwork can replace any picture, one file at a
time. A slot with no file keeps the built-in drawing, so nothing breaks while artwork is arriving.

## How to add a picture
1. Name the file after the slot (table below), e.g. `scene-night.png`. PNG, JPG or WebP.
2. Put it in `assets/art/`.
3. Run `npm run art` (it checks names and file sizes and updates `src/art/manifest.ts`).
4. Commit and push. On the `delight` branch the new version reaches Expo Go automatically.

Keep each file under about 2.5 MB. Pictures are shown softly faded in; with "reduce motion" on
they appear at once.

## The slots
| File name | Size (px) | What it shows |
|---|---|---|
| `welcome` | 1300 × 1000 | Aaji in her chair telling a story, two children listening |
| `scene-room` | 1300 × 1000 | Aaji in her room by the lamp (mystery / default) |
| `scene-night` | 1300 × 1000 | Aaji under the big tree on a starry night, lantern glowing (bedtime, space, magic) |
| `scene-courtyard` | 1300 × 1000 | Aaji in the courtyard near the tulsi at dusk (animals, adventure, funny, festivals) |
| `peti` | 560 × 400 | Aaji's wooden trunk (peti), lid open, warm glow; transparent background |
| `category-animals` | 600 × 600 | A friendly elephant |
| `category-adventure` | 600 × 600 | A child with a compass on a hill path |
| `category-magic` | 600 × 600 | A glowing lamp or sparkling flower |
| `category-funny` | 600 × 600 | A laughing monkey or a silly crow |
| `category-mystery` | 600 × 600 | A magnifying glass and footprints |
| `category-bedtime` | 600 × 600 | A sleepy moon under a cloud blanket |
| `category-festivals` | 600 × 600 | Diyas and rangoli |
| `category-space` | 600 × 600 | A friendly rocket and stars |

Category pictures sit in a round coloured badge: use a transparent background and keep the subject
centred with some margin. Scene pictures fill a rounded frame (cropped from the centre), so keep
Aaji and the children away from the edges.

## One look for everything (important)
All thirteen must look like the same book. Decide once, then reuse the same description.

Style brief to give an illustrator or an image tool:

> Warm hand-painted children's picture-book illustration, soft gouache and watercolour texture,
> gentle rounded shapes, warm evening lamp light, terracotta, turmeric yellow, leaf green and cream
> palette. Maharashtrian setting. Aaji: a kind grandmother in a nine-yard saree with a small red
> bindi and silver hair in a bun, round glasses, warm smile. Calm and cosy, never scary. No text,
> no logos, no brand characters, no real people.

Rules we keep: original characters only (nothing that copies a known character or book),
children's faces friendly and not realistic, no lettering inside the pictures (the app adds all text).

## Later
Story-specific cover pictures and a few seasonal ones (Ganpati, Diwali) can become more slots. Add
them to `src/art/slots.ts`; the same script picks them up.
