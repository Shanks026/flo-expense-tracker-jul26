# Product analytics (first-party events)

Status: ready-for-agent
Source: v1-reset map — [Analytics: PostHog vs a Supabase events table](../../.scratch/v1-reset/issues/10-analytics-posthog-vs-events-table.md), [Analytics event plan and consent](../../.scratch/v1-reset/issues/17-analytics-event-plan-and-consent.md)

## Problem Statement

Nothing in FLO is measured. The v1 reset is about to cut onboarding from about 32 screens to 4, shrink the game layer to a streak, change the Add sheet and change the notifications. Without numbers, there's no way to know whether any of it helps people **log their spending and keep coming back**, or which flagged-off feature deserves to return.

The person running FLO also wants:
- **no external third-party SDKs** (PostHog was explicitly ruled out);
- **opt-in consent** under India's DPDP Act;
- **no financial content** (amounts, notes, merchant names) ever leaving the ledger as an event.

## Solution

A first-party event pipeline inside Supabase:
- users opt in with one unticked switch on onboarding's opener (changeable later in Settings);
- consenting users' app events go into an `events` table;
- events contain names and small, content-free properties only;
- a handful of SQL views answer the questions that matter: activation, D1/D7/D30 retention, weekly active loggers, the onboarding funnel, share-import success, nudge → log conversion, and Pro conversion;
- events are deleted after 13 months, and immediately when the account is deleted.

## User Stories

1. As a new user, I want to see an unticked "Share anonymous usage to help improve FLO" switch on the first screen, so that I choose whether anything is collected.
2. As a new user who leaves the switch off, I want FLO to collect no usage events at all, so that my choice is respected.
3. As a new user who switches it on, I want my onboarding steps from before sign-in to count once I've signed in, so that the funnel reflects my journey.
4. As a user, I want to change my analytics choice anytime in Settings → Data & export, so that consent stays mine.
5. As a user who turns analytics off, I want collection to stop immediately, so that nothing more is sent.
6. As a user, I want no amount, note, merchant name or category name ever sent as an event, so that my financial life stays in the ledger.
7. As a user who deletes my account, I want my events deleted with it, so that nothing about me lingers.
8. As a user offline, I want events to wait on the phone and send later, so that tracking never blocks or slows logging.
9. As a user, I want tracking to never cause an error or a delay in the app, so that analytics is invisible.
10. As the person running FLO, I want to see the activation rate (first expense within 24 hours of sign-up), so that I know if onboarding works.
11. As the person running FLO, I want D1, D7 and D30 retention counted on days with a log or a no-spend day, so that I measure the habit, not opens.
12. As the person running FLO, I want weekly active loggers as the north-star number, so that one figure tells me whether FLO is working.
13. As the person running FLO, I want the onboarding funnel step by step, so that I can see where people drop.
14. As the person running FLO, I want to know whether an expense came from manual entry, share-import or onboarding, and whether its category was pre-filled, so that I can judge the fast paths.
15. As the person running FLO, I want how long saving took, from opening the Add sheet to Save, so that I can hold the 3-tap target.
16. As the person running FLO, I want the share-import success rate (parsed vs failed), so that I know where the parser needs work.
17. As the person running FLO, I want nudge → log conversion, so that I can tune the evening nudge and its back-off.
18. As the person running FLO, I want recap views, streak milestones and freezes used, so that I can tell whether the streak alone holds D7.
19. As the person running FLO, I want which secondary features get opened (budgets, bills, splits, insights), so that I can decide what returns or grows.
20. As the person running FLO, I want Pro sheet views by trigger, purchase starts and completions by product, so that I can tune pricing and gates.
21. As the person running FLO, I want to read all of this in the Supabase dashboard, so that there's no separate tool to run.
22. As the person running FLO, I want events older than 13 months deleted automatically, so that retention meets DPDP without manual work.
23. As the person running FLO, I want a user to be unable to read or edit anyone's events, so that the table can't leak.

## Implementation Decisions

