# 03: Five tabs and the More screen

Spec: .claude/features/38-home-insights-more.md

**What to build:** The tab bar becomes **Home · Transactions · (+) · Insights · More**.
- The centre **+** opens the Add sheet. It is an action, not a route.
- **Insights** is the Analytics route renamed. Its content is unchanged for now (07 reworks it).
- **More** is a real screen with a grouped list: Budgets, Bills, Splits, Accounts, Categories, Settings, plus Pro when `billing` is on. Accounts points at the Accounts screen from 05; until then it opens the existing account switcher.
- The fake Menu tab and the Menu sheet are removed, along with Home's menu entry point.
- The tab bar meets spec 37's 48dp and labelled-button rules.
- `feature_opened` fires with `budgets`, `bills`, `splits` or `insights` when that screen opens (spec 33).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tabs in order Home, Transactions, +, Insights, More; + opens the Add sheet
- [ ] More reaches Budgets, Bills, Splits, Accounts, Categories and Settings; Pro shows only with `billing` on
- [ ] No Menu tab or Menu sheet remains
- [ ] Every tab target is at least 48dp and has an accessible label
- [ ] `feature_opened` events for budgets, bills, splits and insights land in `events` (MCP)
- [ ] Checked in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
