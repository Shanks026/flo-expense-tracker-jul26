import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { addMonths, subMonths, format } from 'date-fns';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';

export default function AnalyticsFilterBar({
  mode,
  onModeChange,
  month,
  onMonthChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}) {
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  return (
    <View>
      <View style={styles.segmentWrap}>
        <Pressable style={[styles.segment, mode === 'month' && styles.segmentActive]} onPress={() => onModeChange('month')}>
          <Text style={[styles.segmentText, mode === 'month' && styles.segmentTextActive]}>Month</Text>
        </Pressable>
        <Pressable style={[styles.segment, mode === 'custom' && styles.segmentActive]} onPress={() => onModeChange('custom')}>
          <Text style={[styles.segmentText, mode === 'custom' && styles.segmentTextActive]}>Custom</Text>
        </Pressable>
      </View>

      {mode === 'month' ? (
        <View style={styles.monthSelector}>
          <Pressable onPress={() => onMonthChange(subMonths(month, 1))}>
            <ChevronLeft size={18} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.monthText}>{format(month, 'MMMM yyyy')}</Text>
          <Pressable onPress={() => onMonthChange(addMonths(month, 1))}>
            <ChevronRight size={18} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.customRow}>
          <Pressable style={[styles.dateField, { flex: 1 }]} onPress={() => setShowFromPicker(true)}>
            <Text style={styles.fieldLabel}>From</Text>
            <Text style={styles.fieldValue}>{format(customFrom, 'd MMM yyyy')}</Text>
          </Pressable>
          <Pressable style={[styles.dateField, { flex: 1 }]} onPress={() => setShowToPicker(true)}>
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

const styles = StyleSheet.create({
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
    alignItems: 'center',
    paddingVertical: 9,
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
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  monthText: {
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
