import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, radii } from '../theme/tokens';
import { getOnboardingBackRoute } from '../lib/onboarding';

// TEMPORARY dev tool, not a product feature — a small floating back button on
// every onboarding screen so testing the flow doesn't mean restarting it from
// scratch each time. __DEV__-gated (true in Expo Go / dev builds, false in a
// release build) so it can never ship — nothing to remember to strip out
// later. Mounted ONCE as a Stack sibling (app/_layout.js), not per-screen:
// it reads the current path itself and looks up "previous" via
// getOnboardingBackRoute (lib/onboarding.js), which walks the same ordered
// step lists getNextRoute etc. use — see that function for why a plain
// router.back() doesn't work here.
export default function OnboardingDevBack() {
  const pathname = usePathname();
  const router = useRouter();

  if (!__DEV__) return null;
  if (!pathname?.startsWith('/onboarding')) return null;

  const backRoute = getOnboardingBackRoute(pathname);
  if (!backRoute) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} pointerEvents="box-none">
      <Pressable style={styles.button} onPress={() => router.replace(backRoute)} hitSlop={8}>
        <ChevronLeft size={22} color={colors.ink} strokeWidth={2.4} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  button: {
    marginTop: 8,
    marginLeft: 12,
    width: 36,
    height: 36,
    borderRadius: radii.iconTile,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
