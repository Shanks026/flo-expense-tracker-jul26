# 02: Offline event queue

Spec: .claude/features/33-product-analytics.md

**What to build:** Events are never lost to a bad connection, and tracking never blocks logging. `track` adds consented events to a queue stored on the phone instead of sending them straight away.
- The queue batch-inserts on a timer and when the app goes to the background.
- A failed batch stays queued and retries silently, up to a limit.
- The queue has a size limit; past it, the oldest events are dropped.
- Turning consent off clears the queue and stops sending.

**Blocked by:** 01 (Consent-gated event pipeline with app_open)

**Status:** ready-for-agent

- [x] With consent on, put the emulator offline, open the app several times, then come back online: the `app_open` rows arrive with their original client times
- [x] Events queued before the app was killed are sent on the next launch
- [ ] A long offline stretch doesn't grow the queue past its limit, and nothing errors or slows down
- [ ] Turning consent off while events are queued means none of them arrive
- [ ] Batches are sent when the app goes to the background, not one request per event

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-19: Built in `lib/track.js`:
  - `track()` now adds to a queue in AsyncStorage (`flo.trackQueue.v1`) instead of inserting directly.
  - Batches of up to 50 go up 5 s after tracking, when the app goes to the background (from `AnalyticsSync`), and once consent loads at launch.
  - A failed batch retries after 60 s; an event is dropped after 8 failed attempts. The queue holds at most 500 events, oldest dropped first.
  - Each entry carries its user id, so another account's events are dropped, not sent.
  - Turning consent off (in Settings, or read as off at launch) clears the queue.
- 2026-10-19: Emulator, testtwo@gmail.com, consent on.
  - Offline, two 45 s trips away, then the app killed while still offline. Back online, a cold start delivered both queued opens with their original client times (09:25:16 and 09:26:13), plus the new cold-start open, in one insert (all three share one `created_at`). The queue survived the kill and one failed launch.
  - An earlier run with 35 s trips lost one open to the 30 s threshold, because adb latency ate the margin. Not a queue bug.
- 2026-10-19: Code review fix, not yet tested on the emulator: the last consent the server confirmed is now cached per user (`flo.trackConsent.v1`). Before this, an offline cold start left consent "unknown = off" for the whole session, so offline logging recorded nothing. The cache also stops an account switched to while offline from inheriting the previous account's choice.
- 2026-10-19: Emulator checks paused at the person's request. Still open:
  - consent off while events are queued: one attempt was inconclusive, because the queued open went out about 1 s before the switch-off;
  - the background-triggered flush on its own, apart from the launch flush;
  - the queue limit, which is in code only;
  - an offline cold start using the cached consent.

  The device is left with consent on and one offline open queued (09:37), which goes out on the next launch.
