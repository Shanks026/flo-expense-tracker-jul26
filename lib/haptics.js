import * as Haptics from 'expo-haptics';

// One light tap when a destructive action is confirmed (delete, remove, turn
// off), matching the save haptic in the Add sheet (37-design-system-and-
// koban.md). Fire and forget: a phone without haptics simply does nothing.
export function destructiveHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
