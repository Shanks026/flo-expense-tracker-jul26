import { useSyncExternalStore } from 'react';

// Which full-screen "moments" are on screen right now — the streak
// celebration and its spin wheel, rank-up, the freeze prompt, due bills. Each
// reports itself here while visible, so quieter moments such as coach marks
// (35-onboarding-v3.md) can wait their turn instead of stacking on top.
// Spec 34 replaces this with one ordered moment queue.
const active = new Set();
const listeners = new Set();

export function setMomentActive(name, on) {
  const had = active.has(name);
  if (on === had) return;
  if (on) active.add(name);
  else active.delete(name);
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getAnyActive() {
  return active.size > 0;
}

export function useAnyMomentActive() {
  return useSyncExternalStore(subscribe, getAnyActive);
}
