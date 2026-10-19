# 01: Consent-gated event pipeline with app_open

Spec: .claude/features/33-product-analytics.md

**What to build:** A signed-in user can turn "Share anonymous usage to help improve FLO" on or off in Settings, in a new **Data & export** section. The switch is off by default. While it's on, every app open writes one `app_open` event to a first-party `events` table in Supabase. While it's off, nothing is written. This ticket cuts the whole path:
- **Schema:** the `events` table as the spec defines it (user id defaulting to the signed-in user, cascade on account delete, name, small props, client and server times, app version, session id), indexed on name + time and on user + time.
- **RLS:** an authenticated user may insert only their own rows. There is no select, update or delete for clients.
- **Consent flag:** `profiles.analytics_consent` (default false) plus a timestamp of the last change.
- **Client wrapper:** a new `track(name, props)` module (`lib/track.js`, because `lib/analytics.js` is the chart-math module). It holds the fixed event vocabulary and drops unknown names and unexpected props. It never throws and never awaits on the UI path.
- **Hook:** a small hook that exposes the consent state and a setter.

Sending can be direct in this ticket; the persisted offline queue is ticket 02.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] With consent off (the default), opening the app and using it writes zero rows to `events`
- [x] Turning the switch on in Settings → Data & export writes `profiles.analytics_consent = true` with a change timestamp, and the next app open writes an `app_open` row with the user's id, app version and session id
- [x] Turning the switch off stops new rows immediately
- [ ] A `track` call with an unknown name, or with props outside the vocabulary, sends nothing extra: unknown names are dropped and unexpected props are stripped
- [ ] A failing insert (for example a bad network) shows no error and doesn't slow the UI
- [x] Via the Supabase MCP: an authenticated user can't select any `events` rows, even their own, and can't insert a row for another user
- [x] Via the Supabase MCP: deleting an account removes that user's `events` rows
- [x] No `props` value holds an amount, a note, a merchant name or a category name
- [x] The switch follows the active theme, and no third-party SDK is added
- [x] The 00-index schema notes and the spec's Database section record the new table and column

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-19: Built: `lib/track.js` (vocabulary, typed props, consent gate, session id), `hooks/useAnalyticsConsent.js`, `AnalyticsSync` in `app/_layout.js`, and the Settings → Data & export switch. Migration `product_analytics_events` applied. Via MCP in rolled-back transactions, these were rejected: a consent-off insert, an insert for another user, select, update, delete, an anon insert and oversized `props`. An own insert was allowed, with `user_id` filled by default. Events cascade with the auth user.
- 2026-10-19: Emulator (Medium_Phone_API_29, testtwo@gmail.com). Before the code-review fixes: consent off gave zero rows; turning it on gave one `app_open` per cold start and per return from the background; turning it off stopped new rows across a return and a cold start.
- 2026-10-19: Code review fixes:
  - one consent copy in `lib/track.js`, with `saveAnalyticsConsent` and `loadTrackingConsent` doing the writes and reads in lib;
  - a return only counts as an open after 30 s away, because Android reports deep links, the sign-in tab and dialogs as "background";
  - typed props, so no numeric strings get through;
  - a new session id on user change;
  - a failed write only reverts its own toggle.
- 2026-10-19: Re-checked after the fixes: consent off gave zero rows on a cold start; with the switch on, a 5 s trip away and the Settings deep link added nothing, and a 35 s trip added one `app_open`. Not re-checked after the fixes, because the emulator's bundle download from Metro kept failing (`ProtocolException: Expected leading [0-9a-fA-F] character`): the cold-start `app_open` with consent on, and switching off. Not exercised on the device: dropping unknown names and props, and a failing insert. Both are handled in code and shown no error.
- 2026-10-19: Committed as `4a888c1`. Verified stays open until those two emulator checks pass.
- 2026-10-19: Both remaining checks pass after a cold boot of the emulator and a Metro restart in CI mode (watch mode failed to start, which seems to be what broke the bundle download). With consent on, a cold start gave exactly one `app_open`. Switched off at 08:56:22 (`analytics_consent_changed_at` stamped): a 35 s trip away and a cold start added zero rows.
