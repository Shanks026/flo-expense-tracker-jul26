import { View } from 'react-native';
import { Coins, Medal, BellRing, CalendarDays, Receipt, Sparkles, Trophy } from 'lucide-react-native';
import { useLedger, ledgerRadius, ledgerPalettes } from '../../theme/ledger';

// One object per moment (redesign §2.5–2.6): onboarding, empty states,
// celebrations, the notification ask and the Ask FLO intro each get one
// named object. Never on working screens.
//
// The 3D renders don't exist yet (plan §6, open item 2), so each name draws a
// lucide glyph in a sunk circle. When the PNG/WebP files arrive, only this
// file changes: swap the glyph for an <Image> per name.
const OBJECTS = {
  coins: Coins,
  token: Medal,
  whistle: BellRing,
  calendar: CalendarDays,
  receipt: Receipt,
  spark: Sparkles,
  trophy: Trophy,
};

export const ILLUSTRATION_NAMES = Object.keys(OBJECTS);

// `small` for empty states, `large` for onboarding and celebrations.
const SIZES = { small: 72, large: 120 };

// `surface="dark"` is for a screen that's dark whatever the phone's mode
// (the streak celebration); otherwise it follows light/dark.
export default function Illustration({ name, size = 'small', surface, accessibilityLabel, style }) {
  const { c: themed } = useLedger();
  const c = surface === 'dark' ? ledgerPalettes.dark : themed;
  const Glyph = OBJECTS[name] ?? Coins;
  const d = SIZES[size] ?? SIZES.small;

  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image', accessibilityLabel }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true };

  return (
    <View
      style={[
        { width: d, height: d, borderRadius: ledgerRadius.full, backgroundColor: c.surfaceSunk, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
      {...a11y}
    >
      <Glyph size={Math.round(d * 0.44)} color={c.ink} strokeWidth={1.75} />
    </View>
  );
}
