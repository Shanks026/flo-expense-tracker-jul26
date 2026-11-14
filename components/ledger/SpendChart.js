import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { format } from 'date-fns';
import AmountText from './AmountText';
import { useLedger, ledgerType, ledgerSpace } from '../../theme/ledger';
import { spendAxis, axisLabel } from '../../lib/insights';
import { amountParts } from '../../lib/currency';

const PLOT_HEIGHT = 140;
const AXIS_WIDTH = 40;
const LABEL_ROW = 20;
const DOT = 4;

// Insights' spending line (spec 48, ticket 01): one point per day (or per
// week for a custom range longer than a month), a soft olive fill under it,
// y-axis numbers on the left (the person wants the numbers), one faint
// baseline and no gridlines. Under it: day initials for a week, or only the
// first and last day for a month or a custom range.
//
// The whole plot is one tap target: a tap picks the nearest day, marks it
// and shows its total above the chart, without navigating. Tapping it again
// clears it. Nothing animates in.
//
// `points` is [{ date: Date, amount }]; `bucket` is 'day' | 'week'. A
// day still to come has `amount: null`: it keeps its initial and its column
// but gets no line, point or tap (a week in progress).
export default function SpendChart({ points, bucket = 'day', mode = 'month', currency }) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(null);
  // A new period clears the marked day, so an index never lands on another date.
  const periodKey = `${points.length}:${points[0]?.date?.getTime?.() ?? ''}`;
  useEffect(() => setSelected(null), [periodKey]);

  const max = points.reduce((m, p) => Math.max(m, p.amount ?? 0), 0);
  const { ticks, top } = spendAxis(max);
  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const n = points.length;
  // Days so far: future days only ever trail the list.
  const shown = points.filter((p) => p.amount != null).length;
  // Points sit in the middle of equal columns, so the first and last aren't
  // cut by the edge and a tap maps to a column.
  const colWidth = n ? plotWidth / n : 0;
  const x = (i) => colWidth * (i + 0.5);
  const y = (v) => DOT + (PLOT_HEIGHT - 2 * DOT) * (1 - v / top);

  const line = points.slice(0, shown).map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.amount).toFixed(1)}`).join(' ');
  const area = shown > 1 ? `${line} L${x(shown - 1).toFixed(1)},${PLOT_HEIGHT} L${x(0).toFixed(1)},${PLOT_HEIGHT} Z` : '';

  const sel = selected != null && selected < shown ? points[selected] : null;
  const dayText = (p) =>
    bucket === 'week' ? `Week of ${format(p.date, 'd MMM')}` : format(p.date, 'EEE d MMM');

  function handlePress(e) {
    if (!colWidth) return;
    const i = Math.min(n - 1, Math.max(0, Math.floor(e.nativeEvent.locationX / colWidth)));
    if (i >= shown) return;
    setSelected((cur) => (cur === i ? null : i));
  }

  return (
    <View>
      <View style={styles.readout}>
        {sel ? (
          <>
            <Text style={styles.readoutLabel}>{dayText(sel)}</Text>
            <AmountText value={sel.amount} currency={currency} style={styles.readoutAmount} />
          </>
        ) : (
          <Text style={styles.readoutLabel}>{bucket === 'week' ? 'Spent each week' : 'Spent each day'} · tap for a total</Text>
        )}
      </View>

      <View style={styles.body} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {/* The y-axis numbers, top tick at the top. */}
        <View style={styles.axis}>
          {ticks.map((t) => (
            <Text key={t} style={[styles.tick, { top: y(t) - 8 }]} numberOfLines={1}>
              {axisLabel(t, currency)}
            </Text>
          ))}
        </View>

        {plotWidth > 0 && (
          <Pressable
            onPress={handlePress}
            style={{ width: plotWidth, height: PLOT_HEIGHT }}
            accessibilityRole="button"
            accessibilityLabel={sel ? `${dayText(sel)}, ${amountParts(sel.amount, { currency }).text}` : 'Spending chart. Tap a day for its total.'}
          >
            <Svg width={plotWidth} height={PLOT_HEIGHT}>
              <Defs>
                <LinearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={c.accent} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={c.accent} stopOpacity={0.02} />
                </LinearGradient>
              </Defs>
              <Line x1={0} x2={plotWidth} y1={PLOT_HEIGHT - 0.5} y2={PLOT_HEIGHT - 0.5} stroke={c.hairline} strokeWidth={1} />
              {sel && (
                <Line x1={x(selected)} x2={x(selected)} y1={0} y2={PLOT_HEIGHT} stroke={c.hairline} strokeWidth={1} />
              )}
              {!!area && <Path d={area} fill="url(#spendFill)" />}
              {shown > 1 && <Path d={line} stroke={c.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
              {shown === 1 && <Circle cx={x(0)} cy={y(points[0].amount)} r={DOT} fill={c.accent} />}
              {sel && <Circle cx={x(selected)} cy={y(sel.amount)} r={DOT + 1} fill={c.canvas} stroke={c.accent} strokeWidth={2} />}
            </Svg>
          </Pressable>
        )}
      </View>

      <View style={[styles.labels, { marginLeft: AXIS_WIDTH }]}>
        {mode === 'week'
          ? points.map((p, i) => (
              <Text key={i} style={[styles.dayLabel, { width: colWidth }, selected === i && styles.dayLabelOn]}>
                {format(p.date, 'EEEEE')}
              </Text>
            ))
          : n > 0 && (
              <>
                <Text style={styles.edgeLabel}>{format(points[0].date, 'd MMM')}</Text>
                <Text style={styles.edgeLabel}>{format(points[n - 1].date, 'd MMM')}</Text>
              </>
            )}
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    readout: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      minHeight: 20,
      marginBottom: ledgerSpace.sm,
    },
    readoutLabel: {
      ...ledgerType.caption,
      color: c.muted,
    },
    readoutAmount: {
      ...ledgerType.rowTitle,
      color: c.ink,
    },
    body: {
      flexDirection: 'row',
    },
    axis: {
      width: AXIS_WIDTH,
      height: PLOT_HEIGHT,
    },
    tick: {
      position: 'absolute',
      left: 0,
      right: ledgerSpace.xs,
      ...ledgerType.caption,
      fontVariant: ['tabular-nums'],
      color: c.muted,
    },
    labels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      height: LABEL_ROW,
      alignItems: 'flex-end',
    },
    dayLabel: {
      ...ledgerType.caption,
      color: c.muted,
      textAlign: 'center',
    },
    dayLabelOn: {
      color: c.ink,
    },
    edgeLabel: {
      ...ledgerType.caption,
      color: c.muted,
    },
  });
}
