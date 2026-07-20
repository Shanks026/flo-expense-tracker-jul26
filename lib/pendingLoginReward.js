import AsyncStorage from '@react-native-async-storage/async-storage';

// A one-shot bridge for the "first log of the day" coins+XP reward when it's
// earned from a screen that isn't AddTransactionSheet — onboarding's
// balance.js/expense.js insert transactions directly (their own contract:
// "identical row shape to an AddTransactionSheet-created transaction"), which
// is why the day-1 streak celebration/spin wheel already fires correctly
// during onboarding (useStreak reads the transactions table directly, not
// this reward), but AddTransactionSheet's own immediate RewardBurst call
// never had a path there. Per direct feedback: don't stack a burst into the
// onboarding stepper itself — persist the reward and let Home show it once
// onboarding finishes.
//
// User-scoped, same standing rule as every other local reward/seen flag in
// this app (StreakCelebration's lastCelebrated key, useTrophies' seen set,
// RankUpCelebration's lastSeen rank).
const key = (userId) => `flo.pendingLoginReward.${userId}`;

export async function setPendingLoginReward(userId, reward) {
  if (!userId) return;
  await AsyncStorage.setItem(key(userId), JSON.stringify(reward)).catch(() => {});
}

// Reads and immediately clears — a genuine one-shot consume, so Home only
// ever bursts this once per claim, not on every later mount/focus.
export async function takePendingLoginReward(userId) {
  if (!userId) return null;
  const raw = await AsyncStorage.getItem(key(userId)).catch(() => null);
  if (!raw) return null;
  await AsyncStorage.removeItem(key(userId)).catch(() => {});
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
