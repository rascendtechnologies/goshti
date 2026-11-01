import { describe, expect, it } from 'vitest';

import { CATEGORIES } from '../../../story-engine';
import { ART_SLOTS } from '../../art/slots';

describe('art slots', () => {
  it('has a card picture slot for every story category', () => {
    for (const c of CATEGORIES) expect(ART_SLOTS).toHaveProperty(`category-${c.id}`);
  });

  it('has a slot for the welcome picture and each scene', () => {
    for (const s of ['welcome', 'scene-room', 'scene-night', 'scene-courtyard']) expect(ART_SLOTS).toHaveProperty(s);
  });
});
