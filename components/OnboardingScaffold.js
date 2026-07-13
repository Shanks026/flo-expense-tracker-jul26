import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from './Button';
import OnboardingProgress from './OnboardingProgress';
import { colors, spacing, fontFamily, fontSize } from '../theme/tokens';

// Shared frame for every onboarding step: dots, title, subtitle, a flexible
// body, and a primary button pinned to the bottom with an optional muted
// secondary line beneath it. Every screen in the flow is this shape, so it
// lives here once rather than being re-laid-out five times.
//
// Pass stepKey={null} to hide the dot row (Welcome and the done screen).
export default function OnboardingScaffold({
  stepKey = null,
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  children,
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.progress}>
          <OnboardingProgress stepKey={stepKey} />
        </View>

        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <View style={styles.body}>{children}</View>

        <Button
          title={primaryLabel}
          onPress={onPrimary}
          disabled={primaryDisabled}
          loading={primaryLoading}
          style={styles.primary}
        />

        {secondaryLabel ? (
          <Pressable style={styles.secondary} onPress={onSecondary} disabled={primaryLoading}>
            <Text style={styles.secondaryText}>{secondaryLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.secondarySpacer} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },
  progress: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.hero,
    letterSpacing: -0.5,
    lineHeight: 36,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    lineHeight: 21,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  primary: {
    height: 58,
  },
  secondary: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.muted,
  },
  secondarySpacer: {
    height: spacing.xxl,
  },
});
