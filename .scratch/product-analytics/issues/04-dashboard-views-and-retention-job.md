# 04: Dashboard views and the 13-month retention job

Spec: .claude/features/33-product-analytics.md

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

- [ ] All seven views exist with `security_invoker` set, and clients still can't read `events` through them
- [ ] Against a seeded set of rows, every view's numbers match a hand count (recorded in a comment below)
- [ ] Retention counts only log or no-spend days, not app opens
- [ ] The retention job is scheduled daily in pg_cron, and running it deletes only rows older than 13 months
- [ ] The seed rows are removed after verification
- [ ] The spec's Database section and the 00-index schema notes record the views and the job

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
