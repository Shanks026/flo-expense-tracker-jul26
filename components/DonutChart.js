import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fontFamily, fontSize, spacing } from '../theme/tokens';

const SIZE = 160;
const STROKE_WIDTH = 22;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatAmount(n) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export default function DonutChart({ segments, total }) {
  let cumulative = 0;

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={colors.chipBg} strokeWidth={STROKE_WIDTH} fill="none" />
        {segments.map((seg, index) => {
          const segLength = (seg.pct / 100) * CIRCUMFERENCE;
          const dashOffset = -cumulative;
          cumulative += segLength;
          return (
            <Circle
              key={index}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={seg.color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${segLength} ${CIRCUMFERENCE}`}
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
            {formatAmount(total)}
          </Text>
          <Text style={styles.centerCaption}>Total</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: fontSize.lg,
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
