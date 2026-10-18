# Analytics event plan and consent placement

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 02, 03

## Question

What does v1 measure, and where is analytics consent asked? This builds on the first-party Supabase `events` table decision ([10](10-analytics-posthog-vs-events-table.md)).

Grill:
- **Activation:** what counts as activation? For example, the first expense logged within 24h.
- **Retention:** what counts as retained? D1, D7 and D30 logging, weekly active loggers?
- **The event list:** what is on it, each with properties that carry no amounts or merchant data?
- **Funnel and retention views:** which SQL views over `events` we need, and how they're read (the Supabase dashboard is enough for v1).
- **Funnels and dashboards:** which ones decide whether a cut feature comes back (Plans, invites, economy)?
- **Consent placement:** where does the opt-in sit so the onboarding funnel stays visible? On the opener, or before Google?
- **Opt-out users:** what do we accept losing from users who say no?

Refs: audit §1 P0 instrument, §5 P0 analytics.

## Answer

Grilled with the user on 2026-10-18.

**1. Consent:**
- **On the opener:** one line with an **unticked** switch, "Share anonymous usage to help improve FLO".
- If it's on, events from before sign-in are queued on the phone and sent, tied to the user id, after sign-in.
- It can be changed anytime in Settings → Data & export.

**2. Metrics:**
- **Activation:** the first expense logged within **24 hours** of sign-up, including the onboarding one.
- **Retention:** D1, D7 and D30 on days with a log **or a no-spend day**.
- **North star:** **weekly active loggers**.

**3. Events.** None carry amounts, notes or merchant names.

| Group | Events |
|---|---|
| Onboarding and sign-up | `app_open`, `onboarding_step_viewed {step}`, `signup_completed {method}` |
| Logging | `expense_logged {source: manual\|share\|onboarding, category_was_prefilled}`, `no_spend_marked`, `share_import {result: parsed\|failed}` |
| Engagement | `nudge_opened {type}`, `recap_viewed`, `streak_milestone {days}`, `freeze_used` |
| Features | `feature_opened {budgets\|bills\|splits\|insights}` |
| Pro | `pro_sheet_viewed {trigger}`, `purchase_started {product}`, `purchase_completed {product}` |

**4. What the numbers decide:**
- **The economy returns** only if the streak alone shows weak D7.
- **Split invites** return on real repeat split use.
- **Plans/Goals** return if budget usage suggests demand for savings goals.
- **Billing tuning** follows Pro sheet → purchase conversion.

**5. Reading the numbers:** SQL views in Supabase (`security_invoker`), read in the Supabase dashboard, with no separate dashboard app:
- activation;
- D1, D7 and D30;
- weekly active loggers;
- the onboarding funnel;
- the share-import success rate;
- nudge → log conversion;
- Pro conversion.

**6. Retention:** events are kept **13 months**, then a pg_cron job deletes them. Users who say no to consent are not tracked at all.
