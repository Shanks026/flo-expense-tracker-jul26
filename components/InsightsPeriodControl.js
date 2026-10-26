import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronLeft, ChevronRight, Crown } from 'lucide-react-native';
import { addMonths, subMonths, addWeeks, subWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isAfter, format } from 'date-fns';
import { fontFamily, fontSize, spacing, radii, hitTarget } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

const MODES = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'custom', label: 'Custom' },
];

// Weeks run Monday to Sunday, as budgets and the weekly recap do.
export const WEEK_OPTIONS = { weekStartsOn: 1 };

// The selected period's bounds for a mode and its anchor date (any day inside
// the week or month) or a custom range.
export function periodBounds(mode, anchor, customFrom, customTo) {
  if (mode === 'week') return { from: startOfWeek(anchor, WEEK_OPTIONS), to: endOfWeek(anchor, WEEK_OPTIONS) };
  if (mode === 'month') return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  return { from: customFrom, to: customTo };
}

// Insights' one period control (38-home-insights-more.md): Week / Month /
// Custom, then arrows through weeks or months, or From/To for a custom range.
// `customLocked` shows a crown on Custom; the parent decides what a tap does.
export default function InsightsPeriodControl({
  mode,
  onModeChange,
  anchor,
  onAnchorChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  customLocked = false,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const { from, to } = periodBounds(mode, anchor, customFrom, customTo);
  const step = mode === 'week' ? { back: subWeeks, forward: addWeeks } : { back: subMonths, forward: addMonths };
  // No stepping into a period that hasn't started.
  const canGoForward = !isAfter(step.forward(from, 1), new Date());
  const label = mode === 'week' ? `${format(from, 'd MMM')} – ${format(to, 'd MMM')}` : format(anchor, 'MMMM yyyy');

  return (
    <View>
      <View style={styles.segmentWrap} accessibilityRole="tablist">
        {MODES.map((m) => {
          const active = mode === m.key;
          return (
            <Pressable
              key={m.key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => onModeChange(m.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              {m.key === 'custom' && customLocked && (
                <Crown size={11} color={active ? colors.surface : colors.muted} strokeWidth={2.4} />
              )}
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode !== 'custom' ? (
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepButton}
            onPress={() => onAnchorChange(step.back(anchor, 1))}
            accessibilityRole="button"
            accessibilityLabel={mode === 'week' ? 'Previous week' : 'Previous month'}
          >
            <ChevronLeft size={18} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.stepperText}>{label}</Text>
          <Pressable
            style={styles.stepButton}
            onPress={() => onAnchorChange(step.forward(anchor, 1))}
            disabled={!canGoForward}
            accessibilityRole="button"
            accessibilityLabel={mode === 'week' ? 'Next week' : 'Next month'}
            accessibilityState={{ disabled: !canGoForward }}
          >
            <ChevronRight size={18} color={canGoForward ? colors.ink : colors.mutedLight} strokeWidth={2.4} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.customRow}>
          <Pressable style={[styles.dateField, { flex: 1 }]} onPress={() => setShowFromPicker(true)} accessibilityRole="button">
            <Text style={styles.fieldLabel}>From</Text>
            <Text style={styles.fieldValue}>{format(customFrom, 'd MMM yyyy')}</Text>
          </Pressable>
          <Pressable style={[styles.dateField, { flex: 1 }]} onPress={() => setShowToPicker(true)} accessibilityRole="button">
            <Text style={styles.fieldLabel}>To</Text>
            <Text style={styles.fieldValue}>{format(customTo, 'd MMM yyyy')}</Text>
          </Pressable>
        </View>
      )}

      {showFromPicker && (
        <DateTimePicker
          value={customFrom}
          mode="date"
          display="default"
          maximumDate={customTo}
          onChange={(_event, selected) => {
            setShowFromPicker(false);
            if (selected) onCustomFromChange(selected);
          }}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={customTo}
          mode="date"
          display="default"
          minimumDate={customFrom}
          maximumDate={new Date()}
          onChange={(_event, selected) => {
            setShowToPicker(false);
            if (selected) onCustomToChange(selected);
          }}
        />
      )}
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    segmentWrap: {
      flexDirection: 'row',
      backgroundColor: colors.chipBg,
      borderRadius: 14,
      padding: 4,
      marginBottom: spacing.md,
      width: '100%',
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: 40,
      paddingHorizontal: spacing.lg,
      borderRadius: 11,
    },
    segmentActive: {
      backgroundColor: colors.ink,
    },
    segmentText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.base,
      color: colors.muted,
    },
    segmentTextActive: {
      fontFamily: fontFamily.extrabold,
      color: colors.surface,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      alignSelf: 'flex-start',
    },
    stepButton: {
      width: hitTarget,
      height: hitTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.base,
      color: colors.ink,
    },
    customRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    dateField: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: spacing.md,
      paddingVertical: 11,
    },
    fieldLabel: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
    },
    fieldValue: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: colors.ink,
      marginTop: 1,
    },
  });
}
