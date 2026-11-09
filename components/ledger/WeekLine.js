import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { format, isToday } from 'date-fns';
import { ChevronRight } from 'lucide-react-native';
import AmountText from './AmountText';
import SectionHeader from './SectionHeader';
import { useLedger, ledgerType, ledgerSpace, ledgerSize } from '../../theme/ledger';

// "This week" on Home: a line with a soft area fill under it, in the one
// chart colour (c.chart, a static blue). It replaced the 7 bars (WeekBars),
// which read heavy next to the card. No axis or gridlines; a dotted line
// marks the daily average. Today gets a dot. Tapping a day shows its total in
// the header without navigating; tapping the header opens Insights on Week.
//
// The curve bends between points with horizontal tangents, so it never dips
// below zero or overshoots a peak the way a spline can.
const CHART_H = 96;
// Inset so the end dots and the day labels under them stay inside the gutter.
const PAD_X = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 4;

function buildPaths(values, width) {
  const n = values.length;
  const max = Math.max(1, ...values);
  const innerW = width - PAD_X * 2;
  const innerH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const pts = values.map((v, i) => ({
    x: PAD_X + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW),
    y: PAD_TOP + innerH - (v / max) * innerH,
  }));
  let line = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < n; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const mx = (a.x + b.x) / 2;
    line += ` C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
  }
  const base = CHART_H - PAD_BOTTOM;
  const area = `${line} L${pts[n - 1].x},${base} L${pts[0].x},${base} Z`;
  const avg = values.reduce((s, v) => s + v, 0) / n;
  const avgY = PAD_TOP + innerH - (avg / max) * innerH;
  return { line, area, pts, avgY, hasSpend: avg > 0 };
}

export default function WeekLine({ data, currency, onOpenInsights }) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [selected, setSelected] = useState(null);
  const [width, setWidth] = useState(0);

  const values = data.map((d) => d.expense || 0);
  const total = values.reduce((s, v) => s + v, 0);
  const pick = selected != null ? data[selected] : null;
  const todayIndex = data.findIndex((d) => isToday(d.date));
  const paths = useMemo(() => (width > 0 && values.length ? buildPaths(values, width) : null), [width, values.join(',')]);
  const markIndex = selected ?? todayIndex;

  return (
    <View>
      <Pressable onPress={onOpenInsights} accessibilityRole="button" accessibilityLabel="This week. Open Insights">
        <SectionHeader
          title={pick ? format(pick.date, 'EEEE d MMM') : 'This week'}
          right={
            <View style={styles.totalWrap}>
              <AmountText value={pick ? pick.expense : total} currency={currency} />
              <ChevronRight size={16} color={c.muted} strokeWidth={1.75} />
            </View>
          }
        />
      </Pressable>

      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {paths && (
          <Svg width={width} height={CHART_H}>
            <Defs>
              <LinearGradient id="weekFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.chart} stopOpacity={0.22} />
                <Stop offset="1" stopColor={c.chart} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {paths.hasSpend && (
              <Line
                x1={0}
                x2={width}
                y1={paths.avgY}
                y2={paths.avgY}
                stroke={c.muted}
                strokeOpacity={0.45}
                strokeWidth={1}
                strokeDasharray="2 4"
              />
            )}
            <Path d={paths.area} fill="url(#weekFill)" />
            <Path d={paths.line} fill="none" stroke={c.chart} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            {selected != null && (
              <Line
                x1={paths.pts[selected].x}
                x2={paths.pts[selected].x}
                y1={0}
                y2={CHART_H - PAD_BOTTOM}
                stroke={c.chart}
                strokeOpacity={0.35}
                strokeWidth={1}
              />
            )}
            {markIndex >= 0 && (
              <Circle cx={paths.pts[markIndex].x} cy={paths.pts[markIndex].y} r={4.5} fill={c.chart} stroke={c.canvas} strokeWidth={2} />
            )}
          </Svg>
        )}
        {total === 0 && (
          <View style={styles.emptyWrap} pointerEvents="none">
            <Text style={styles.empty}>No spending logged this week</Text>
          </View>
        )}
        {/* One tap column per day, full chart height (≥ 48 dp targets). */}
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.hitRow}>
            {data.map((d, i) => (
              <Pressable
                key={i}
                style={styles.hit}
                onPress={() => setSelected(selected === i ? null : i)}
                accessibilityRole="button"
                accessibilityLabel={format(d.date, 'EEEE')}
              />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.days}>
        {data.map((d, i) => {
          const strong = i === markIndex;
          return (
            <Text key={i} style={[styles.day, strong && styles.dayStrong]}>
              {format(d.date, 'EEEEE')}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    totalWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    chart: {
      height: CHART_H,
      marginTop: ledgerSpace.sm,
    },
    emptyWrap: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      ...ledgerType.caption,
      color: c.muted,
    },
    hitRow: {
      flex: 1,
      flexDirection: 'row',
    },
    hit: {
      flex: 1,
      minHeight: ledgerSize.hit,
    },
    // Labels sit under each point: the row spans the same inset as the line.
    days: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    day: {
      ...ledgerType.caption,
      fontSize: 12,
      // 20 wide = 2 × PAD_X, so each label is centred on its point.
      width: PAD_X * 2,
      textAlign: 'center',
      color: c.muted,
    },
    dayStrong: {
      color: c.ink,
      fontFamily: ledgerType.rowTitle.fontFamily,
    },
  });
}
