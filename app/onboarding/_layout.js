import { Stack } from 'expo-router';

// gestureEnabled: false — onboarding is a linear flow with an explicit skip on
// every screen. Swiping back out of it (on iOS) or popping past the first step
// would land the user on a Home screen the gate immediately bounces them off,
// which reads as the app fighting them. Forward or skip, nothing else.
//
// animation: 'fade' — the native-stack default (a slide/push transition) reads
// as an abrupt cut on Android when every step also runs its own content
// entrance (OnboardingReveal); a cross-fade between screens plus the reveal
// underneath reads as one continuous motion instead of two competing ones.
// Applies to every screen under app/onboarding/, including intro/ (no separate
// _layout there, so intro/* screens are flattened into this same Stack).
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />;
}
