import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { ACCENTS, MODES, DEFAULT_ACCENT_ID, DEFAULT_MODE_ID, resolveColors } from './themes';

const ACCENT_STORAGE_KEY = 'flo.themeAccent';
const MODE_STORAGE_KEY = 'flo.themeMode';

const ThemeContext = createContext(null);

// Deliberately self-contained — no useAuth/useProfile dependency, because
// this mounts ABOVE AuthProvider in app/_layout.js (sign-in and the pre-auth
// intro are theme-reactive too). Profile reconciliation (making the choice
// follow the user across devices/reinstalls) happens via a separate sibling
// component mounted INSIDE AuthProvider — see ThemeProfileSync in
// app/_layout.js — the same "sibling of <Stack>" shape ShareIntentHandler/
// OnboardingGate already use for the identical reason.
//
// Two independent pieces of state (accentId, modeId), not one — restructured
// 2026-07-18 from a single flat theme id into "which color" x "how bright
// the screen is", matching how the app is actually built (see themes.js).
export function ThemeProvider({ children }) {
  const [accentId, setAccentId] = useState(DEFAULT_ACCENT_ID);
  const [modeId, setModeId] = useState(DEFAULT_MODE_ID);
  const [hydrated, setHydrated] = useState(false);

  // Instant on cold start — don't wait on a network profile fetch just to
  // paint the first frame in the right colors. Same reasoning
  // AccountContext's own AsyncStorage read has for activeAccountId.
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(ACCENT_STORAGE_KEY).catch(() => null),
      AsyncStorage.getItem(MODE_STORAGE_KEY).catch(() => null),
    ]).then(([storedAccent, storedMode]) => {
      if (storedAccent && ACCENTS[storedAccent]) setAccentId(storedAccent);
      if (storedMode && MODES[storedMode]) setModeId(storedMode);
      setHydrated(true);
    });
  }, []);

  const setAccent = useCallback((id) => {
    if (!ACCENTS[id]) return;
    setAccentId(id);
    AsyncStorage.setItem(ACCENT_STORAGE_KEY, id).catch(() => {});
  }, []);

  const setMode = useCallback((id) => {
    if (!MODES[id]) return;
    setModeId(id);
    AsyncStorage.setItem(MODE_STORAGE_KEY, id).catch(() => {});
  }, []);

  // Memoized on [accentId, modeId] specifically — resolveColors() builds a
  // fresh object every call, so without this, ANY re-render of ThemeProvider
  // (not just an actual accent/mode change — e.g. a parent re-rendering for
  // an unrelated reason) would hand every consumer a new `colors` reference
  // and invalidate their own useMemo(() => makeStyles(colors), [colors]),
  // forcing every themed screen in the tree to rebuild its whole StyleSheet.
  // That's real, avoidable jank riding along on top of a genuine theme
  // toggle, not the toggle animation itself.
  const colors = useMemo(() => resolveColors(accentId, modeId), [accentId, modeId]);

  // React Navigation's Stack contentStyle (app/_layout.js) only paints the
  // JS screen container — during the actual native slide/gesture transition,
  // whatever's briefly visible around/behind it is the native root view's OWN
  // background, which Expo otherwise leaves at the platform default (white).
  // That's the white flash on push/pop: invisible on light mode (already
  // near-white) but obvious on dark. This is the actual fix; contentStyle
  // alone wasn't enough. Setting it here (not just once at startup) keeps it
  // in sync with the active mode every time it changes, not just cold start.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  // Same reasoning as `colors` above, one level up — without memoizing the
  // context value itself, every consumer of useTheme() re-renders on ANY
  // ThemeProvider re-render (React Context compares the value by reference),
  // regardless of whether accentId/modeId/hydrated actually changed.
  const value = useMemo(
    () => ({ accentId, modeId, setAccent, setMode, colors, hydrated }),
    [accentId, modeId, setAccent, setMode, colors, hydrated]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
