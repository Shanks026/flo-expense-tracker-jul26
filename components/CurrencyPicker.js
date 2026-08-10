import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { CURRENCY_LIST, currencyMeta } from '../lib/currency';

// Reused by AddAccountSheet, AddBillSheet and app/settings.js (a light pushed
// screen). `renderTrigger(selectedMeta, toggle)` lets a caller supply its own
// trigger row (Settings' icon-tile row shape) while still reusing the shared
// open/close state and option list.
//
// Two presentations, chosen per-caller via `variant`:
// - 'inline' (default) — the trigger row expands in place into the full
//   CURRENCY_LIST, the same pattern AddBudgetSheet's category picker and
//   Settings' own Reports cadence block use. Used by AddAccountSheet /
//   AddBillSheet, matching their sheets' existing pickers.
// - 'dialog' — a centred Modal, the exact shape ReportPeriodPicker already
//   established for report.js's date-range picker (RN Modal, transparent +
//   fade, overlay-press-to-dismiss). Used by Settings, since a trigger row in
//   a scrolling list has nowhere good for an inline panel to push content
//   into — the same reasoning ReportPeriodPicker's own comment gives for why
//   IT isn't an inline panel either.
export default function CurrencyPicker({
  value,
  onChange,
  disabled = false,
  disabledReason,
  renderTrigger,
  variant = 'inline',
  style,
}) {
  const { colors } = useTheme();
  const dialogStyles = useMemo(() => makeDialogStyles(colors), [colors]);
  const inlineStyles = useMemo(() => makeInlineStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const selected = currencyMeta(value);
  const toggle = () => !disabled && setOpen((v) => !v);
  const close = () => setOpen(false);

  function selectCode(code) {
    onChange(code);
    close();
  }

  const rowBg = colors.iconTileBg;
  const valueColor = colors.ink;
  const labelColor = colors.mutedMid;

  const trigger = renderTrigger ? (
    renderTrigger(selected, toggle)
  ) : (
    <Pressable
      style={[inlineStyles.row, { backgroundColor: rowBg }, disabled && inlineStyles.rowDisabled]}
      onPress={toggle}
      disabled={disabled}
    >
      <Text style={[inlineStyles.label, { color: labelColor }]}>Currency</Text>
      <Text style={[inlineStyles.value, { color: valueColor }]}>
        {selected.symbol} {selected.code}
      </Text>
    </Pressable>
  );

  if (variant === 'dialog') {
    return (
      <View style={style}>
        {trigger}
        {disabled && disabledReason && <Text style={inlineStyles.hint}>{disabledReason}</Text>}

        <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
          <Pressable style={dialogStyles.overlay} onPress={close}>
            {/* Absorbs the touch so tapping the card itself doesn't also
                trigger the overlay's dismiss-on-press-outside behind it. */}
            <Pressable style={dialogStyles.card} onPress={() => {}}>
              <View style={dialogStyles.headerRow}>
                <Text style={dialogStyles.headerTitle}>Select currency</Text>
                <Pressable style={dialogStyles.closeButton} onPress={close}>
                  <X size={16} color={colors.ink} strokeWidth={2.6} />
                </Pressable>
              </View>

              {CURRENCY_LIST.map((c, idx) => {
                const isSelected = c.code === value;
                return (
                  <Pressable
                    key={c.code}
                    style={[dialogStyles.optionRow, idx < CURRENCY_LIST.length - 1 && dialogStyles.optionRowBorder]}
                    onPress={() => selectCode(c.code)}
                  >
                    <Text style={dialogStyles.optionSymbol}>{c.symbol}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[dialogStyles.optionCode, isSelected && dialogStyles.optionCodeActive]}>
                        {c.code}
                      </Text>
                      <Text style={dialogStyles.optionName}>{c.name}</Text>
                    </View>
                    {isSelected && <Check size={18} color={colors.income} strokeWidth={2.8} />}
                  </Pressable>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  return (
    <View style={style}>
      {trigger}

      {disabled && disabledReason && <Text style={inlineStyles.hint}>{disabledReason}</Text>}

      {open && !disabled && (
        <View style={[inlineStyles.list, { backgroundColor: rowBg }]}>
          {CURRENCY_LIST.map((c, idx) => {
            const isSelected = c.code === value;
            return (
              <Pressable
                key={c.code}
                style={[inlineStyles.optionRow, idx < CURRENCY_LIST.length - 1 && inlineStyles.optionRowBorder]}
                onPress={() => selectCode(c.code)}
              >
                <Text style={[inlineStyles.optionSymbol, { color: valueColor }]}>{c.symbol}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[inlineStyles.optionCode, { color: valueColor }]}>{c.code}</Text>
                  <Text style={inlineStyles.optionName}>{c.name}</Text>
                </View>
                {isSelected && <Check size={16} color={colors.brand} strokeWidth={2.8} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function makeInlineStyles(colors) {
  return StyleSheet.create({
  row: {
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowDisabled: {
    opacity: 0.6,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
  },
  value: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.base,
  },
  hint: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedLight,
    marginTop: spacing.xs,
    paddingHorizontal: 2,
  },
  list: {
    borderRadius: 12,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  optionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  optionSymbol: {
    width: 28,
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    textAlign: 'center',
  },
  optionCode: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
  },
  optionName: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    marginTop: 1,
  },
  });
}

// Mirrors ReportPeriodPicker's dialog styles exactly (light surface, centred,
// transparent+fade) — the established "this is a dialog, not a sheet" shape.
function makeDialogStyles(colors) {
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
    gap: spacing.md,
    paddingVertical: 13,
  },
  optionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  optionSymbol: {
    width: 28,
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    textAlign: 'center',
    color: colors.ink,
  },
  optionCode: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  optionCodeActive: {
    color: colors.income,
  },
  optionName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 2,
  },
  });
}
