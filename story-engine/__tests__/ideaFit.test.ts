import { describe, expect, it } from 'vitest';

import { ideaChecks, ideaKeywords } from '../ideaFit';

describe('idea fit', () => {
  it('finds the words that matter in a child’s idea', () => {
    expect(ideaKeywords('हत्ती आणि मुंगीची दोस्ती')).toEqual(['हत्ती', 'मुंगीची', 'दोस्ती']);
  });

  it('accepts a story that keeps the idea, whatever the word endings', () => {
    const story = 'एक होता हत्ती. त्याला एक मुंगी भेटली. हत्तीला मुंगीशी दोस्ती करायची होती.';
    expect(ideaChecks('हत्ती आणि मुंगीची दोस्ती', story)).toEqual([]);
  });

  it('rejects a story where the idea’s characters are missing', () => {
    const story = 'चांदोबा आकाशात चमकत होता. चंदेरी पाहुणा आला आणि सगळे तारे हसले.';
    expect(ideaChecks('हत्ती आणि मुंगीची दोस्ती', story)).toHaveLength(1);
  });

  it('does not judge when the idea is too short to tell', () => {
    expect(ideaChecks('मजा', 'काहीही')).toEqual([]);
    expect(ideaChecks(null, 'काहीही')).toEqual([]);
  });
});

describe('plan keeps the idea', () => {
  it('asks for a second plan when the first drops the child’s idea', async () => {
    const { generateStory } = await import('../pipeline');
    const { fakeProvider, storyOfWords, samplePlan } = await import('./fixtures');
    const story = storyOfWords(520);
    const { provider } = fakeProvider({ story });
    const feedbacks: (string[] | undefined)[] = [];
    const original = provider.createPlan.bind(provider);
    provider.createPlan = async (input) => {
      feedbacks.push(input.feedback);
      return input.feedback ? { ...samplePlan, workingTitle: 'हत्ती आणि मुंगी' } : original(input);
    };
    await generateStory({ age: 6, category: 'adventure', mode: 'CUSTOM', userIdea: 'हत्ती आणि मुंगीची दोस्ती' }, provider);
    expect(feedbacks).toHaveLength(2);
    expect(feedbacks[0]).toBeUndefined();
    expect(feedbacks[1]?.[0]).toContain('idea');
  });
});
