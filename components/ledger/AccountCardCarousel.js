import { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ChevronDown } from 'lucide-react-native';
import CardThemeSurface from '../CardThemeSurface';
import PageDots from './PageDots';
import { getTheme, cardTextColor, cardTextShadow } from '../../lib/cardThemes';
import { useLedger, ledgerRadius, ledgerSpace } from '../../theme/ledger';
import { inter as fontFamily } from '../../theme/ledger';

// The signature themed account card (redesign §4 Home, item 2): the card's
// art plus the account name and a chevron, nothing else. The balance lives
// on the canvas below (the screen draws it), so any skin, bright or
// seasonal, can use the whole card with no contrast fights.
//
// The swipe is the same gesture as AccountHeroCarousel (every account's card
// laid out side by side; a pan past the threshold settles on the next one
// and switches the active account). Unlike it, there's no "Add another
// account" teaser slide here.
const GAP = 12;
const SWIPE_THRESHOLD = 56;
// The scene art is drawn in a 360×180 space, so a 2:1 card shows all of it.
const CARD_ASPECT = 2;

export default function AccountCardCarousel({ accounts, activeAccountId, onSwitchAccount, onOpenSwitcher, cardTheme, loading }) {
  const { c, modeId } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [viewportWidth, setViewportWidth] = useState(0);

  // Ink is the free default. On the near-black dark canvas its own #101010
  // would vanish, so in dark mode it takes the raised surface plus a hairline.
  const theme =
    cardTheme ??
    (modeId === 'dark'
      ? { ...getTheme('ink'), background: { type: 'solid', color: c.surfaceSunk } }
      : getTheme('ink'));
  const outlined = !cardTheme && modeId === 'dark';
  // Text in a shade of the card's own colour, not plain white or black, with
  // a soft shadow in the same hue so it stands off the art (the person's ask,
  // 2026-11-12). Both come from lib/cardThemes.js.
  const ink = cardTextColor(theme);
  const textShadow = cardTextShadow(theme);

  const slideCount = accounts.length;
  const activeIndex = Math.max(
    accounts.findIndex((a) => a.id === activeAccountId),
    0
  );
  const [visualIndex, setVisualIndex] = useState(activeIndex);
  const cardWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    cardWidth.value = viewportWidth;
    translateX.value = -(visualIndex * (viewportWidth + GAP));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportWidth]);

  // An outside switch (the switcher sheet) slides the row to match.
  useEffect(() => {
    setVisualIndex(activeIndex);
    translateX.value = withTiming(-(activeIndex * (cardWidth.value + GAP)), { duration: 240 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  function handleSlideChange(target) {
    setVisualIndex(target);
    if (accounts[target] && accounts[target].id !== activeAccountId) onSwitchAccount(accounts[target].id);
  }

  const swipe = Gesture.Pan()
    .enabled(slideCount > 1)
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      let dx = e.translationX;
      if ((dx > 0 && visualIndex <= 0) || (dx < 0 && visualIndex >= slideCount - 1)) dx *= 0.35;
      translateX.value = -(visualIndex * (cardWidth.value + GAP)) + dx;
    })
    .onEnd((e) => {
      let target = visualIndex;
      if (e.translationX <= -SWIPE_THRESHOLD && visualIndex < slideCount - 1) target = visualIndex + 1;
      else if (e.translationX >= SWIPE_THRESHOLD && visualIndex > 0) target = visualIndex - 1;
      translateX.value = withTiming(-(target * (cardWidth.value + GAP)), { duration: 220 });
      if (target !== visualIndex) scheduleOnRN(handleSlideChange, target);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  if (loading) {
    return (
      <View>
        <View style={[styles.skeleton, { aspectRatio: CARD_ASPECT }]} />
        <PageDots count={0} index={0} />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.viewport} onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}>
        <GestureDetector gesture={swipe}>
          <ReAnimated.View style={[styles.row, rowStyle]}>
            {accounts.map((account) => (
              <View key={account.id} style={{ width: viewportWidth || undefined, marginRight: GAP }}>
                <Pressable
                  onPress={onOpenSwitcher}
                  accessibilityRole="button"
                  accessibilityLabel={`${account.name}. Switch account`}
                >
                  <CardThemeSurface
                    theme={theme}
                    animate={false}
                    style={[styles.card, { aspectRatio: CARD_ASPECT }, outlined && styles.outlined]}
                  >
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, { color: ink }, textShadow]} numberOfLines={1}>
                        {account.name}
                      </Text>
                      <ChevronDown size={18} color={ink} strokeWidth={2.25} />
                    </View>
                    {/* Optional last four digits (accounts.last4, spec 48
                        ticket 06), to tell which card or bank account this is. */}
                    {!!account.last4 && (
                      <Text style={[styles.last4, { color: ink }, textShadow]} accessibilityLabel={`Ending ${account.last4.split('').join(' ')}`}>
                        •••• {account.last4}
                      </Text>
                    )}
                  </CardThemeSurface>
                </Pressable>
              </View>
            ))}
          </ReAnimated.View>
        </GestureDetector>
      </View>
      <PageDots count={slideCount} index={visualIndex} />
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    viewport: { overflow: 'hidden' },
    row: { flexDirection: 'row' },
    card: {
      borderRadius: ledgerRadius.card,
    },
    outlined: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
    },
    skeleton: {
      borderRadius: ledgerRadius.card,
      backgroundColor: c.surfaceSunk,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: ledgerSpace.gutter,
      paddingTop: 18,
      // Text stays in the left two-thirds (spec 43's skin rule).
      maxWidth: '66%',
    },
    name: {
      fontFamily: fontFamily.semibold,
      fontSize: 16,
      lineHeight: 22,
      flexShrink: 1,
    },
    last4: {
      position: 'absolute',
      left: ledgerSpace.gutter,
      bottom: 16,
      fontFamily: fontFamily.semibold,
      fontSize: 20,
      lineHeight: 26,
      letterSpacing: 2,
      fontVariant: ['tabular-nums'],
    },
  });
}
