/**
 * Stories written but NOT built into the app: they exist only as drafts until a Marathi reader has
 * checked them. `npm run catalog:push -- --drafts` puts them in the Supabase catalogue (unpublished);
 * publish them there after the review. They are deliberately not part of PERSONAL_STORIES.
 */
import type { PersonalStory } from './stories';
import { PERSONAL_STORIES_2_3 } from './stories23';
import { PERSONAL_STORIES_6_7_B } from './stories67b';
import { PERSONAL_STORIES_8_9_B } from './stories89b';

export const DRAFT_PERSONAL_STORIES: PersonalStory[] = [...PERSONAL_STORIES_2_3, ...PERSONAL_STORIES_6_7_B, ...PERSONAL_STORIES_8_9_B];
