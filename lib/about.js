import Constants from 'expo-constants';

// Settings → About (38-home-insights-more.md).
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

// The hosted privacy policy. Not published yet (a 32-safe-closed-test-build.md
// map task); Settings shows the row only once this is set.
export const PRIVACY_POLICY_URL = null;
