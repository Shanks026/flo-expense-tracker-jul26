import * as Haptics from 'expo-haptics';

// One light tap when a destructive action is confirmed (delete, remove, turn
// off), matching the save haptic in the Add sheet (37-design-system-and-
// koban.md). Fire and forget: a phone without haptics simply does nothing.
export function destructiveHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// A success buzz when a streak milestone is celebrated (redesign §2.7).
export function successHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
