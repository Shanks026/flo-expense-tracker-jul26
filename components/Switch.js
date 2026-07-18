import { useRef, useEffect } from 'react';
import { Pressable, Animated, StyleSheet, Platform } from 'react-native';
import { colors as staticColors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// A shadcn-style toggle: brand-lime track when on, neutral track when off, with
// a white thumb that slides between. Drop-in replacement for react-native's
// Switch — same { value, onValueChange, disabled } API — so every call site
// reads identically. Used app-wide instead of the platform switch so the
// control matches FLO's identity (the active theme's accent) on both the
// light setting cards and the dark sheets.
//
// The thumb stays pinned white (static, not the active theme's `colors.surface`,
// which Dark theme inverts to a dark tone) — a switch thumb needs to reliably
// contrast against its OWN track regardless of theme, the same fixed-role
// reasoning Button's pinned label color and Card's dark variant already use.
// The off-track and border DO follow the active theme, since they're meant to
// blend into whatever screen the switch sits on.
const TRACK_W = 46;
const TRACK_H = 27;
const THUMB = 21;
const PAD = 3;
const TRAVEL = TRACK_W - THUMB - PAD * 2;

export default function Switch({ value, onValueChange, disabled = false }) {
  const { colors } = useTheme();
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
      <Animated.View style={[styles.track, { backgroundColor, borderColor: colors.border }]}>
        <Animated.View style={[styles.thumb, !disabled && styles.thumbShadow, { transform: [{ translateX }] }]} />
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
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: staticColors.surface,
  },
  // Split out from `thumb` and applied only when NOT disabled — Android's
  // `elevation` shadow is its own native compositing layer, independent of
  // the parent Pressable's `opacity: 0.45` dimming for the disabled state.
  // The thumb fill fades; the shadow doesn't, leaving a full-strength dark
  // ring around a now-pale thumb — the "inner circle" this was. Simplest
  // reliable fix is to just not cast a shadow on a disabled control at all,
  // rather than fight Android's opacity/elevation compositing.
  //
  // Platform.select, not both sets of props together — iOS ignores
  // `elevation` and Android ignores `shadow*`, but specifying both at once
  // on the same platform can still get partially double-applied (Fabric's
  // own shadow layer plus native elevation), which was the original ring bug.
  thumbShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
});
