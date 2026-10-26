// Transitional shim over lib/momentQueue.js (34-streak-only.md). The moment
// queue replaced this module; StreakCelebration still reports itself the old
// way, as a blocker that holds the queue while it's on screen, until ticket 06
// makes it a queue moment and this file goes.
import { setMomentBlocker, useAnyMomentActive, useOtherMomentActive } from './momentQueue';

export function setMomentActive(name, on) {
  setMomentBlocker(name, on);
}

export { useAnyMomentActive, useOtherMomentActive };
