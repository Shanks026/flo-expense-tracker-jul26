import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { fontFamily, fontSize, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { formatMoney } from '../lib/currency';

const SIZE = 160;
const STROKE_WIDTH = 22;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// A small flat-cut gap between segments (butt caps, not rounded) — simple,
// exact arc-length arithmetic with no custom path geometry. Centered within
// each segment's nominal slot: half comes off the drawn length, half shifts
// the start forward, so segments stay proportionally sized and correctly
// positioned relative to their neighbors.
const SEGMENT_GAP = 3;

function formatAmount(n, currency) {
  return formatMoney(n, currency);
}

export default function DonutChart({ segments, total, currency = 'INR' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  let cumulative = 0;

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={colors.chipBg} strokeWidth={STROKE_WIDTH} fill="none" />
        {segments.map((seg, index) => {
          const segLength = (seg.pct / 100) * CIRCUMFERENCE;
          const gap = segments.length > 1 ? SEGMENT_GAP : 0;
          const renderedLength = Math.max(segLength - gap, 0);
          const dashOffset = -(cumulative + gap / 2);
          cumulative += segLength;
          return (
            <Circle
              key={index}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={seg.color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${renderedLength} ${CIRCUMFERENCE}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              fill="none"
              rotation={-90}
              originX={SIZE / 2}
              originY={SIZE / 2}
            />
          );
        })}
      </Svg>
      {total !== undefined && (
        <View style={styles.centerLabel} pointerEvents="none">
          <Text style={styles.centerAmount} numberOfLines={1} adjustsFontSizeToFit>
            {formatAmount(total, currency)}
          </Text>
          <Text style={styles.centerCaption}>Total</Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  centerAmount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.heading,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  centerCaption: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    marginTop: 2,
  },
  });
}
