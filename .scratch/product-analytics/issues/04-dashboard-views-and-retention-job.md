# 04: Dashboard views and the 13-month retention job

Spec: .claude/features/archive/33-product-analytics.md

**What to build:** The person running FLO opens the Supabase dashboard and reads the key numbers from ready-made views, with no separate tool. Seven `security_invoker` views over `events`:
- **activation:** a first `expense_logged` within 24 hours of `signup_completed`;
- **retention:** D1, D7 and D30, counted on days with a log or a no-spend day;
- **weekly active loggers:** the north-star number;
- **onboarding funnel:** by step;
- **share-import success rate:** parsed vs failed;
- **nudge → log conversion;**
- **Pro sheet → purchase conversion:** by trigger and by product.

A daily pg_cron job deletes events older than 13 months. Most of these events are emitted by other specs (34–41), so the views are built and checked against seeded rows.

**Blocked by:** 01 (Consent-gated event pipeline with app_open)

**Status:** ready-for-agent

- [x] All seven views exist with `security_invoker` set, and clients still can't read `events` through them
- [x] Against a seeded set of rows, every view's numbers match a hand count (recorded in a comment below)
- [x] Retention counts only log or no-spend days, not app opens
- [x] The retention job is scheduled daily in pg_cron, and running it deletes only rows older than 13 months
- [x] The seed rows are removed after verification
- [x] The spec's Database section and the 00-index schema notes record the views and the job

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-19: Migration `product_analytics_views` applied. It adds a private `analytics` schema that the Data API doesn't expose; all client grants and schema usage are revoked.
  - It holds 10 `security_invoker` views. Two are helpers (`logging_days` and `signups`). The rest cover the seven questions: `activation`, `retention`, `weekly_active_loggers`, `onboarding_funnel`, `share_import_success`, `nudge_conversion`, and Pro conversion split into `pro_conversion_by_trigger` and `pro_purchases_by_product`.
  - pg_cron job `events-retention` is active at `30 20 * * *` UTC (02:00 IST) and deletes by server `created_at`.
  - Security advisors show nothing new.
  - This is a Supabase-only change, so per the tracker doc it was verified via the Supabase MCP rather than on the emulator.
- 2026-10-19: Dry run against seeded rows, in a transaction that was rolled back, so no seed rows ever persisted. Four seed users signed up on 2026-09-01 at 10:00 IST. Hand count vs view, all matching:
  - activation: 4 signups, 2 activated (50.0). One user's first log came 25 h after signup and didn't count.
  - retention: D1 3/4 (75.0), D7 2/4 (50.0), D30 1/4 (25.0). The D1 count includes a log at 01:00 IST on 09-02, which is 09-01 in UTC, so local-day bucketing works. App opens don't count.
  - weekly active loggers: week of 08-31 = 3, 09-07 = 2, 09-28 = 1.
  - onboarding funnel: opener 4 (100), auth 3 (75), first_expense 2 (50), reminder_ask 1 (25).
  - share-import: 3 imports, 2 parsed, 1 failed (66.7).
  - nudge → log: 2 evening opens, 1 followed by a no-spend within 10 min (50.0).
  - Pro by trigger: budget_limit 2 viewers / 2 started / 1 completed; report_lock 1 / 0 / 0. That user's purchase start was in a later session, so it isn't attributed.
  - Pro by product: monthly 2 started / 1 completed (50.0); yearly 1 / 0 (0.0).
  - retention job: of rows created 14 and 12 months ago, only the 12-month one survived.
