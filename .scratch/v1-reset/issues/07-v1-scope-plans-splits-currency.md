# v1 scope for Plans, split sharing and multi-currency

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 

## Question

Which secondary features are visible in v1?

The audit proposes:
- hide Plans (flag off, keep the code and data);
- keep the solo split core, but hide invites and join until settlement confirmation and the activity log exist;
- hide multi-currency for the India launch;
- defer Reports PDF export.

Grill each one:
- Is it in or out of v1?
- What does "hidden" mean for existing data?
- What is the trigger to re-enable it?

Refs: audit §2 feature status table, P1 Splits, P2 multi-currency/Plans/PDF, §5 feature-surface verdicts.

## Answer

Grilled with the user on 2026-10-18.

**1. Plans are flagged off in v1.**
- The main personal account's 1 plan, and any linked transactions, stay untouched.
- Linked transactions still show normally; only the plan link is hidden.
- Plans return post-launch only as a "Goals" decision, if analytics show demand.

**2. Collecting mode goes with Plans.** New expenses are never silently routed into a plan.

**3. Splits:**
- **The solo core stays visible:** create a split, add entries, settle, export. Its on-device checks get finished.
- **Invites and `/join/[code]` are flagged off** until the activity log is written and settlement confirmation is built.
- **Splits stay out of the Add sheet** until at least one split exists.

**4. Multi-currency is hidden.**
- No currency onboarding step (already deleted in [03](03-onboarding-target-flow.md)).
- The per-account currency picker is hidden, and new accounts default to INR.
- The data model stays; existing non-INR test accounts still show in their own currency.
- A visible currency choice returns only for a launch outside India.

**5. Reports PDF export stays deferred.** Whether CSV export is Pro-only follows [08](08-monetisation-timing.md).

**6. The other secondary features stay:**
- **Budgets, Bills, Categories** and **Summary period** are kept as they are.
- **Accounts:** multi-account stays, and the account carousel is hidden with a single account.
- **Transfers** come off the Add sheet type toggle and show only with 2+ accounts.

**7. No-spend day:** a one-tap **"No spend today"** replaces TodayCard's receipt and XP framing. It records an explicit no-spend day, which:
- **counts as a streak day** (this widens the streak rule from [02](02-gamification-scope.md));
- suppresses that evening's daily nudge ([06](06-notifications-and-weekly-recap.md)).
