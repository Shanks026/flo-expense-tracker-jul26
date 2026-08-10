import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// 4 intervals → 5 gridlines/labels (0 at the baseline through max at the top).
export const AXIS_INTERVALS = 4;
// How much horizontal room the axis RESERVES from the plot — not a hard cap on
// label width. Each label is absolutely positioned by its `right` edge with no
// `left`, so it sizes to its own text and simply overflows leftward into the
// card's padding when it needs more than this (a 4-character "100k" runs
// ~26px, wider than the 20px nominally left after the gutter). That overflow is
// what lets this stay tight instead of being sized for the worst-case label.
//
// So: DON'T add `left: 0` or `overflow: 'hidden'` to `axis`/`label` below —
// either one turns that harmless bleed into truncated numbers, and only on the
// large-value ranges that are least likely to be caught while developing.
export const AXIS_WIDTH = 28;

// Step sizes the axis is allowed to land on, as a multiple of the step's own
// power of ten. Deliberately finer than the classic 1/2/2.5/5/10 set: that one
// rounds a 240 peak all the way up to 400, leaving the tallest bar at 60% of
// the chart height. These keep every label round while holding worst-case fill
// at ~78%.
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

// Rounds the axis ceiling up so the labels land on readable numbers (200, 500,
// 2.5k) instead of whatever the tallest bar happens to be (₹1,847). Bars must
// then be scaled against THIS value, not the raw max, or they'd no longer line
// up with the gridlines drawn at these steps.
export function niceAxisMax(rawMax, intervals = AXIS_INTERVALS) {
  if (!rawMax || rawMax <= 0) return intervals;
  const rawStep = rawMax / intervals;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const niceNormalized = NICE_STEPS.find((step) => normalized <= step) ?? 10;
  return niceNormalized * magnitude * intervals;
}

// Bare compact numbers, no currency symbol — the axis is a scale, and both
// charts already spell out real amounts (totals row / peak line) beside it.
export function formatAxisValue(n) {
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (n >= 1_000) return `${trim(n / 1_000)}k`;
  return trim(n);
}

function trim(n) {
  return Number(n.toFixed(1)).toString();
}

// A dashed rule drawn as a row of clipped segments rather than
// `borderStyle: 'dashed'`, which renders inconsistently across platforms on a
// single-sided border. The segment count is just "more than could ever fit";
// overflow hides the remainder, so this needs no width measurement.
function DashedLine({ color }) {
  return (
    <View style={dashStyles.line}>
      {Array.from({ length: 80 }, (_, i) => (
        <View key={i} style={[dashStyles.dash, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

// Absolutely-positioned gridlines sitting behind a chart's bars. `height` is
// the bar track's full height; `top` offsets it to wherever that track starts
// inside the plot area. `inset` pulls both ends in by that many px — for a
// chart whose bars are a fixed width centred in flexible columns, so the rules
// still begin and end exactly on the bar block rather than the plot edges.
export function ChartGridlines({ height, top = 0, inset = 0, intervals = AXIS_INTERVALS }) {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={[gridStyles.wrap, { top, height, left: inset, right: inset }]}>
      {Array.from({ length: intervals + 1 }, (_, i) => (
        <View key={i} style={[gridStyles.row, { top: (i / intervals) * height }]}>
          <DashedLine color={colors.border} />
        </View>
      ))}
    </View>
  );
}

// The left-hand label column. Labels are anchored by their vertical centre to
// each gridline, so the top one reads against the max line and the bottom one
// against the baseline.
export default function ChartAxis({ max, height, top = 0, intervals = AXIS_INTERVALS }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.axis, { height: height + top }]}>
      {Array.from({ length: intervals + 1 }, (_, i) => {
        const value = max - (i / intervals) * max;
        return (
          <Text key={i} style={[styles.label, { top: top + (i / intervals) * height - 7 }]} numberOfLines={1}>
            {formatAxisValue(value)}
          </Text>
        );
      })}
    </View>
  );
}

const dashStyles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dash: {
    width: 3,
    height: 1,
    marginRight: 4,
  },
});

const gridStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});

function makeStyles(colors) {
  return StyleSheet.create({
    axis: {
      width: AXIS_WIDTH,
      flexShrink: 0,
    },
    label: {
      position: 'absolute',
      right: 8,
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      lineHeight: 14,
      color: colors.mutedLight,
      textAlign: 'right',
    },
  });
}
