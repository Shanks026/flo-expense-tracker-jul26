import { View, Image, StyleSheet } from 'react-native';
import { colors, radii } from '../theme/tokens';

// Hero-slot artwork for the opener's Koban (assets/mascot/).
// Renders the real illustration where one exists; else a gray rounded
// placeholder so a screen without art still reads as "art goes here" ahead of
// spec 37's Koban component.
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
