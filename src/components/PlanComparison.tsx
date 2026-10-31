import { StyleSheet, View } from 'react-native';

import { PLANS } from '@/services';
import { colors, radius, shadow, spacing } from '@/theme';
import { toMarathiDigits } from '@/utils/format';

import { AppText } from './AppText';

interface Props {
  currentPlan?: 'FREE' | 'PLUS';
}

const ROWS: { label: string; free: string; plus: string }[] = [
  { label: 'आजीच्या तयार गोष्टी', free: '✓ सगळ्या', plus: '✓ सगळ्या' },
  { label: 'ऐकलेल्या गोष्टी पुन्हा ऐकणं', free: '✓ नेहमी मोफत', plus: '✓ नेहमी मोफत' },
  {
    label: `${'मुलाला हिरो करून'}\nआजीने बनवलेल्या नव्या गोष्टी`,
    free: `${toMarathiDigits(PLANS.FREE.monthlyLimit)} दर महिन्याला`,
    plus: `${toMarathiDigits(PLANS.PLUS.monthlyLimit)} दर महिन्याला`,
  },
  { label: 'आजीचा आवाज आणि गोष्टीचा दर्जा', free: 'सारखाच', plus: 'सारखाच' },
];

/** Parent mode only: what the free plan and GOSHTI Plus each include, side by side. */
export function PlanComparison({ currentPlan }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.labelCol} />
        <Head title="मोफत" current={currentPlan === 'FREE'} />
        <Head title="Plus" current={currentPlan === 'PLUS'} highlight />
      </View>
      {ROWS.map((r) => (
        <View key={r.label} style={[styles.row, styles.divider]}>
          <View style={styles.labelCol}>
            <AppText variant="caption">{r.label}</AppText>
          </View>
          <View style={styles.valueCol}>
            <AppText variant="caption" center>
              {r.free}
            </AppText>
          </View>
          <View style={styles.valueCol}>
            <AppText variant="caption" center color={colors.primary}>
              {r.plus}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

function Head({ title, current, highlight }: { title: string; current: boolean; highlight?: boolean }) {
  return (
    <View style={[styles.valueCol, highlight && styles.plusHead]}>
      <AppText variant="label" center>
        {title}
      </AppText>
      {current ? (
        <AppText variant="caption" center color={colors.leaf}>
          सध्याचा
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  labelCol: { flex: 1.4 },
  valueCol: { flex: 1, alignItems: 'center' },
  plusHead: { borderBottomWidth: 2, borderBottomColor: colors.accent },
});
