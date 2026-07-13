import { Stack } from 'expo-router';

// gestureEnabled: false — onboarding is a linear flow with an explicit skip on
// every screen. Swiping back out of it (on iOS) or popping past the first step
// would land the user on a Home screen the gate immediately bounces them off,
// which reads as the app fighting them. Forward or skip, nothing else.
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
