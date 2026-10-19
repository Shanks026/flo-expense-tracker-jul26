# 02: Offline event queue

Spec: .claude/features/33-product-analytics.md

**What to build:** Events are never lost to a bad connection, and tracking never blocks logging. `track` adds consented events to a queue stored on the phone instead of sending them straight away.
- The queue batch-inserts on a timer and when the app goes to the background.
- A failed batch stays queued and retries silently, up to a limit.
- The queue has a size limit; past it, the oldest events are dropped.
- Turning consent off clears the queue and stops sending.

**Blocked by:** 01 (Consent-gated event pipeline with app_open)

**Status:** ready-for-agent

- [ ] With consent on, put the emulator offline, open the app several times, then come back online: the `app_open` rows arrive with their original client times
- [ ] Events queued before the app was killed are sent on the next launch
- [ ] A long offline stretch doesn't grow the queue past its limit, and nothing errors or slows down
- [ ] Turning consent off while events are queued means none of them arrive
- [ ] Batches are sent when the app goes to the background, not one request per event

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
