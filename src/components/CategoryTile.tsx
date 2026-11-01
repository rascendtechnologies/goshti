import { useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';

import { getArt, type ArtSlot } from '@/art';
import type { CategoryInfo } from '@engine/index';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { colors, radius, shadow, spacing, touch } from '@/theme';

import { AppText } from './AppText';

interface Props {
  category: CategoryInfo;
  selected: boolean;
  onPress: () => void;
}

/** A soft wash behind each category's picture, so the grid feels like a shelf of little cards. */
const TINT: Record<string, string> = {
  animals: '#F8E4C4',
  adventure: '#E6EBCB',
  magic: '#EBDDF2',
  funny: '#FBE0B8',
  mystery: '#DCE6EE',
  bedtime: '#DDE0F2',
  festivals: '#F9D9C2',
  space: '#D8DEF0',
};

export function CategoryTile({ category, selected, onPress }: Props) {
  const art = getArt(`category-${category.id}` as ArtSlot);
  const reduce = useReduceMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const press = (to: number) => {
    if (reduce) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };

  return (
    <Animated.View style={[styles.cell, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={category.label}
        onPress={onPress}
        onPressIn={() => press(0.96)}
        onPressOut={() => press(1)}
        style={[styles.tile, selected && styles.selected]}
      >
        <View style={[styles.badge, { backgroundColor: TINT[category.id] ?? colors.surfaceWarm }]}>
          {art ? (
            <Image source={art} style={styles.art} resizeMode="contain" accessibilityIgnoresInvertColors />
          ) : (
            <AppText style={styles.emoji}>{category.emoji}</AppText>
          )}
        </View>
        <AppText variant="label" center>
          {category.label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cell: { flexBasis: '47%', flexGrow: 1 },
  tile: {
    minHeight: touch.large + 32,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.surfaceWarm },
  badge: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  art: { width: 68, height: 68 },
  emoji: { fontSize: 40, lineHeight: 52 },
});
