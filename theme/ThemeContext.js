import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { MODES, DEFAULT_ACCENT_ID, resolveColors } from './themes';

const MODE_STORAGE_KEY = 'flo.themeMode';

// What the user chose in Settings → Appearance (37-design-system-and-koban.md).
// 'system' follows the phone's light/dark setting live and is the default;
// 'light' and 'dark' force one.
export const MODE_PREFERENCES = ['system', 'light', 'dark'];
export const DEFAULT_MODE_PREFERENCE = 'system';

const ThemeContext = createContext(null);

// Deliberately self-contained — no useAuth/useProfile dependency, because
// this mounts ABOVE AuthProvider in app/_layout.js (sign-in and the pre-auth
// intro are theme-reactive too). Profile reconciliation (making the choice
// follow the user across devices/reinstalls) happens via a separate sibling
// component mounted INSIDE AuthProvider — see ThemeProfileSync in
// app/_layout.js — the same "sibling of <Stack>" shape ShareIntentHandler/
// OnboardingGate already use for the identical reason.
//
// Still two axes internally (accent × mode, see themes.js) so seasonal hero
// skins can plug in later, but the accent is fixed to the brand lime: the
// accent picker is gone and a stored accent is ignored (spec 37). Only the
// mode is a choice.
//
// `modePreference` is the choice ('system' | 'light' | 'dark'); `modeId` is
// what's on screen now ('light' | 'dark'), which every consumer that paints
// (StatusBar, the navigation bar, resolveColors) keeps reading.
export function ThemeProvider({ children }) {
  const [modePreference, setModePreferenceState] = useState(DEFAULT_MODE_PREFERENCE);
  const [hydrated, setHydrated] = useState(false);
  const systemScheme = useColorScheme();

  // Instant on cold start — don't wait on a network profile fetch just to
  // paint the first frame in the right colors. Same reasoning
  // AccountContext's own AsyncStorage read has for activeAccountId.
  useEffect(() => {
    AsyncStorage.getItem(MODE_STORAGE_KEY)
      .catch(() => null)
      .then((stored) => {
        if (MODE_PREFERENCES.includes(stored)) setModePreferenceState(stored);
        setHydrated(true);
      });
  }, []);

  const setModePreference = useCallback((pref) => {
    if (!MODE_PREFERENCES.includes(pref)) return;
    setModePreferenceState(pref);
    AsyncStorage.setItem(MODE_STORAGE_KEY, pref).catch(() => {});
  }, []);

  const modeId =
    modePreference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : MODES[modePreference] ? modePreference : 'light';
  const accentId = DEFAULT_ACCENT_ID;

  // Memoized on modeId specifically — resolveColors() builds a fresh object
  // every call, so without this, ANY re-render of ThemeProvider would hand
  // every consumer a new `colors` reference and invalidate their own
  // useMemo(() => makeStyles(colors), [colors]), forcing every themed screen
  // to rebuild its whole StyleSheet.
  const colors = useMemo(() => resolveColors(accentId, modeId), [accentId, modeId]);

  // React Navigation's Stack contentStyle (app/_layout.js) only paints the
  // JS screen container — during the actual native slide/gesture transition,
  // whatever's briefly visible around/behind it is the native root view's OWN
  // background, which Expo otherwise leaves at the platform default (white).
  // That's the white flash on push/pop: invisible on light mode (already
  // near-white) but obvious on dark. Kept in sync with the active mode every
  // time it changes, including when the phone's own setting flips.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  // Same reasoning as `colors` above, one level up — React Context compares
  // the value by reference.
  const value = useMemo(
    () => ({ accentId, modeId, modePreference, setModePreference, colors, hydrated }),
    [accentId, modeId, modePreference, setModePreference, colors, hydrated]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
