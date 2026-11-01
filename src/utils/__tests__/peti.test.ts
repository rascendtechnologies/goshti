import { describe, expect, it } from 'vitest';

import type { GoshtiStory } from '../../types/models';
import { petiStories } from '../peti';

const story = (id: string, createdAt: string) => ({ id, createdAt }) as GoshtiStory;

describe('petiStories', () => {
  const stories = [story('a', '2026-10-01T10:00:00Z'), story('b', '2026-10-03T10:00:00Z'), story('c', '2026-10-02T10:00:00Z')];

  it('lists newest first without changing the original list', () => {
    expect(petiStories(stories, new Set(), 'ALL').map((s) => s.id)).toEqual(['b', 'c', 'a']);
    expect(stories.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps only favourites when asked', () => {
    expect(petiStories(stories, new Set(['a', 'c']), 'FAVOURITES').map((s) => s.id)).toEqual(['c', 'a']);
    expect(petiStories(stories, new Set(), 'FAVOURITES')).toEqual([]);
  });
});
