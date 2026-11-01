import { Pressable, StyleSheet, View } from 'react-native';

import { SLEEP_TIMER_OPTIONS_MINUTES } from '@/services/sleepTimer';
import { colors, radius, spacing } from '@/theme';
import { toMarathiDigits } from '@/utils/format';

import { AppText } from './AppText';

interface Props {
  secondsLeft: number | null;
  onStart: (minutes: number) => void;
  onCancel: () => void;
}

/** "🌙 झोपेचा टायमर": the story stops by itself after 10, 20 or 30 minutes. */
export function SleepTimerControl({ secondsLeft, onStart, onCancel }: Props) {
  if (secondsLeft !== null) {
    const minutes = Math.max(1, Math.ceil(secondsLeft / 60));
    return (
      <View style={styles.row}>
        <AppText variant="caption" muted>
          🌙 {toMarathiDigits(minutes)} मिनिटांत गोष्ट थांबेल
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="टायमर बंद करा" onPress={onCancel} style={styles.chip}>
          <AppText variant="caption">बंद</AppText>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <AppText variant="caption" muted>
        🌙 झोपेचा टायमर
      </AppText>
      {SLEEP_TIMER_OPTIONS_MINUTES.map((m) => (
        <Pressable
          key={m}
          accessibilityRole="button"
          accessibilityLabel={`${toMarathiDigits(m)} मिनिटांत गोष्ट थांबवा`}
          onPress={() => onStart(m)}
          style={styles.chip}
        >
          <AppText variant="caption">{toMarathiDigits(m)} मि.</AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 44,
    minWidth: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
