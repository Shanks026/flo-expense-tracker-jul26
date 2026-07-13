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

  muted: '#8a8e84',
  mutedMid: '#9a9e94',
  mutedLight: '#b0b3aa',
  mutedDarker: '#6b6f66',
  chevron: '#c4c7bd',

  income: '#5f8a15',
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
  streakBg: '#FFE8DC', // pale wash, for tiles behind the flame

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

const tokens = { colors, radii, spacing, fontWeight, fontFamily, fontSize };
export default tokens;