**Schema** (live Supabase; follows the 00-index standing rules):
- **`events` table:** `id`, `user_id` (`DEFAULT auth.uid()`, FK → `auth.users` **ON DELETE CASCADE**), `name` (text), `props` (jsonb, small and content-free), `occurred_at` (client time), `created_at` (server time), `app_version`, `session_id`.
- Indexed on `(name, occurred_at)` and `(user_id, occurred_at)`.
- **RLS:** authenticated users may **insert only their own rows**. There's **no select, update or delete** for clients. The views and the dashboard read through the service role or owner.
- **Consent flag:** `profiles.analytics_consent` (boolean, default false), plus a timestamp of the last change. It's the source of truth across devices once the user signs in.

**Views** (`security_invoker`, so the dashboard reads with the owner's rights):
- activation (first `expense_logged` within 24 h of `signup_completed`);
- D1, D7 and D30 retention on log-or-no-spend days;
- weekly active loggers;
- the onboarding funnel;
- share-import success rate;
- nudge → log conversion;
- Pro sheet → purchase conversion.

**Retention:** a pg_cron job deletes events older than **13 months**, daily.

**Client wrapper (new module): `track(name, props)`.** Named `lib/track.js`, because `lib/analytics.js` already exists as the chart-math module.
- **The event vocabulary is fixed in one place:** `app_open`, `onboarding_step_viewed {step}`, `signup_completed {method}`, `expense_logged {source, category_was_prefilled, seconds_to_save}`, `no_spend_marked`, `share_import {result}`, `nudge_opened {type}`, `recap_viewed`, `streak_milestone {days}`, `freeze_used`, `feature_opened {feature}`, `pro_sheet_viewed {trigger}`, `purchase_started {product}`, `purchase_completed {product}`.
- **Unknown names and unexpected props are dropped,** so a careless call can't leak content.
- **Consent gate:** consent off or unknown means nothing is queued or sent.
- **Pre-sign-in queue:** with consent on but no session (the opener and Google step), events are queued locally. After sign-in they're flushed with the user's id, and consent is copied to the profile.
- **Offline queue:** events persist locally and batch-insert periodically and when the app backgrounds. Failures retry silently with a cap. The local queue is bounded.
- **Never throws, never awaits on the UI path.**
- **A small hook** exposes consent state and a setter for Settings and the opener.

**Call sites:** the specs that own each surface add their own `track` calls (onboarding, Add sheet, share-import, notifications, Pro). This spec adds `app_open`, the consent UI, and a reference call in one place to prove the pipeline end to end.

**Server-sent events:** nudge delivery stays in `reminder_sends`. `nudge_opened` is tracked client-side when a notification is tapped.

## Testing Decisions

- **A good test** checks what lands, or doesn't land, in `events` for a real user action, never the wrapper's internals.
- **Seam 1, the emulator** with the test account:
  - with consent off, perform actions and confirm zero rows;
  - turn consent on at the opener, sign in, and confirm the queued `onboarding_step_viewed` rows arrive with the user id;
  - go offline, log, come back online, and confirm the rows arrive;
  - toggle consent off in Settings and confirm nothing new arrives.
- **Seam 2, Supabase via MCP:**
  - confirm the RLS policies (an authenticated user can't select others' rows, or even their own);
  - confirm the cascade on account deletion;
  - run each view against seeded rows and check the numbers by hand;
  - confirm the retention cron is scheduled;
  - scan `props` for any amount or text field. There should be none.
- **Prior art:** `reminder_sends` and the `send-push` cron (feature 17) for server tables plus pg_cron, and the SECURITY/RLS checks in the P0 safety track.

## Out of Scope

- **Any third-party analytics SDK or service** (ruled out).
- **Session replay, autocapture of screens or taps,** and device fingerprinting.
- **A custom dashboard app.** The Supabase dashboard is enough for v1.
- **Analytics in the safe closed-test build:** this pipeline ships with the reset fix builds.
- **Per-screen instrumentation beyond the fixed vocabulary.**

## Further Notes

- The DPDP Rules' main obligations take effect around May 2027. Opt-in plus the 13-month retention already meets the expected bar, and Rule 8(3) requires keeping logs for at least a year.
- Opt-in will undercount the funnel. Accept it, and compare consenting cohorts with each other, not with installs.
- **Play Data safety:** declare "App interactions" as collected, **optional**, purpose Analytics, not shared (App content ticket).
- Whether an anonymous install id counts as personal data is unresolved. This design avoids the question by sending nothing before consent.
