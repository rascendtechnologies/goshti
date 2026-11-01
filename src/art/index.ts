import type { ImageSourcePropType } from 'react-native';

import { ART_MANIFEST } from './manifest';
import type { ArtSlot } from './slots';

export { ART_SLOTS, type ArtSlot } from './slots';

/** The artwork for a slot, or undefined when none has been added yet (the app then uses its own drawing). */
export function getArt(slot: ArtSlot): ImageSourcePropType | undefined {
  return ART_MANIFEST[slot];
}
