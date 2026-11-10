import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '../ledger/ScreenHeader';
import ProgressBar from '../ledger/ProgressBar';
import PinnedFooter from '../ledger/PinnedFooter';
import { useLedger, ledgerType, ledgerSpace } from '../../theme/ledger';
import { setupProgress, SETUP_QUESTIONS } from '../../lib/setupPlan';
import { nextStep } from '../../lib/onboarding';
import { trackStepViewed } from '../../lib/track';
import { FLAGS } from '../../lib/flags';
import useAndroidKeyboardHeight from '../../hooks/useAndroidKeyboardHeight';

// The layout all four set-up questions share (spec 47): the header (Back from
// question 2 on), a thin progress bar with "N of 4", a left-aligned question,
// the answer, and Skip for now / Next pinned at the bottom.
//
// `onNext` writes the step's answer and resolves to true when it saved; the
// shell then moves on. A failed write is the screen's to report (a toast), and
// the shell stays put. Skip writes nothing and moves on.
export default function SetupQuestion({ stepKey, title, note, footerNote, nextDisabled = false, onNext, children }) {
  const { c } = useLedger();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const keyboardHeight = useAndroidKeyboardHeight();
  const progress = setupProgress(stepKey, { themes: FLAGS.themes });

  useEffect(() => {
    trackStepViewed(stepKey);
  }, [stepKey]);

  // Push to another question so Back returns here; replace into the first
  // expense, which has no Back.
  function goNext() {
    const next = nextStep(stepKey);
    if (!next) return;
    if (SETUP_QUESTIONS.includes(next.key)) router.push(next.route);
    else router.replace(next.route);
  }

  async function handleNext() {
    if (saving) return;
    setSaving(true);
    let saved = false;
    try {
      saved = await onNext();
    } finally {
      setSaving(false);
    }
    if (saved) goNext();
  }

  return (
    // Android 16 is edge-to-edge, so the window doesn't resize for the
    // keyboard; pad by its height so the footer rides on top of it.
    <View style={[styles.root, { backgroundColor: c.canvas, paddingBottom: keyboardHeight }]}>
      <ScreenHeader showBack={SETUP_QUESTIONS.indexOf(stepKey) > 0} />
      {progress && (
        <View style={styles.progress}>
          <ProgressBar value={progress.value} plain accessibilityLabel={`Set-up, step ${progress.label}`} style={styles.bar} />
          <Text style={[ledgerType.caption, { color: c.muted }]}>{progress.label}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[ledgerType.title, styles.title, { color: c.ink }]} accessibilityRole="header">
          {title}
        </Text>
        {!!note && <Text style={[ledgerType.body, styles.note, { color: c.muted }]}>{note}</Text>}
        {children}
      </ScrollView>
      {!!footerNote && <Text style={[ledgerType.caption, styles.footerNote, { color: c.muted }]}>{footerNote}</Text>}
      <PinnedFooter
        keyboardUp={keyboardHeight > 0 || undefined}
        secondary={{ title: 'Skip for now', onPress: goNext, disabled: saving }}
        primary={{ title: 'Next', onPress: handleNext, loading: saving, disabled: nextDisabled }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ledgerSpace.md,
    paddingHorizontal: ledgerSpace.gutter,
    paddingTop: ledgerSpace.xs,
  },
  bar: {
    flex: 1,
    width: undefined,
  },
  content: {
    paddingHorizontal: ledgerSpace.gutter,
    paddingTop: ledgerSpace.section,
    paddingBottom: ledgerSpace.section,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  note: {
    marginTop: ledgerSpace.sm,
  },
  footerNote: {
    textAlign: 'center',
    paddingHorizontal: ledgerSpace.gutter,
    paddingTop: ledgerSpace.sm,
  },
});
