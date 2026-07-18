import { View, StyleSheet } from 'react-native';
import { radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export default function IconTile({ children, tone = 'neutral', size = 42, radius = radii.iconTile, onDark = false }) {
  const { colors } = useTheme();

  // `dark` tone is meant to sit on a pinned-dark surface (a Card dark=true
  // background) — stays on colors.inkCard from the active theme's own dark
  // pairing is actually fine here since inkCard as a TONE (not a pinned
  // literal) is only ever used adjacent to Card's dark variant within the
  // same visual block, and semantic/income/danger/warn/streak are already
  // locked identical across every theme.
  //
  // `brand` used to be a runtime rgba(brand, 0.16) alpha blend — correct
  // over Brand theme's white screen (reads as a pale mint tint), but an
  // alpha blend composites against WHATEVER is behind it: over Dark theme's
  // near-black screen the same 16% lime works out to a barely-visible dark
  // olive smudge, not a tint. `colors.brandBg` is a solid color each theme
  // authors directly instead, so it doesn't depend on what's underneath it.
  //
  // `onDark` swaps brand's tint for `colors.brandBgDark` — brandBg itself is
  // authored as a PALE tint assuming a light card behind it (Budgets tab),
  // and reads washed-out/invisible on a permanently-dark card (Plans' active
  // plan, which uses `<Card dark>`). Only `brand` needs this: every other
  // tone's tint is already either dark-toned (dark, danger/warn/streak/
  // income's Dark-theme variants) or genuinely meant for a light card.
  const TONES = {
    neutral: colors.iconTileBg,
    brand: onDark ? colors.brandBgDark : colors.brandBg,
    streak: colors.streakBg,
    income: colors.incomeBg,
    danger: colors.dangerBg,
    warn: colors.warnBg,
    dark: colors.inkCard,
    completed: colors.completedTrack,
  };

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: TONES[tone] ?? TONES.neutral,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
