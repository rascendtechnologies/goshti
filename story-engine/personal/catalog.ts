/**
 * Turns a row of the Supabase `personal_stories` table into a PersonalStory — or refuses it.
 * A row that does not pass is ignored, never half-used, so a typo in the dashboard cannot break a
 * child's story. The same rules run for the app, the backend and the `catalog:push` script.
 */
import { CATEGORY_IDS } from '../categories';
import type { AgeBand } from '../profiles';
import { VOICE_STYLES, type VoiceStyle } from '../schemas';
import { SFX_IDS, type SfxId } from '../sfx';
import { checkPersonalTemplate } from './check';
import type { PersonalStory } from './stories';

/** A row as Supabase returns it (snake_case). */
export interface CatalogRow {
  id?: unknown;
  title?: unknown;
  age_band?: unknown;
  category?: unknown;
  positive_value?: unknown;
  voices?: unknown;
  quote_speakers?: unknown;
  ambience?: unknown;
  template?: unknown;
  published?: unknown;
}

const AGE_BANDS: readonly string[] = ['2-3', '4-5', '6-7', '8-9'];
const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** The story, or the reasons it was refused. */
export function catalogRowToStory(row: CatalogRow): { story: PersonalStory } | { errors: string[] } {
  const errors: string[] = [];
  const id = typeof row.id === 'string' ? row.id : '';
  if (!/^[a-z0-9-]{3,60}$/.test(id)) errors.push('id must be 3–60 letters, digits or dashes');
  if (!isString(row.title)) errors.push('title is missing');
  if (!isString(row.template)) errors.push('template is missing');
  if (typeof row.age_band !== 'string' || !AGE_BANDS.includes(row.age_band)) errors.push('age_band must be 2-3, 4-5, 6-7 or 8-9');
  if (typeof row.category !== 'string' || !(CATEGORY_IDS as readonly string[]).includes(row.category)) errors.push('unknown category');

  const voices: Record<string, VoiceStyle> = {};
  if (row.voices && typeof row.voices === 'object' && !Array.isArray(row.voices)) {
    for (const [who, style] of Object.entries(row.voices as Record<string, unknown>)) {
      if (typeof style === 'string' && (VOICE_STYLES as readonly string[]).includes(style)) voices[who] = style as VoiceStyle;
      else errors.push(`voice for "${who}" is not one of the allowed voices`);
    }
  } else errors.push('voices must be an object');

  const speakers = Array.isArray(row.quote_speakers) && row.quote_speakers.every((x) => typeof x === 'string') ? (row.quote_speakers as string[]) : null;
  if (!speakers) errors.push('quote_speakers must be a list of names');

  let ambience: SfxId | undefined;
  if (row.ambience != null && row.ambience !== '') {
    if (typeof row.ambience === 'string' && (SFX_IDS as readonly string[]).includes(row.ambience)) ambience = row.ambience as SfxId;
    else errors.push('ambience is not an allowed sound');
  }

  if (typeof row.template === 'string' && speakers) {
    const check = checkPersonalTemplate(row.template, { quoteSpeakers: speakers });
    errors.push(...check.errors);
    for (const who of new Set(speakers)) if (!voices[who]) errors.push(`no voice for the speaker "${who}"`);
  }

  if (errors.length) return { errors };
  return {
    story: {
      id,
      title: row.title as string,
      ageBand: row.age_band as AgeBand,
      category: row.category as PersonalStory['category'],
      positiveValue: typeof row.positive_value === 'string' ? row.positive_value : '',
      voices,
      quoteSpeakers: speakers ?? [],
      ambience,
      template: row.template as string,
    },
  };
}

/** Published, valid rows only. `onRefused` hears about the rest (for logging). */
export function parseCatalogRows(rows: unknown, onRefused?: (id: string, errors: string[]) => void): PersonalStory[] {
  if (!Array.isArray(rows)) return [];
  const out: PersonalStory[] = [];
  const seen = new Set<string>();
  for (const row of rows as CatalogRow[]) {
    if (!row || row.published !== true) continue;
    const parsed = catalogRowToStory(row);
    if ('errors' in parsed) {
      onRefused?.(typeof row.id === 'string' ? row.id : '?', parsed.errors);
    } else if (!seen.has(parsed.story.id)) {
      seen.add(parsed.story.id);
      out.push(parsed.story);
    }
  }
  return out;
}
