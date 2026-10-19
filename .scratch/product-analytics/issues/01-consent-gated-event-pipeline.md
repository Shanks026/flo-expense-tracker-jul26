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

- [ ] With consent off (the default), opening the app and using it writes zero rows to `events`
- [ ] Turning the switch on in Settings → Data & export writes `profiles.analytics_consent = true` with a change timestamp, and the next app open writes an `app_open` row with the user's id, app version and session id
- [ ] Turning the switch off stops new rows immediately
- [ ] A `track` call with an unknown name, or with props outside the vocabulary, sends nothing extra: unknown names are dropped and unexpected props are stripped
- [ ] A failing insert (for example a bad network) shows no error and doesn't slow the UI
- [ ] Via the Supabase MCP: an authenticated user can't select any `events` rows, even their own, and can't insert a row for another user
- [ ] Via the Supabase MCP: deleting an account removes that user's `events` rows
- [ ] No `props` value holds an amount, a note, a merchant name or a category name
- [ ] The switch follows the active theme, and no third-party SDK is added
- [ ] The 00-index schema notes and the spec's Database section record the new table and column

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
