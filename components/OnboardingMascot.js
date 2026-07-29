import { View, Image, StyleSheet } from 'react-native';
import { colors, radii } from '../theme/tokens';

// Shared hero-slot artwork for the intro's Koban screens (assets/mascot/).
// Renders the real illustration where one exists; else a gray rounded
// placeholder so every intro screen already reads as "art goes here" ahead of
// the remaining mascot drops (same idea as TourScreen's icon+"Preview"
// fallback for the tour cards, just without the icon — these screens don't
// have a per-question icon to fall back to).
//
// `alignSelf: 'stretch'` overrides OnboardingScreen's hero box (which
// shrink-wraps to content via `alignItems: 'flex-start'`), so this always
// centres against the full screen width regardless of which screen uses it.
export default function OnboardingMascot({ image, size = 140, style }) {
  return (
    <View style={[styles.wrap, style]}>
      {image ? (
        <Image source={image} style={{ width: size, height: size }} resizeMode="contain" />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  placeholder: {
    borderRadius: radii.cardLg,
    backgroundColor: colors.chipBg,
  },
});
