export const colors = {
  brand: '#BBDC12',
  ink: '#101010',
  inkCard: '#1b1b1b',
  bg: '#F6F7F3',
  surface: '#FFFFFF',
  border: '#ECEDE7',
  borderSoft: '#F1F2ED',
  inputBg: '#F4F5F1',
  inputBorder: '#ECEDE7',
  chipBg: '#EDEEE9',
  iconTileBg: '#F0F1EC',

  // Muted text, all at least 4.5:1 on bg and surface (37-design-system-and-
  // koban.md; were 2.0–3.3:1). Still ordered darkest → lightest:
  // mutedDarker 6.7, muted 5.5, mutedMid 5.0, mutedLight 4.6 (on bg).
  // chevron stays a light, decorative glyph colour, never text.
  muted: '#62665d',
  mutedMid: '#686c63',
  mutedLight: '#6e7268',
  mutedDarker: '#55594f',
  // Muted greys for text on a permanently dark surface (Card dark, hero
  // cards, celebration screens) — the pre-spec-37 values, which already read
  // well on near-black (mutedOnDark 7.0:1, mutedOnDarkLight 9.4:1 on ink).
  // mutedOnDarkDarker (3.6:1) is for the dimmed currency symbol only.
  mutedOnDark: '#9a9e94',
  mutedOnDarkLight: '#b0b3aa',
  mutedOnDarkDarker: '#6b6f66',
  chevron: '#c4c7bd',

  income: '#4C7311', // 5.2:1 on bg (was 3.8:1)
  incomeBg: '#EEF4CE',
  incomeAccent: '#7B8B0C',

  // Streak — a dedicated system, deliberately NOT the brand lime.
  //
  // Fire is orange; a lime flame is a concept-colour mismatch that costs the
  // viewer a beat every time. Orange is also the cross-app convention
  // (Duolingo/Strava/Snapchat), so a flame + number is already a known object
  // and needs no learning. And `brand` as *text* on white fails contrast, which
  // is why the streak count previously had to compromise on the darker lime.
  //
  // Chosen to sit clear of BOTH warm colours already spoken for in this palette:
  // `danger` (#E5484D, over budget) and `warn` (#E8A317, nearly out). In a money
  // app, "achievement" must not land in the same temperature band as "you're in
  // trouble" — hence a true orange, not a red.
  //
  // USE ONLY ON STREAK SURFACES (the flame, lit day cells, the count). Lime
  // stays the money colour and the app's identity; orange means "you showed up".
  streak: '#FF6B2C',
  streakDeep: '#D9480F', // text + the flame's core; readable on white
  streakBg: '#ffe5dc', // pale wash, for tiles behind the flame
  // A purer, less red-leaning orange than `streak` itself (hue ~18°, reads as
  // "rich red/orange") — specifically for the streak calendar's filled/logged
  // day cells, per direct feedback that they should read as orange, not red.
  // Deepened once already (from #FF9500) per direct feedback for more
  // contrast/pop against the screen.
  streakFill: '#FF8A00',

  // Unread-alert dot on the bell. Rose rather than the full `danger` red: this
  // is "there is something to read", not "you are in trouble" — the alerts
  // behind it may be warnings, not emergencies. It was brand lime, which read as
  // a positive badge on an icon whose whole job is to say something needs
  // attention.
  rose: '#F43F5E',

  danger: '#E5484D',
  dangerStrong: '#F0605A',
  dangerBg: '#FBE2E1',
  dangerBorder: '#F3D2D0',
  dangerTrack: '#F7E0DE',

  warn: '#C98A12',
  warnStrong: '#E8A317',
  warnBg: '#FBEFD3',
  warnBorder: '#F5E4C0',

  // Gamification placeholders (see app/(tabs)/index.js's header chips and
  // IDEAS-gamification.md) — coins and streak-freezes. A true gold and a
  // literal ice blue: kept clear of `warn` (#C98A12/#E8A317, "budget's
  // tight") and `streak` (#FF6B2C, "you showed up") since coins reward a
  // different feeling from either, and nothing else in this palette lives
  // in blue at all, so no collision risk there.
  coinGold: '#E0A930',
  iceBlue: '#4FC3E8',
  iceBlueBg: '#DFF4FB', // pale wash, for tiles/cells behind a frozen-day glyph — same role as streakBg

  completedBg: '#F1F2ED',
  completedBorder: '#E7E8E2',
  completedTrack: '#E3E4DE',
};

export const radii = {
  card: 22,
  cardLg: 26,
  pill: 99,
  iconTile: 13,
  iconTileLg: 16,
  button: 16,
  buttonSm: 14,
  sheet: 32,
  screen: 46,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  // Gaps between sections (37-design-system-and-koban.md).
  section: 32,
  sectionLg: 48,
};

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

export const fontFamily = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 13,
  md: 14,
  lg: 15,
  xl: 16,
  xxl: 17,
  heading: 19,
  title: 20,
  display: 22,
  hero: 30,
  amount: 34,
  amountLg: 44,
  amountXl: 56,
};

// --- Spec 37 scale ("Ledger, not game") --------------------------------------
// Added alongside the older tokens above, not instead of them: screens move
// to these as each spec touches them (37-design-system-and-koban.md).

// The type ramp: six sizes, used with three Manrope weights (semibold, bold,
// extrabold). Body text is never below `body` (14).
export const type = {
  caption: 12,
  body: 14,
  bodyLg: 16,
  title: 20,
  headline: 28,
  display: 40,
};

// Three corner radii plus full.
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

// The smallest tap target, in dp, for anything a user can press.
export const hitTarget = 48;

// Elevation, so components stop hand-rolling shadows.
export const shadow = {
  sm: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
};

// Motion durations in ms. Entrance animation is for first-time moments only.
export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
};

const tokens = { colors, radii, spacing, fontWeight, fontFamily, fontSize, type, radius, hitTarget, shadow, motion };
export default tokens;
