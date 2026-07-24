import AsyncStorage from '@react-native-async-storage/async-storage';

// 12-personal-onboarding.md Phase 1 — the PRE-AUTH answer draft + the device
// "introSeen" flag. AsyncStorage, same style as lib/reports.js / lib/notifications.js.
//
// This is the ONE onboarding AsyncStorage key that is deliberately NOT
// user-scoped (contrast the streak-celebration key rule in 00-index.md) — and
// legitimately so: it exists precisely BEFORE a user identity does. The intro
// runs while signed out; there is no userId to scope by. It is cleared on
// finish (Phase 3) once its durable answers have been flushed to profiles and
// its transient ones (income) consumed by the budget step.
const KEYS = {
  draft: 'flo.onboarding.draft',
  introSeen: 'flo.onboarding.introSeen',
};

// Draft shape (all optional, filled as the intro progresses):
//   { name, age_range, income_band, goal, leak_category, tracking_habit }
// income_band sizes the first budget in Act 2 AND is now persisted to
// profiles.onboarding_answers (decision 2026-07-22 — reversing the earlier
// "never store income" call; it's a coarse band in the user's own RLS row, and
// the income screen's badge copy was updated to stop claiming non-storage).
// `name` is still NOT persisted here — it rides in via signup metadata.
// (`gender` and `commitment` were dropped 2026-07-22 with their screens —
// 28-onboarding-welcome-bundle.md's onboarding trim.)
export async function getDraft() {
  const raw = await AsyncStorage.getItem(KEYS.draft);
  return raw ? JSON.parse(raw) : {};
}

export async function setDraftAnswer(key, value) {
  const current = await getDraft();
  const next = { ...current, [key]: value };
  await AsyncStorage.setItem(KEYS.draft, JSON.stringify(next));
  return next;
}

export async function clearDraft() {
  await AsyncStorage.removeItem(KEYS.draft);
}

// introSeen: '1' once the intro has handed off to auth on this device, OR once
// any session has been established (set in RootNavigator). Read by RootNavigator
// to decide, while signed out, between the sales intro and the sign-in screen.
// The DB flag profiles.onboarded_at — not this — is the true one-time guarantee;
// this only spares a returning user on a fresh device the intro, and even if
// it's wiped, the opener's "Sign in" escape hatch + onboarded_at cover it.
export async function getIntroSeen() {
  return (await AsyncStorage.getItem(KEYS.introSeen)) === '1';
}

export async function setIntroSeen() {
  await AsyncStorage.setItem(KEYS.introSeen, '1');
}

// 12-personal-onboarding.md Phase 2 — the whitelist for the flush to
// profiles.onboarding_answers. `name` is excluded (rode in via signup
// metadata). `income_band` was excluded until 2026-07-22 ("never store income")
// but is now persisted for personalisation/analytics — a coarse band in the
// user's own RLS row; the income screen's copy was updated to match.
// (`commitment` was here until 2026-07-22, when its screen was removed — it had
// no reader anyway; see onboarding.js.)
const DURABLE_KEYS = ['age_range', 'income_band', 'goal', 'leak_category', 'tracking_habit'];

export function pickDurableAnswers(draft) {
  const out = {};
  for (const key of DURABLE_KEYS) {
    if (draft[key] !== undefined) out[key] = draft[key];
  }
  return out;
}
