import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Check, X, Crown } from 'lucide-react-native';
import { format, startOfWeek, isBefore } from 'date-fns';
import Button from './Button';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { reportPeriodPresets, matchPeriodPreset, formatPeriodLabel } from '../lib/reports';
import useEntitlement from '../hooks/useEntitlement';
import { useProUpsellSheet } from './ProUpsellSheet';

// The period switcher that makes every report a custom report. A centred
// dialog (RN's Modal, transparent + fade — the same shape app/settings.js
// already uses for its delete-account confirmation), not a bottom sheet: the
// trigger lives at the TOP of the report screen, and a bottom sheet biases
// its content toward the bottom of the screen — awkward for a control anchored
// at the top, and risks some options landing outside a short snap point. Not
// an inline-expanding panel either — that pushed the cards below it up and
// down every time it opened, which read as broken layout.
export default function ReportPeriodPicker({ open, value, onClose, onChange }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { isPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [customTo, setCustomTo] = useState(() => new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const options = reportPeriodPresets(new Date());
  const activePreset = matchPeriodPreset(value, options);
  const isCustomActive = value && !activePreset;

  function handleClose() {
    setCustomOpen(false);
    onClose();
  }

  function handleCustomToggle() {
    if (!isPro) {
      handleClose();
      openProUpsell('Full reports are a Pro feature');
      return;
    }
    setCustomOpen((v) => !v);
  }

  function selectPreset(opt) {
    onChange({ from: opt.from, to: opt.to, label: opt.label });
    handleClose();
  }

  function applyCustom() {
    onChange({ from: customFrom, to: customTo, label: formatPeriodLabel(customFrom, customTo) });
    handleClose();
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        {/* Absorbs the touch so tapping the card itself doesn't also trigger
            the overlay's dismiss-on-press-outside behind it. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Select period</Text>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <X size={16} color={colors.ink} strokeWidth={2.6} />
            </Pressable>
          </View>

          {options.map((opt) => {
            const isActive = activePreset?.key === opt.key;
            return (
              <Pressable key={opt.key} style={styles.optionRow} onPress={() => selectPreset(opt)}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{opt.label}</Text>
                  <Text style={styles.optionRange}>
                    {format(opt.from, 'MMM d')} – {format(opt.to, 'MMM d')}
                  </Text>
                </View>
                {isActive && <Check size={18} color={colors.income} strokeWidth={2.8} />}
              </Pressable>
            );
          })}

          <Pressable style={[styles.optionRow, styles.customToggleRow]} onPress={handleCustomToggle}>
            <View style={styles.customToggleLeft}>
              {!isPro && <Crown size={13} color={colors.mutedDarker} strokeWidth={2.4} />}
              <Text style={[styles.optionText, isCustomActive && styles.optionTextActive]}>Custom range</Text>
            </View>
            {isCustomActive && <Check size={18} color={colors.income} strokeWidth={2.8} />}
          </Pressable>

          {customOpen && (
            <View style={styles.customBlock}>
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
              <Button title="Apply" onPress={applyCustom} />
            </View>
          )}
        </Pressable>
      </Pressable>

      {showFromPicker && (
        <DateTimePicker
          value={customFrom}
          mode="date"
          display="default"
          maximumDate={customTo}
          onChange={(_event, selected) => {
            setShowFromPicker(false);
            if (!selected) return;
            setCustomFrom(selected);
            if (isBefore(customTo, selected)) setCustomTo(selected);
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
            if (selected) setCustomTo(selected);
          }}
        />
      )}
    </Modal>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.cardLg,
    padding: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  customToggleRow: {
    borderBottomWidth: 0,
  },
  customToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  optionTextActive: {
    color: colors.income,
  },
  optionRange: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 2,
  },
  customBlock: {
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  customRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateField: {
    backgroundColor: colors.chipBg,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
  },
  fieldValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.base,
    color: colors.ink,
    marginTop: 2,
  },
  });
}
