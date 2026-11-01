import { Image, Pressable, StyleSheet, View } from 'react-native';

import { getArt, type ArtSlot } from '@/art';
import { getCategory } from '@engine/index';
import { colors, radius, shadow, spacing, touch } from '@/theme';
import type { GoshtiStory } from '@/types/models';
import { CATEGORY_TINT, DEFAULT_TINT } from '@/utils/categoryTint';
import { formatMinutes } from '@/utils/format';

import { AppText } from './AppText';

interface Props {
  story: GoshtiStory;
  isFavourite: boolean;
  onPress: () => void;
}

/** One story in Aaji's peti: a small card with its category picture, title and length. */
export function PetiCard({ story, isFavourite, onPress }: Props) {
  const category = getCategory(story.category);
  const art = getArt(`category-${category.id}` as ArtSlot);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${story.title}, ऐका`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.cover, { backgroundColor: CATEGORY_TINT[category.id] ?? DEFAULT_TINT }]}>
        {art ? (
          <Image source={art} style={styles.art} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : (
          <AppText style={styles.emoji}>{category.emoji}</AppText>
        )}
        {isFavourite ? (
          <AppText variant="heading" color={colors.favourite} style={styles.heart}>
            ♥
          </AppText>
        ) : null}
      </View>
      <View style={styles.body}>
        <AppText variant="label" numberOfLines={2}>
          {story.title}
        </AppText>
        <AppText variant="caption" muted>
          {formatMinutes(story.durationSeconds)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: touch.large + 60,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow,
  },
  pressed: { opacity: 0.85 },
  cover: { height: 92, alignItems: 'center', justifyContent: 'center' },
  art: { width: 76, height: 76 },
  emoji: { fontSize: 44, lineHeight: 56 },
  heart: { position: 'absolute', top: spacing.xs, right: spacing.sm },
  body: { padding: spacing.md, gap: 2 },
});
