# 05: Alerts grouped on the shared rule

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The bell's Alerts sheet grouped under Overdue, Budgets and Due soon, with budget alerts on the shared progress rule. Spec 49 §Alerts.

- A pure rule, `alertGroups({ bills, budgets, plans, today, plansOn })` → `[{ key, title, tone, alerts }]`, empty groups left out, moves the feed's logic out of the hook. Plans only while `FLAGS.plans` is on.
- Budgets use the shared progress rule (warn past 80 %, danger at 100 %) instead of the hook's own (warn at exactly 80 %, over only above 100 %). Ended custom budgets and paused bills stay out. Check every caller of the old budget status rule and the budget save toast first; switch a live caller to the shared rule, and leave a dead one for ticket 11.
- The ledger `Sheet` "Alerts": a `SectionHeader` per group (Overdue's title in danger), `ListRow`s with a danger or warn tinted circle, title, sub and chevron; a tap dismisses then routes. Empty: the ledger `EmptyState` with no object, "You're all caught up".
- The bell's dot reads the same rule.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The check script covers `alertGroups`: overdue and due-soon bills, paused bills nowhere, budgets at 80 % (none), 81 % (warn), 100 % (danger), an ended budget (none), plans only when on, empty groups left out, group order
- [ ] The sheet shows the groups and each row opens its bill or budget
- [ ] The empty state shows when nothing is due, and the bell's dot matches
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
