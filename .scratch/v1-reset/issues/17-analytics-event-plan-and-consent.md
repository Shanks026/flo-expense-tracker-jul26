# Analytics event plan and consent placement

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: open
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
