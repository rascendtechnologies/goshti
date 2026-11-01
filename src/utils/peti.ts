import type { GoshtiStory } from '@/types/models';

export type PetiFilter = 'ALL' | 'FAVOURITES';

/** The stories to show in Aaji's peti: newest first; optionally only the favourites. */
export function petiStories(stories: GoshtiStory[], favouriteIds: ReadonlySet<string>, filter: PetiFilter): GoshtiStory[] {
  const list = filter === 'FAVOURITES' ? stories.filter((s) => favouriteIds.has(s.id)) : [...stories];
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
