import { useRef, useEffect, useState } from 'react';
import { Animated, View, StyleSheet, AccessibilityInfo } from 'react-native';
import { useLedger } from '../../theme/ledger';

// The ledger switch, visual only: ListRow's `switchValue` makes the whole row
// the accessible switch, so this draws the track and thumb and nothing else.
// On is the accent blue (a selection mark, redesign §2.2); off is the sunk
// grey with a hairline. The thumb is white in both modes, so it always
// contrasts with its own track.
const TRACK_W = 44;
const TRACK_H = 26;
const THUMB = 20;
const PAD = 3;
const TRAVEL = TRACK_W - THUMB - PAD * 2 - 2;

export default function Switch({ value }) {
  const { c } = useLedger();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  // With Reduce motion on, the switch jumps instead of sliding (spec 46).
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => enabled && setReduce(true))
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const to = value ? 1 : 0;
    if (reduce) anim.setValue(to);
    // backgroundColor can't use the native driver.
    else Animated.timing(anim, { toValue: to, duration: 160, useNativeDriver: false }).start();
  }, [value, anim, reduce]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });
  const backgroundColor = anim.interpolate({ inputRange: [0, 1], outputRange: [c.surfaceSunk, c.accent] });
  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: [c.hairline, c.accent] });

  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View style={[styles.track, { backgroundColor, borderColor }]}>
        <Animated.View style={[styles.thumb, { backgroundColor: c.knob, borderColor: c.thumbEdge, transform: [{ translateX }] }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: 1,
    padding: PAD,
    justifyContent: 'center',
  },
  // A faint edge so the white thumb doesn't vanish on the light off-track.
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
