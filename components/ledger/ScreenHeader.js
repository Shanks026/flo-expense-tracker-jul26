import { useRef, useMemo } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import HeaderIconButton from './HeaderIconButton';
import { useLedger, ledgerType, ledgerSpace, ledgerSize } from '../../theme/ledger';

// The screen bar (redesign §2.5): a 40 dp circle back button, up to two
// circle icon actions on the right, and an optional large title that
// collapses into the bar on scroll. It draws the top safe-area inset itself,
// so the route sets `headerShown: false`.
//
// Collapsing title, in three pieces:
//   const { scrollY, onScroll } = useHeaderScroll();
//   <ScreenHeader title="Settings" scrollY={scrollY} />
//   <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}>
//     <LargeTitle title="Settings" scrollY={scrollY} />
// Without `scrollY` the title sits in the bar from the start.
//
// `actions` is [{ icon, onPress, accessibilityLabel, dot? }], at most two.
// `trailing` is a node after them, such as an OverflowMenu (split detail).
// Back goes back, or to Home when the screen was opened by a deep link with
// nothing behind it; `onBack` overrides. `showBack={false}` leaves it out
// (the first onboarding question), keeping the bar's height.

// How far the large title scrolls before the bar's small title has fully
// faded in: the large title's own height.
const LARGE_TITLE_H = 44;

export function useHeaderScroll() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY],
  );
  return { scrollY, onScroll };
}

export default function ScreenHeader({ title, scrollY, actions = [], trailing, onBack, showBack = true }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useLedger();

  const handleBack =
    onBack ??
    (() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    });

  // The small title fades in as the large one leaves; the hairline appears
  // once content is under the bar.
  const titleOpacity = scrollY
    ? scrollY.interpolate({ inputRange: [LARGE_TITLE_H * 0.6, LARGE_TITLE_H], outputRange: [0, 1], extrapolate: 'clamp' })
    : 1;
  const lineOpacity = scrollY ? scrollY.interpolate({ inputRange: [0, LARGE_TITLE_H], outputRange: [0, 1], extrapolate: 'clamp' }) : 0;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top, backgroundColor: c.canvas }]}>
      <View style={styles.bar}>
        {showBack && <HeaderIconButton icon={ChevronLeft} onPress={handleBack} accessibilityLabel="Back" />}
        {/* With a LargeTitle on screen, that one is the header TalkBack reads. */}
        <Animated.View
          style={[styles.titleBox, { opacity: titleOpacity }]}
          pointerEvents="none"
          importantForAccessibility={scrollY ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={!!scrollY}
        >
          {!!title && (
            <Text style={[ledgerType.section, { color: c.ink }]} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          )}
        </Animated.View>
        <View style={styles.actions}>
          {actions.slice(0, 2).map((a) => (
            <HeaderIconButton key={a.accessibilityLabel} icon={a.icon} onPress={a.onPress} accessibilityLabel={a.accessibilityLabel} dot={a.dot} />
          ))}
          {trailing}
        </View>
      </View>
      <Animated.View style={[styles.line, { backgroundColor: c.hairline, opacity: lineOpacity }]} />
    </View>
  );
}

// The large left-aligned title, first thing in the scroll content. It fades
// as it slides under the bar.
export function LargeTitle({ title, scrollY }) {
  const { c } = useLedger();
  const opacity = scrollY
    ? scrollY.interpolate({ inputRange: [0, LARGE_TITLE_H * 0.7], outputRange: [1, 0], extrapolate: 'clamp' })
    : 1;
  return (
    <Animated.View style={[styles.large, { opacity }]}>
      <Text style={[ledgerType.title, styles.largeText, { color: c.ink }]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    zIndex: 1,
  },
  bar: {
    height: ledgerSize.hit + ledgerSpace.sm * 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ledgerSpace.gutter,
    gap: ledgerSpace.md,
  },
  titleBox: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: ledgerSpace.sm,
  },
  line: {
    height: StyleSheet.hairlineWidth,
  },
  large: {
    height: LARGE_TITLE_H,
    justifyContent: 'center',
  },
  largeText: {
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
});
