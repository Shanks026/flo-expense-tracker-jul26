import { View, Text, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from './Button';
import OnboardingProgress from './OnboardingProgress';
import { colors, spacing, fontFamily, fontSize } from '../theme/tokens';

// Shared frame for every onboarding step.
//
// Vertical rhythm, after two rounds of getting it wrong: the whole block —
// dots, hero, title, subtitle, body — is a single group that sits VERTICALLY
// CENTRED in the space above the button. Only the button is pinned to the
// bottom.
//   - v1 centred the body alone while the header stayed pinned at the top,
//     which tore each screen into disconnected slabs.
//   - v2 top-aligned everything, which jammed the dots up against the status
//     bar and left all the whitespace pooled at the bottom.
// Centring the group keeps the text where the eye actually lands and the
// spacing even above and below.
//
// `hero` renders ABOVE the title (the design's icon tile on the reminders and
// detect steps sits above the heading, not below the subtitle).
//
// `scrollable` swaps the group into a ScrollView that still centres while the
// content is short (flexGrow + justifyContent) and scrolls once it isn't — for
// the expense step, which overflows with the keyboard up.
export default function OnboardingScaffold({
  stepKey = null,
  hero = null,
  title,
  subtitle,
  scrollable = false,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  children,
}) {
  const group = (
    <>
      {stepKey ? (
        <View style={styles.progress}>
          <OnboardingProgress stepKey={stepKey} />
        </View>
      ) : null}

      {hero ? <View style={styles.hero}>{hero}</View> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.body}>{children}</View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          {scrollable ? (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollGroup}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {group}
            </ScrollView>
          ) : (
            <View style={styles.staticGroup}>{group}</View>
          )}

          <View style={styles.footer}>
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
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  staticGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollGroup: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  progress: {
    marginBottom: spacing.xxl,
  },
  hero: {
    marginBottom: spacing.xl,
    alignItems: 'flex-start',
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
    marginTop: spacing.xxl,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  primary: {
    height: 58,
  },
  secondary: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.muted,
  },
});
