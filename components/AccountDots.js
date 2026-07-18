import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, interpolateColor } from 'react-native-reanimated';
import { colors as staticColors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// Page-position chrome for the swipeable hero card — NOT an account-identity
// cue (that's the color bar + name above it, which carries each account's
// own color). These dots are deliberately neutral/brand-only so they read
// as "position in a list", not a second, competing color signal.
//
// Keyed off `count`/`activeIndex` rather than the account list directly —
// AccountHeroCarousel's single-account "Add another account" teaser slide
// is a real, swipeable position with no backing account object, so the
// dots need to be able to represent it too.
//
// Windowed to at most 5 dots so someone with 10+ accounts still gets a
// compact, glanceable indicator: beyond 5 slides, the window follows the
// active one (centered where the two true ends allow) and its outer two
// slots render a touch smaller — the same "there's more past this edge"
// language iOS's own Page Control uses for overflow, rather than trying to
// represent every slide's exact position at once.
export default function AccountDots({ count, activeIndex }) {
  const { colors } = useTheme();

  if (count <= 1) return null;

  const windowed = count > 5;
  const windowStart = windowed ? Math.min(Math.max(activeIndex - 2, 0), count - 5) : 0;
  const visibleCount = windowed ? 5 : count;

  return (
    <View style={styles.row}>
      {Array.from({ length: visibleCount }, (_, i) => {
        const slideIndex = windowStart + i;
        return (
          <Dot
            key={slideIndex}
            active={slideIndex === activeIndex}
            edge={windowed && (i === 0 || i === visibleCount - 1)}
            brand={colors.brand}
          />
        );
      })}
    </View>
  );
}

function Dot({ active, edge, brand }) {
  const p = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    p.value = withTiming(active ? 1 : 0, { duration: 220 });
  }, [active, p]);

  const style = useAnimatedStyle(() => {
    const size = interpolate(p.value, [0, 1], [edge ? 4 : 5, 7]);
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: interpolateColor(p.value, [0, 1], [staticColors.mutedMid, brand]),
    };
  });

  return <Animated.View style={style} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});
