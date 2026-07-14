import { useRef, useEffect } from 'react';
import { Pressable, Animated, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';

// A shadcn-style toggle: brand-lime track when on, neutral track when off, with
// a white thumb that slides between. Drop-in replacement for react-native's
// Switch — same { value, onValueChange, disabled } API — so every call site
// reads identically. Used app-wide instead of the platform switch so the
// control matches FLO's identity (lime = the app's colour) on both the light
// setting cards and the dark sheets.
const TRACK_W = 46;
const TRACK_H = 27;
const THUMB = 21;
const PAD = 3;
const TRAVEL = TRACK_W - THUMB - PAD * 2;

export default function Switch({ value, onValueChange, disabled = false }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    // Not the native driver: we animate backgroundColor (a JS-only prop), and
    // native/non-native drivers can't be mixed on the same Animated.Value.
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.chipBg, colors.brand],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      hitSlop={8}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <Animated.View style={[styles.track, { backgroundColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: PAD,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
