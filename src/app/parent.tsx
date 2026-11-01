import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';

import { BRAND } from '@/brand';
import { config } from '@/config';
import { AgeSelector, AppText, BackButton, BigButton, GenderSelector, ParentGate, PlanComparison, Screen } from '@/components';
import { useChildProfile } from '@/hooks/useChildProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { BillingError, type BillingOffer, deleteAllPersonalData, feedbackService, PLANS, REACTIONS, subscriptionService, uiSoundService, type StoryReaction } from '@/services';
import { colors, radius, spacing } from '@/theme';
import type { Subscription } from '@/types/models';
import { toMarathiDigits } from '@/utils/format';

/** 8. Parent mode — behind a simple parent gate; the only place plans and prices appear. */
export default function ParentScreen() {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return (
      <Screen>
        <View style={styles.header}>
          <BackButton />
        </View>
        <View style={styles.gate}>
          <ParentGate onPass={() => setUnlocked(true)} />
        </View>
      </Screen>
    );
  }
  return <ParentSettings />;
}

function ParentSettings() {
  const { profile, save: saveProfile } = useChildProfile();
  const loadedSubscription = useSubscription();
  // Dev tools below can change the plan/usage; show their result immediately.
  const [devSubscription, setDevSubscription] = useState<Subscription | null>(null);
  const subscription = devSubscription ?? loadedSubscription;
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [appSounds, setAppSounds] = useState(true);
  const [feedback, setFeedback] = useState<Record<StoryReaction, number> | null>(null);
  const [offers, setOffers] = useState<BillingOffer[]>([]);
  const [busy, setBusy] = useState(false);
  const realPurchases = subscriptionService.purchasesAvailable();
  const showPlans = config.showPlans || realPurchases;

  useEffect(() => {
    let active = true;
    uiSoundService.isEnabled().then((on) => active && setAppSounds(on));
    feedbackService.summary().then((s) => active && setFeedback(s));
    subscriptionService.offers().then((o) => active && setOffers(o));
    return () => {
      active = false;
    };
  }, []);

  const toggleSounds = (on: boolean) => {
    setAppSounds(on);
    void uiSoundService.setEnabled(on);
  };

  const priceOf = (period: 'month' | 'year') =>
    offers.find((o) => o.period === period)?.priceLabel ?? PLANS.PLUS.prices[period === 'month' ? 0 : 1].label;

  const refreshPlan = async () => setDevSubscription(await subscriptionService.getSubscription());

  const upgrade = async (period: 'month' | 'year') => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await subscriptionService.purchase(period);
      if (outcome === 'purchased') {
        await refreshPlan();
        setNotice(`${BRAND.plusName} सुरू झालं. धन्यवाद!`);
      }
    } catch (e) {
      setNotice(e instanceof BillingError && realPurchases ? 'खरेदी पूर्ण झाली नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.' : `${BRAND.plusName} लवकरच उपलब्ध होईल.`);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const active = await subscriptionService.restore();
      await refreshPlan();
      setNotice(active ? `${BRAND.plusName} परत मिळालं.` : 'या खात्यावर आधीची खरेदी सापडली नाही.');
    } catch {
      setNotice('खरेदी परत मिळवता आली नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.');
    } finally {
      setBusy(false);
    }
  };

  const manage = async () => {
    const url = (await subscriptionService.manageUrl()) ?? undefined;
    if (url) void Linking.openURL(url);
  };

  const deleteEverything = async () => {
    await deleteAllPersonalData();
    router.replace('/');
  };

  const atLimit = !!subscription && subscription.storiesGeneratedThisMonth >= subscription.monthlyLimit;
  const feedbackTotal = feedback ? Object.values(feedback).reduce((a, b) => a + b, 0) : 0;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <BackButton />
        <View>
          <AppText variant="title">पालकांसाठी</AppText>
          <AppText variant="caption" muted>
            {BRAND.name} · {BRAND.warmName}
          </AppText>
        </View>
      </View>

      {/* Test versions only — never in a store build. For testing limits and plans. */}
      {config.testTools && subscription ? (
        <View style={[styles.card, styles.devCard]}>
          <AppText variant="caption" muted>
            TEST VERSION ONLY (not in the real app)
          </AppText>
          <BigButton
            variant="secondary"
            label="Reset this month's count"
            onPress={async () => setDevSubscription(await subscriptionService.devResetUsage())}
          />
          <BigButton
            variant="secondary"
            label={subscription.plan === 'PLUS' ? 'Switch to FREE (5)' : 'Switch to PLUS (30)'}
            onPress={async () => setDevSubscription(await subscriptionService.devSetPlan(subscription.plan === 'PLUS' ? 'FREE' : 'PLUS'))}
          />
        </View>
      ) : null}

      {profile ? (
        <View style={styles.card}>
          <AppText variant="label">
            {profile.name} · {toMarathiDigits(profile.age)} वर्षं
          </AppText>
          {/* Birthdays happen: change the age here without losing anything. */}
          <AgeSelector
            value={profile.age}
            onChange={(age) => void saveProfile({ name: profile.name, age, gender: profile.gender })}
          />
          {/* The child is the hero of new stories — Marathi needs boy or girl (गेला / गेली). */}
          <AppText variant="caption" muted>
            नव्या गोष्टींमध्ये {profile.name} मुख्य पात्र असतं. योग्य मराठी शब्दांसाठी (गेला / गेली) निवडा:
          </AppText>
          <GenderSelector
            value={profile.gender ?? null}
            onChange={(gender) => void saveProfile({ name: profile.name, age: profile.age, gender })}
          />
          <BigButton variant="secondary" label="नाव / वय बदला" onPress={() => router.push('/setup')} />
        </View>
      ) : null}

      {subscription ? (
        <View style={styles.card}>
          <AppText variant="label">या महिन्यातल्या नव्या गोष्टी</AppText>
          <AppText variant="title" color={colors.primary}>
            {toMarathiDigits(subscription.storiesGeneratedThisMonth)} / {toMarathiDigits(subscription.monthlyLimit)}
          </AppText>
          <AppText variant="caption" muted>
            आधी ऐकलेल्या गोष्टी पुन्हा ऐकणं नेहमी मोफत आहे.
          </AppText>
          {atLimit ? (
            <AppText muted>
              या महिन्याच्या नव्या गोष्टी पूर्ण झाल्या. मुलं आवडत्या गोष्टी पुन्हा ऐकू शकतात; पुढच्या महिन्यात नव्या गोष्टी
              परत मिळतील.{showPlans ? ` अधिक नव्या गोष्टी हव्या असल्यास खाली ${BRAND.plusName} पाहू शकता.` : ''}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.card, styles.row]}>
        <View style={styles.rowText}>
          <AppText variant="label">ॲपमधले छोटे आवाज</AppText>
          <AppText variant="caption" muted>
            निवड, आवडती गोष्ट, गोष्ट संपल्यावरचा हलका आवाज. गोष्टीच्या आवाजावर परिणाम होत नाही.
          </AppText>
        </View>
        <Switch
          value={appSounds}
          onValueChange={toggleSounds}
          trackColor={{ true: colors.leaf, false: colors.border }}
          thumbColor={colors.surface}
          accessibilityLabel="ॲपमधले छोटे आवाज"
        />
      </View>

      {feedback && feedbackTotal > 0 ? (
        <View style={styles.card}>
          <AppText variant="label">मुलांना गोष्टी कशा वाटल्या</AppText>
          <View style={styles.feedbackRow}>
            {REACTIONS.map((r) => (
              <AppText key={r.id}>
                {r.emoji} {toMarathiDigits(feedback[r.id])}
              </AppText>
            ))}
          </View>
        </View>
      ) : null}

      {showPlans ? (
        <>
        <AppText variant="title">{BRAND.plusName}</AppText>
        <PlanComparison currentPlan={subscription?.plan} />
        <AppText variant="caption" muted center>
          दोन्ही प्लॅनमध्ये आजीचा आवाज आणि गोष्टींचा दर्जा सारखाच आहे; {BRAND.plusName} मध्ये फक्त आजीने बनवलेल्या नव्या गोष्टी जास्त मिळतात.
        </AppText>

        {subscription?.plan !== 'PLUS' ? (
          <View style={styles.actions}>
            <BigButton label={`${priceOf('month')} / महिना`} onPress={() => upgrade('month')} disabled={busy} />
            <BigButton variant="secondary" label={`${priceOf('year')} / वर्ष`} onPress={() => upgrade('year')} disabled={busy} />
            {realPurchases ? (
              <AppText variant="caption" muted center>
                सदस्यता आपोआप नूतनीकरण होते. स्टोअरच्या खात्यातून कधीही रद्द करता येते.
              </AppText>
            ) : null}
          </View>
        ) : realPurchases ? (
          <BigButton variant="secondary" label="सदस्यता सांभाळा / रद्द करा" onPress={() => void manage()} />
        ) : null}
        {realPurchases ? <BigButton variant="secondary" label="आधीची खरेदी परत मिळवा" onPress={() => void restore()} disabled={busy} /> : null}
        {notice ? (
          <AppText center muted>
            {notice}
          </AppText>
        ) : null}
        {realPurchases && (config.termsUrl || config.privacyUrl) ? (
          <View style={styles.row}>
            {config.termsUrl ? <BigButton variant="secondary" label="अटी" onPress={() => void Linking.openURL(config.termsUrl)} /> : null}
            {config.privacyUrl ? <BigButton variant="secondary" label="गोपनीयता" onPress={() => void Linking.openURL(config.privacyUrl)} /> : null}
          </View>
        ) : null}
        </>
      ) : null}

      <View style={styles.card}>
        <AppText variant="label">माहिती काढून टाका</AppText>
        <AppText variant="caption" muted>
          मुलाचं नाव, ऐकलेल्या गोष्टी, आवडत्या गोष्टी आणि आजीचे आवाज या फोनवरून कायमचे काढले जातील. ॲप नंतर पुन्हा
          पहिल्यापासून सुरू होईल.
        </AppText>
        {confirmDelete ? (
          <View style={styles.actions}>
            <BigButton label="हो, सगळं काढून टाका" onPress={() => void deleteEverything()} />
            <BigButton variant="secondary" label="नको" onPress={() => setConfirmDelete(false)} />
          </View>
        ) : (
          <BigButton variant="secondary" label="सगळी माहिती काढून टाका" onPress={() => setConfirmDelete(true)} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  gate: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: spacing.xs },
  feedbackRow: { flexDirection: 'row', gap: spacing.lg },
  devCard: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  actions: { gap: spacing.md },
});
