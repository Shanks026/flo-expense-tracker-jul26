import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import Svg, { Defs, ClipPath, Circle, G, Path } from 'react-native-svg';
import { Check, X, Lock } from 'lucide-react-native';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { ACCENT_LIST, accentSupportsMode, accentModeLabel } from '../theme/themes';

// The same palette-wheel swatch built for the old flat theme list, repointed
// at what an accent actually IS now that it's decoupled from mode
// (16-app-themes.md — restructured 2026-07-18): a color, plus its light-
// surface tint and its dark-surface tint. Top hemisphere = the accent
// itself (dominates visually), bottom-left = brandBg (its light tint),
// bottom-right = brandBgDark (its dark tint) — still area-proportional to
// how the three values actually get used, just re-mapped from the old bg/
// accent/ink trio to accent/light-tint/dark-tint.
// `id` must be unique per rendered instance (not just per accent) — several
// ClipPaths with the same id in one RN tree can bleed into each other on
// Android, so it's namespaced with the option's own accent id.
// Exported (23-personalize-hub.md Phase 1) — the Personalize hub's inline
// accent row reuses this exact swatch renderer rather than duplicating the
// clip-path math.
export function ColorSwatch({ id, accent, size = 36 }) {
  const r = size / 2;
  const clipId = `color-swatch-${id}`;
  const topHalf = `M0,${r} A${r},${r} 0 0,1 ${size},${r} Z`;
  const bottomLeftQuarter = `M0,${r} A${r},${r} 0 0,0 ${r},${size} L${r},${r} Z`;
  const bottomRightQuarter = `M${r},${size} A${r},${r} 0 0,0 ${size},${r} L${r},${r} Z`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx={r} cy={r} r={r} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Path d={topHalf} fill={accent.brand} />
        <Path d={bottomLeftQuarter} fill={accent.brandBg} />
        <Path d={bottomRightQuarter} fill={accent.brandBgDark} />
      </G>
    </Svg>
  );
}

// A pure controlled component, same shape as CurrencyPicker: `value`/
// `onChange` from the caller (app/settings.js owns the actual dual write —
// setAccent() + updateProfile({ theme_accent }) — mirroring how it already
// owns handleCurrencyChange). Dialog-only (no 'inline' variant) — the color
// picker only ever needs Settings' picker.
//
// The dialog's OWN chrome reads the ACTIVE theme via useTheme() (consistent
// with every other screen — it would be jarring for Settings to go dark but
// its own picker to stay stubbornly light). Each OPTION's swatch shows THAT
// accent's own colors regardless of which accent is currently active —
// that's the whole point, showing what a not-currently-selected color
// looks like.
export default function ColorPicker({ value, onChange, renderTrigger, style }) {
  const { colors, modeId } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen((v) => !v);
  const close = () => setOpen(false);

  const selected = ACCENT_LIST.find((a) => a.id === value) ?? ACCENT_LIST[0];

  function selectAccent(id) {
    onChange(id);
    close();
  }

  const trigger = renderTrigger ? (
    renderTrigger(selected, toggle)
  ) : (
    <Pressable style={s.row} onPress={toggle}>
      <Text style={s.label}>Primary Color</Text>
      <Text style={s.value}>{selected.name}</Text>
    </Pressable>
  );

  return (
    <View style={style}>
      {trigger}

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={s.overlay} onPress={close}>
          {/* Absorbs the touch so tapping the card itself doesn't also
              trigger the overlay's dismiss-on-press-outside behind it. */}
          <Pressable style={s.card} onPress={() => {}}>
            <View style={s.headerRow}>
              <Text style={s.headerTitle}>Primary color</Text>
              <Pressable style={s.closeButton} onPress={close}>
                <X size={16} color={colors.ink} strokeWidth={2.6} />
              </Pressable>
            </View>

            {/* Fixed-height scroll — the accent list grew to 23 (22-coin-store-
                and-reward-tiering.md), well past what fits in a centered dialog,
                so the list scrolls inside a capped height while the header stays
                pinned above it. */}
            <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {ACCENT_LIST.map((a, idx) => {
              const isSelected = a.id === value;
              // Locked when the accent can't be read in the CURRENT mode (pale
              // off-whites in light mode) — dimmed, non-selectable, captioned
              // with the mode it IS good for. Switching to that mode unlocks it.
              const supported = accentSupportsMode(a, modeId);
              const lockLabel = accentModeLabel(a);
              return (
                <Pressable
                  key={a.id}
                  style={[s.optionRow, idx < ACCENT_LIST.length - 1 && s.optionRowBorder, !supported && s.optionRowLocked]}
                  onPress={() => supported && selectAccent(a.id)}
                  disabled={!supported}
                >
                  <View style={[s.swatchRing, isSelected && s.swatchRingActive]}>
                    <ColorSwatch id={a.id} accent={a} />
                  </View>
                  <View style={s.optionTextWrap}>
                    <Text style={[s.optionName, isSelected && s.optionNameActive]}>{a.name}</Text>
                    {!supported && lockLabel && <Text style={s.optionLockLabel}>{lockLabel}</Text>}
                  </View>
                  {isSelected ? (
                    <Check size={18} color={colors.income} strokeWidth={2.8} />
                  ) : !supported ? (
                    <Lock size={15} color={colors.mutedLight} strokeWidth={2.4} />
                  ) : null}
                </Pressable>
              );
            })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// A function, not StyleSheet.create at module scope — this file IS one of
// the theme-reactive conversions (16-app-themes.md §1.3): its own dialog
// chrome must re-render when the active theme changes, same pattern every
// other converted screen uses.
function makeStyles(colors) {
  return StyleSheet.create({
    row: {
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.iconTileBg,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.base,
      color: colors.mutedMid,
    },
    value: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.base,
      color: colors.ink,
    },
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
    // Capped height so 23 accents scroll inside the dialog instead of pushing
    // it past the screen edges.
    list: {
      maxHeight: 380,
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
    optionRowLocked: {
      opacity: 0.45,
    },
    optionTextWrap: {
      flex: 1,
    },
    optionLockLabel: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: colors.mutedLight,
      marginTop: 1,
    },
    swatchRing: {
      padding: 3,
      borderRadius: radii.pill,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    swatchRingActive: {
      borderColor: colors.income,
    },
    optionName: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    optionNameActive: {
      color: colors.income,
    },
  });
}
