import { useShareIntent } from 'expo-share-intent';

// Thin wrapper around expo-share-intent so the rest of the app depends on
// FLO's own hook shape, not the third-party library's API directly.
export default function useIncomingShare() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  return {
    sharedText: hasShareIntent ? (shareIntent?.text ?? null) : null,
    clearSharedText: resetShareIntent,
  };
}
