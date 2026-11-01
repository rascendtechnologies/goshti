import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, BackButton, PetiCard, PetiTrunk, Screen } from '@/components';
import { useStories } from '@/hooks/useStories';
import { colors, radius, spacing } from '@/theme';
import { toMarathiDigits } from '@/utils/format';
import { petiStories, type PetiFilter } from '@/utils/peti';

const FILTERS: { id: PetiFilter; label: string }[] = [
  { id: 'ALL', label: 'सगळ्या' },
  { id: 'FAVOURITES', label: '♥ आवडत्या' },
];

/** 7. आजीची पेटी — every story the child has heard, kept safe in Aaji's box. */
export default function MyStoriesScreen() {
  const { stories, favouriteIds, loading } = useStories();
  const [filter, setFilter] = useState<PetiFilter>('ALL');
  const shown = petiStories(stories, favouriteIds, filter);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.titles}>
          <AppText variant="title">आजीची पेटी</AppText>
          {!loading && stories.length > 0 ? (
            <AppText variant="caption" muted>
              {toMarathiDigits(stories.length)} गोष्टी जपून ठेवल्या आहेत
            </AppText>
          ) : null}
        </View>
      </View>

      <PetiTrunk />

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : stories.length === 0 ? (
        <AppText center muted>
          पेटी अजून रिकामी आहे. एखादी गोष्ट ऐका, ती इथे जपून ठेवली जाईल.
        </AppText>
      ) : (
        <>
          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === f.id }}
                onPress={() => setFilter(f.id)}
                style={[styles.chip, filter === f.id && styles.chipOn]}
              >
                <AppText variant="label" color={filter === f.id ? colors.onPrimary : colors.text}>
                  {f.label}
                </AppText>
              </Pressable>
            ))}
          </View>
          {shown.length === 0 ? (
            <AppText center muted>
              अजून कोणतीही आवडती गोष्ट नाही. गोष्टीतलं ♡ दाबून ती इथे ठेवा.
            </AppText>
          ) : (
            <View style={styles.grid}>
              {shown.map((s) => (
                <PetiCard
                  key={s.id}
                  story={s}
                  isFavourite={favouriteIds.has(s.id)}
                  onPress={() => router.push({ pathname: '/story/[id]', params: { id: s.id } })}
                />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titles: { flex: 1 },
  filters: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  chip: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
