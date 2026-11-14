# 05: Alerts grouped on the shared rule

Spec: .claude/features/archive/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The bell's Alerts sheet grouped under Overdue, Budgets and Due soon, with budget alerts on the shared progress rule. Spec 49 §Alerts.

- A pure rule, `alertGroups({ bills, budgets, plans, today, plansOn })` → `[{ key, title, tone, alerts }]`, empty groups left out, moves the feed's logic out of the hook. Plans only while `FLAGS.plans` is on.
- Budgets use the shared progress rule (warn past 80 %, danger at 100 %) instead of the hook's own (warn at exactly 80 %, over only above 100 %). Ended custom budgets and paused bills stay out. Check every caller of the old budget status rule and the budget save toast first; switch a live caller to the shared rule, and leave a dead one for ticket 11.
- The ledger `Sheet` "Alerts": a `SectionHeader` per group (Overdue's title in danger), `ListRow`s with a danger or warn tinted circle, title, sub and chevron; a tap dismisses then routes. Empty: the ledger `EmptyState` with no object, "You're all caught up".
- The bell's dot reads the same rule.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The check script covers `alertGroups`: overdue and due-soon bills, paused bills nowhere, budgets at 80 % (none), 81 % (warn), 100 % (danger), an ended budget (none), plans only when on, empty groups left out, group order
- [x] The sheet shows the groups and each row opens its bill or budget
- [x] The empty state shows when nothing is due, and the bell's dot matches
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-14 (resolved): `alertGroups` in a new pure module (16 checks, 492 passing). Bills use `daysUntil`/`dueWording`; budgets use `budgetRowStatus`, so Alerts, the Budgets list and its bars share one rule (past 80 % warns, 100 % and over is danger; exactly 100 % reads "Used up"). Overdue, Budgets (worst first), Due soon (today to 3 days ahead, the old window), Plans only with the flag. Bill alerts carry the bill's own icon, as on Bills and the bills-due sheet. `useAlerts` returns `{ groups, count, loading }`, keyed by the day so it moves on at midnight; the bell dot reads `count`. The sheet is a ledger `Sheet`; a tap closes it, then routes. The ledger `EmptyState` takes `illustration={null}` for no object.
- The budget save toast (`lib/alerts.js`, used by the pay sheet) moved to the shared rule too, with "used up" at exactly 100 % and the period named ("this week" for a weekly budget). Still on the old rule, on purpose: `lib/analytics.js` for Insights' "Frequently over" (spec 48 kept Insights' rules as they were; spec 49 wrongly said nothing else used it). The old `budgetStatus` export stays for that; ticket 11 shouldn't delete it.
- Checked on Pixel_API_36 in light and dark: Overdue (Netflix with its film icon, Electricity) and Budgets (Lunch over by ₹150, Overall over by ₹134.50); a bill row opens its detail, a budget row opens its detail. Not seen on device: the empty state and a Due soon group (the test account always has overdue bills and over budgets, and nothing due in the next 3 days); both are covered by checks.

