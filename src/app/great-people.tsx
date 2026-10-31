import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { greatPeopleFor } from '@engine/index';
import { AppText, BackButton, Screen } from '@/components';
import { childProfileService, storyService } from '@/services';
import { colors, radius, shadow, spacing, touch } from '@/theme';

/** महान व्यक्तींच्या गोष्टी — childhood stories of great Indians, opened on purpose. */
export default function GreatPeopleScreen() {
  const [items, setItems] = useState<{ id: string; title: string }[] | null>(null);
  const [age, setAge] = useState(6);

  useEffect(() => {
    let active = true;
    childProfileService.getProfile().then((p) => {
      const childAge = p?.age ?? 6;
      if (!active) return;
      setAge(childAge);
      setItems(greatPeopleFor(childAge).map((s) => ({ id: s.id, title: s.title })));
    });
    return () => {
      active = false;
    };
  }, []);

  const open = async (libraryId: string) => {
    const story = await storyService.playLibraryStory(libraryId, age as Parameters<typeof storyService.playLibraryStory>[1]);
    if (story) router.push({ pathname: '/story/[id]', params: { id: story.id } });
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <BackButton />
        <AppText variant="title">महान व्यक्तींच्या गोष्टी</AppText>
      </View>
      {items === null ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <View style={styles.list}>
          {items.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`${s.title}, ऐका`}
              onPress={() => open(s.id)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            >
              <AppText variant="label" style={styles.cardText} numberOfLines={2}>
                {s.title}
              </AppText>
              <AppText variant="heading" color={colors.primary}>
                ▶
              </AppText>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  list: { gap: spacing.md },
  card: {
    minHeight: touch.large,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow,
  },
  cardText: { flex: 1 },
});
