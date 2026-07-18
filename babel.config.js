module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated v4 split its worklets transform out into its own package
    // (react-native-worklets) — the old `react-native-reanimated/plugin`
    // path is stale for this project's version and the worklets it needs
    // to compile (useAnimatedStyle/useSharedValue callbacks in
    // OnboardingReveal, the reflection screen's FallingCard, the account
    // hero carousel's swipe gesture, etc.) don't get transformed. Shared
    // values still update, but the animated styles derived from them never
    // reflect it — components stay stuck at their initial (often
    // invisible) frame, which is exactly the reflection screen's "blank,
    // no falling cards, no text" symptom. Confirmed against
    // react-native-worklets' own package contents (a real `plugin`
    // export), not just the upstream GitHub issue describing this exact
    // migration gap for Reanimated v4.
    plugins: ['react-native-worklets/plugin'],
  };
};
