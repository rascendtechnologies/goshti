import { describe, expect, it } from 'vitest';

import { coverageRatio, segmentStory } from '../audio';
import { localStoryChecks } from '../evaluation';
import { greatPeopleFor, LIBRARY, libraryAudioScript, libraryToApproved, pickLibraryStory, type LibraryStory } from '../library';
import { PROFILES } from '../profiles';

describe('story library', () => {
  it.each(LIBRARY.map((s) => [s.id, s] as const))('%s follows the GOSHTI rules', (_id, story) => {
    const profile = Object.values(PROFILES).find((p) => p.ageBand === story.ageBand)!;
    const youngest = profile.ages[0];
    const failures = localStoryChecks({ title: story.title, storyText: story.storyText }, profile, {
      enforceLength: false,
      age: youngest,
      characterNames: Object.keys(story.voices),
    });
    expect(failures).toEqual([]);
  });

  it.each(LIBRARY.map((s) => [s.id, s] as const))('%s has a speaker for every quote', (_id, story) => {
    const quotes = segmentStory(story.storyText).flatMap((p) => p.parts).filter((x) => x.kind === 'quote');
    expect(story.quoteSpeakers.length).toBe(quotes.length);
    for (const name of story.quoteSpeakers) expect(Object.keys(story.voices)).toContain(name);
  });

  it('builds a full audio script for every story', () => {
    for (const story of LIBRARY) {
      const script = libraryAudioScript(story);
      expect(coverageRatio(script, story.storyText)).toBeGreaterThan(0.97);
      expect(libraryToApproved(story, 4).audioScript.segments.length).toBeGreaterThan(5);
    }
  });

  it('has unique ids and covers every age band', () => {
    expect(new Set(LIBRARY.map((s) => s.id)).size).toBe(LIBRARY.length);
    expect(new Set(LIBRARY.map((s) => s.ageBand))).toEqual(new Set(['2-3', '4-5', '6-7', '8-9']));
  });

  it('picks by age and category, avoiding stories already heard', () => {
    expect(pickLibraryStory({ age: 2, category: 'bedtime' }).id).toBe('chiu-good-night');
    expect(pickLibraryStory({ age: 7, category: 'space' }).id).toBe('chanda-broken-moon');
    const s = pickLibraryStory({ age: 3, category: 'bedtime', avoidIds: ['chiu-good-night'] });
    expect(s.ageBand).toBe('2-3');
    expect(s.id).not.toBe('chiu-good-night');
    // When everything nearby has been heard, still returns something.
    expect(pickLibraryStory({ age: 9, avoidIds: LIBRARY.map((x) => x.id) })).toBeDefined();
  });
});

describe('great-people shelf', () => {
  const shelfStory: LibraryStory = {
    ...LIBRARY[0],
    id: 'test-great-person',
    ageBand: '8-9',
    shelf: 'GREAT_PEOPLE',
  };

  it('is empty for children younger than 8, and shows only stories that suit the age', () => {
    LIBRARY.push(shelfStory);
    try {
      expect(greatPeopleFor(6)).toEqual([]);
      expect(greatPeopleFor(8).map((s) => s.id)).toContain('test-great-person');
      expect(greatPeopleFor(9).map((s) => s.id)).toContain('test-great-person');
    } finally {
      LIBRARY.pop();
    }
  });

  it('is never picked at random (Aaji chooses / fallbacks)', () => {
    LIBRARY.push(shelfStory);
    try {
      for (let i = 0; i < 50; i++) {
        expect(pickLibraryStory({ age: 9 }, () => i / 50).id).not.toBe('test-great-person');
      }
    } finally {
      LIBRARY.pop();
    }
  });
});
