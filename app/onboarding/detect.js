import { useState, useEffect, useCallback } from 'react';
import { View, Text, AppState, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Zap, Check, ShieldCheck } from 'lucide-react-native';
import OnboardingScaffold from '../../components/OnboardingScaffold';
import { colors, radii, spacing, fontFamily, fontSize } from '../../theme/tokens';
import { getNextRoute } from '../../lib/onboarding';
import {
  hasNotificationAccess,
  openNotificationAccessSettings,
  isDetectionEnabled,
  setDetectionEnabled,
  setAllowedPackages,
  DEFAULT_ALLOWED_PACKAGES,
  WATCHED_APP_LABELS,
} from '../../lib/detect';

// The step the design predates entirely (06-transaction-auto-detect.md).
// Notification-listener access can't be prompted for like a normal runtime
// permission — openNotificationAccessSettings() deep-links to a system screen
// and there is NO callback. The only way to learn the outcome is to re-check
// when the app comes back to the foreground, which is exactly what
// app/settings.js does; this mirrors that sequence rather than inventing a
// second enabling path.
//
// This screen is never reachable where it can't work: lib/onboarding.js drops
// the step entirely when isSupported() is false (iOS, Expo Go), and the dots
// renumber around it.
export default function OnboardingDetect() {
  const router = useRouter();
  const [access, setAccess] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const refresh = useCallback(() => {
    setAccess(hasNotificationAccess());
    setEnabled(isDetectionEnabled());
  }, []);

  // Re-check on every foreground, not just mount: leaving for the system
  // settings screen backgrounds the app, it doesn't unmount this route, so
  // mount-only would never see the grant the user just made.
  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const next = getNextRoute('detect');
  const watched = Object.values(WATCHED_APP_LABELS).join(', ');

  function handleGrant() {
    openNotificationAccessSettings();
  }

  function handleEnable() {
    // Allowlist BEFORE enabling — same order as Settings' handleToggleDetect.
    // Enabling first would leave a live listener with no allowlist for the
    // window between the two calls.
    setAllowedPackages(DEFAULT_ALLOWED_PACKAGES);
    setDetectionEnabled(true);
    setEnabled(true);
    router.push(next);
  }

  const granted = access;

  return (
    <OnboardingScaffold
      stepKey="detect"
      title="Log transactions automatically"
      subtitle="FLO can read your bank and UPI alerts, and offer to log them for you."
      primaryLabel={granted ? 'Turn on detection' : 'Grant access'}
      onPrimary={granted ? handleEnable : handleGrant}
      secondaryLabel="Not now"
      onSecondary={() => router.push(next)}
    >
      <View style={styles.hero}>
        <Zap size={30} color={colors.incomeAccent} strokeWidth={2} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardIcon}>
          {granted ? (
            <Check size={21} color={colors.incomeAccent} strokeWidth={2.6} />
          ) : (
            <ShieldCheck size={21} color={colors.incomeAccent} strokeWidth={2} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Notification access</Text>
          <Text style={styles.cardBody}>
            {granted
              ? enabled
                ? 'Granted — detection is on'
                : 'Granted — turn detection on below'
              : 'Android grants this from its own settings screen'}
          </Text>
        </View>
      </View>

      {/* The disclosure. This is the promise FLO makes about what it reads —
          it must be true and it must match Settings, which is why the app list
          comes from the shared WATCHED_APP_LABELS rather than being retyped. */}
      <Text style={styles.disclosure}>
        FLO watches {watched} for debit and credit alerts, so it can prompt you to log them.
        It reads only these apps' notifications — nothing else on your device, and nothing
        leaves your phone unless you save it.
      </Text>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: 66,
    height: 66,
    borderRadius: radii.card,
    backgroundColor: colors.incomeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.iconTile,
    backgroundColor: colors.incomeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  cardBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 2,
  },
  disclosure: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    lineHeight: 19,
    color: colors.muted,
    marginTop: spacing.lg,
  },
});
