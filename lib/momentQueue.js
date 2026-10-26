import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

// The one moment queue (34-streak-only.md). Every interruption — the bills-due
// modal, streak celebrations, ambient toasts — is enqueued here instead of
// rendering its own modal, and components/MomentHost.js shows them one at a
// time:
//
// - Priority: actionable (bills due) > celebration (day 1, milestones) >
//   ambient (toasts). Ties go to the oldest.
// - Caps: at most 1 full-screen takeover per app session and 2 per day.
//   Ambient moments aren't takeovers and aren't capped.
// - Blockers: nothing shows while a blocker is set — the Add sheet while it's
//   open, onboarding while it's active (MomentQueueSync in app/_layout.js).
// - Deferral: a takeover that didn't fit stays saved on the device, per
//   user, and replays next session. It never stacks on another.
//
// Each moment has a stable `id` (e.g. `bills-due:2026-10-26`); one that has
// been shown is remembered and never enqueued again, so sources can simply
// enqueue whenever their condition holds.
//
// Module state, not React state, so non-component code can enqueue too.

export const PRIORITY = { actionable: 0, celebration: 1, ambient: 2 };
export const SESSION_TAKEOVERS = 1;
export const DAY_TAKEOVERS = 2;
const DONE_IDS_KEPT = 100;

const storageKey = (userId) => `flo.momentQueue.${userId}`;
const todayKey = () => format(new Date(), 'yyyy-MM-dd');

let userId = null;
let loaded = false;
let queue = []; // { id, kind, priority, payload, takeover, expiresAt, enqueuedAt }
let active = null;
let doneIds = [];
let day = { date: null, count: 0 };
let sessionCount = 0;
const blockers = new Set();
const listeners = new Set();
let snapshot = { active: null, blocked: false, blockers: [] };

function emit() {
  snapshot = { active, blocked: blockers.size > 0, blockers: [...blockers] };
  listeners.forEach((fn) => fn());
}

function persist() {
  // Never before the saved state has loaded: that would overwrite it.
  if (!userId || !loaded) return;
  const saved = {
    // Only takeovers carry over to the next session; ambient moments are
    // toasts about right now and would be stale later.
    queue: queue.filter((m) => m.takeover),
    doneIds: doneIds.slice(-DONE_IDS_KEPT),
    day,
  };
  AsyncStorage.setItem(storageKey(userId), JSON.stringify(saved)).catch(() => {});
}

// Called when the signed-in user changes (MomentQueueSync). Loads that user's
// saved queue; null clears everything.
export async function loadMomentsFor(nextUserId) {
  if (nextUserId === userId && loaded) return;
  // On the first load, keep what sources enqueued before it (cold start);
  // a switch from another user drops theirs.
  const keep = userId === null ? queue : [];
  userId = nextUserId;
  loaded = false;
  queue = keep;
  active = null;
  doneIds = [];
  day = { date: null, count: 0 };
  sessionCount = 0;
  emit();
  if (!nextUserId) return;
  const raw = await AsyncStorage.getItem(storageKey(nextUserId)).catch(() => null);
  if (userId !== nextUserId) return; // switched again while reading
  try {
    const saved = raw ? JSON.parse(raw) : null;
    // Merge: a source may have enqueued while this was reading.
    const savedQueue = (saved?.queue ?? []).filter((m) => !queue.some((q) => q.id === m.id));
    doneIds = saved?.doneIds ?? [];
    queue = [...savedQueue, ...queue].filter((m) => !doneIds.includes(m.id));
    day = saved?.day ?? day;
  } catch {
    // A corrupt save just starts empty.
  }
  loaded = true;
  persist();
  pump();
}

// A new app session (cold start, a return after a real stretch in the
// background, a new user) — the same points lib/track.js starts one.
export function startMomentSession() {
  sessionCount = 0;
  pump();
}

export function enqueue({ id, kind, priority = PRIORITY.celebration, payload = null, takeover = true, expiresAt = null }) {
  if (!id || !kind) return;
  if (doneIds.includes(id) || active?.id === id || queue.some((m) => m.id === id)) return;
  queue.push({ id, kind, priority, payload, takeover, expiresAt, enqueuedAt: Date.now() });
  persist();
  pump();
}

// A blocker holds every moment back while it's set (the Add sheet, onboarding).
export function setMomentBlocker(name, on) {
  const had = blockers.has(name);
  if (on === had) return;
  if (on) blockers.add(name);
  else blockers.delete(name);
  emit();
  if (!on) pump();
}

function canTakeOver() {
  if (day.date !== todayKey()) day = { date: todayKey(), count: 0 };
  return sessionCount < SESSION_TAKEOVERS && day.count < DAY_TAKEOVERS;
}

function pump() {
  if (!loaded || active || blockers.size > 0) return;
  const now = Date.now();
  const before = queue.length;
  queue = queue.filter((m) => !m.expiresAt || m.expiresAt > now);
  const takeoverAllowed = canTakeOver();
  const next = queue
    .filter((m) => !m.takeover || takeoverAllowed)
    .sort((a, b) => a.priority - b.priority || a.enqueuedAt - b.enqueuedAt)[0];
  if (!next) {
    if (queue.length !== before) persist();
    return;
  }
  queue = queue.filter((m) => m !== next);
  if (next.takeover) {
    sessionCount += 1;
    day = { date: todayKey(), count: day.count + 1 };
  }
  active = next;
  persist();
  emit();
}

// The renderer calls this when its moment is dismissed. `skipped: true` means
// it had nothing to show after all (e.g. the bills were paid meanwhile), so
// it doesn't use up a takeover.
export function finishMoment(id, { skipped = false } = {}) {
  if (!active || active.id !== id) return;
  if (skipped && active.takeover) {
    sessionCount = Math.max(0, sessionCount - 1);
    day = { ...day, count: Math.max(0, day.count - 1) };
  }
  doneIds = [...doneIds.filter((d) => d !== id), id].slice(-DONE_IDS_KEPT);
  active = null;
  persist();
  emit();
  pump();
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The moment on screen now, or null.
export function useActiveMoment() {
  return useSyncExternalStore(subscribe, () => snapshot.active);
}

// Whether something is interrupting right now — a moment on screen or a
// blocker such as the open Add sheet — so quieter UI (coach marks) can wait.
export function useAnyMomentActive() {
  return useSyncExternalStore(subscribe, () => snapshot.active !== null || snapshot.blocked);
}

// Whether anything other than `name` is interrupting. Only the flagged-off
// economy's RankUpCelebration still uses it, reporting itself as a blocker
// the way every moment did before the queue.
export function useOtherMomentActive(name) {
  return useSyncExternalStore(
    subscribe,
    () => snapshot.active !== null || snapshot.blockers.some((other) => other !== name)
  );
}
