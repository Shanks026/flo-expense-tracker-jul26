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
//   { name, age_range, income_band, goal, leak_category, tracking_habit, commitment }
// income_band is used only in-session (sizes the first budget in Act 2) and is
// NEVER written to profiles — the Phase 2 flush whitelists the durable keys.
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
// profiles.onboarding_answers. `income_band` and `name` are deliberately
// excluded: income is never persisted (user's explicit call), name already
// rode in via signup metadata. `commitment` isn't collected until Phase 3's
// screen, so it's simply absent from the object until then — a later
// updateProfile merge adds it.
const DURABLE_KEYS = ['age_range', 'goal', 'leak_category', 'tracking_habit', 'commitment'];

export function pickDurableAnswers(draft) {
  const out = {};
  for (const key of DURABLE_KEYS) {
    if (draft[key] !== undefined) out[key] = draft[key];
  }
  return out;
}
