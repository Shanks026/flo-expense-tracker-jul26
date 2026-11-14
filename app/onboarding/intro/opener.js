import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Illustration from '../../../components/ledger/Illustration';
import PinnedFooter from '../../../components/ledger/PinnedFooter';
import PageDots from '../../../components/ledger/PageDots';
import { useLedger, ledgerType, ledgerSpace } from '../../../theme/ledger';
import { setIntroSeen } from '../../../lib/onboardingDraft';
import { track } from '../../../lib/track';
import useAnalyticsConsent from '../../../hooks/useAnalyticsConsent';

// The opener (spec 47): the whole pre-auth intro. Three slides, one object
// and one line each, swiped with page dots under them; Create account and
// I have an account stay pinned on every slide. Both set the intro-seen flag,
// so after a sign-out RootNavigator goes straight to sign-in.
//
// No analytics switch (spec 33: the opt-in left the opener; it lives in
// Settings → Data & export). The view is still counted only with consent on.
// Google stays parked (2026-10-27): email sign-up is the primary.
const SLIDES = [
  { key: 'one-place', illustration: 'coins', line: 'Every rupee, in one quiet place' },
  { key: 'quick-add', illustration: 'spark', line: 'Log in 3 taps, or just say it' },
  { key: 'where-it-went', illustration: 'receipt', line: 'See where it went' },
];

export default function Opener() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { consent } = useAnalyticsConsent();
  const [page, setPage] = useState(0);
  // A second tap while the flag saves would replace twice.
  const leaving = useRef(false);

  // Counted once per visit, and only with consent on.
  const viewTracked = useRef(false);
  useEffect(() => {
    if (!consent || viewTracked.current) return;
    viewTracked.current = true;
    track('onboarding_step_viewed', { step: 'opener' });
  }, [consent]);

  function handleScrollEnd(e) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  // `route` is sign-in, or sign-in in sign-up mode.
  async function leaveFor(route) {
    if (leaving.current) return;
    leaving.current = true;
    try {
      await setIntroSeen();
      router.replace(route);
    } finally {
      leaving.current = false;
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.pager}
      >
        {SLIDES.map((slide, i) => (
          <View
            key={slide.key}
            style={[styles.slide, { width }]}
            accessible
            accessibilityLabel={`${slide.line}. Slide ${i + 1} of ${SLIDES.length}`}
          >
            <Illustration name={slide.illustration} size="large" />
            <Text style={styles.line}>{slide.line}</Text>
          </View>
        ))}
      </ScrollView>
      <PageDots count={SLIDES.length} index={page} style={styles.dots} />
      <PinnedFooter
        secondary={{ title: 'I have an account', onPress: () => leaveFor('/sign-in') }}
        primary={{ title: 'Create account', onPress: () => leaveFor('/sign-in?mode=signup') }}
      />
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    pager: {
      flex: 1,
    },
    slide: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: ledgerSpace.gutter * 2,
      gap: ledgerSpace.section,
    },
    line: {
      ...ledgerType.display,
      color: c.ink,
      textAlign: 'center',
      // Two lines held on every slide, so the object doesn't jump between
      // a one-line and a two-line slide.
      minHeight: ledgerType.display.lineHeight * 2,
    },
    dots: {
      marginBottom: ledgerSpace.lg,
    },
  });
}
