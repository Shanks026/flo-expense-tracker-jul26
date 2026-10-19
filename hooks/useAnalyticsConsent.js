import { useSyncExternalStore } from 'react';
import { getTrackingConsent, saveAnalyticsConsent, subscribeTrackingConsent } from '../lib/track';

// The analytics opt-in (33-product-analytics.md), read from lib/track.js's
// copy of `profiles.analytics_consent` so the switch and the tracking gate
// can never disagree.
export default function useAnalyticsConsent() {
  const consent = useSyncExternalStore(subscribeTrackingConsent, getTrackingConsent);
  return { consent, setConsent: saveAnalyticsConsent };
}
