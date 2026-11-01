import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { config } from '@/config';
import { AppText, BackButton, BigButton, ParentGate, Screen } from '@/components';
import { spacing } from '@/theme';

/** "Tell us about this story" — for parents only (behind the parent check); opens an email. */
export default function ReportScreen() {
  const { title } = useLocalSearchParams<{ title?: string }>();
  const [unlocked, setUnlocked] = useState(false);

  const subject = encodeURIComponent(`Story report: ${title ?? ''}`.trim());
  const body = encodeURIComponent('What was wrong with the story (for example: upsetting, wrong words, not suitable)?\n\n');

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton />
      </View>
      <View style={styles.body}>
        {unlocked ? (
          <>
            <AppText variant="heading" center>
              गोष्टीत काही चुकलं का?
            </AppText>
            <AppText center muted>
              आम्हाला ईमेलने कळवा. आम्ही ती गोष्ट तपासून सुधारू.
            </AppText>
            <BigButton
              label="ईमेल पाठवा"
              onPress={() => void Linking.openURL(`mailto:${config.supportEmail}?subject=${subject}&body=${body}`)}
            />
          </>
        ) : (
          <ParentGate onPass={() => setUnlocked(true)} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  body: { flex: 1, justifyContent: 'center', gap: spacing.lg },
});
