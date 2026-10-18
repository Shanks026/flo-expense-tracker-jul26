# Home, Insights and More: lean v1 information architecture

Status: ready-for-agent
Source: v1-reset map — [Home IA and tab structure](../../.scratch/v1-reset/issues/05-home-ia-and-tabs.md), [v1 scope for Plans, splits, multi-currency](../../.scratch/v1-reset/issues/07-v1-scope-plans-splits-currency.md)

## Problem Statement

About 14 places are one tap from Home: 3 tabs, a fake Menu tab opening a sheet, 3 header icon destinations and 2 header chips. Home's header shows 7 game controls before any money, then stacks up to 7 blocks. Transaction rows show the category twice and never the note. Reports and Analytics duplicate each other, and Settings is a 1,241-line catch-all with dev diagnostics. Plans overlap Budgets and Splits. The half-built split-sharing layer can double-count. A currency picker exists in an INR-only launch.

## Solution

**Tabs:** **Home · Transactions · (+) · Insights · More.**

**Home** answers "how am I doing this month?" in one glance. From the top:
1. the money hero;
2. the Today strip, with + Log, No spend today and a small Koban;
3. the 7-day chart;
4. the weekly recap card, in its week;
5. recent transactions, with the note as the title;
6. upcoming bills.

**Insights** is Analytics with Reports folded in.

**More** is a real screen: Budgets, Bills, Splits, Accounts, Categories, Settings, and Pro when billing is live. Settings is regrouped.

**Hidden in v1:**
- Plans, and Plans' collecting mode;
- split invites and join;
- the currency picker.

The hero gets an internal **skin slot** for post-launch seasonal skins.

## User Stories

1. As a user, I want five clear tabs with + in the centre, so that logging is always one tap away.
2. As a user, I want Home's header to show only the account switcher (with 2+ accounts) or the month, plus my streak and the bell, so that the top of Home is calm.
3. As a user, I want "Spent this month" as the biggest thing on Home, with "₹X left of budget" when I have a budget, so that I know where I stand instantly.
4. As a user, I want a Today strip showing whether I've logged today, with + Log and No spend today, so that today's habit is one tap.
5. As a user, I want a small Koban in the Today strip, so that Home has a bit of warmth away from the numbers.
6. As a user, I want the 7-day chart on Home, so that I see my week at a glance.
7. As a user, I want the chart to be 7 days only with no range toggle, and to open Insights when tapped, so that Home stays simple.
8. As a new user with no data, I want the chart replaced by "Log a few days to see your week", so that I don't see empty axes.
9. As a user, I want the weekly recap card on Home during the recap's week, so that last week's story is right there.
10. As a user, I want recent transactions titled by their note or merchant, with category and date underneath, so that I can recognise each one.
11. As a user with bills due soon, I want them listed on Home, and nothing when none are due, so that Home only shows what matters.
12. As a user, I want tapping my streak to open a simple streak screen, so that I can see my calendar and freezes.
13. As a user, I want the bell to hold budget warnings and alerts, so that saves aren't interrupted by toasts.
14. As a user, I want Insights with one Week / Month / Custom control, the recap summary, categories, trend and budget progress, so that all analysis lives in one place.
15. As a user, I want CSV export in Insights, so that I can take my data out.
16. As a user, I want More to list Budgets, Bills, Splits, Accounts, Categories and Settings, so that secondary features are easy to find without cluttering Home.
17. As a user, I want Settings in clear sections (Account, Appearance, Notifications, Preferences, Data & export, About), with Log out at the bottom, so that settings are easy to scan.
18. As a user, I want no developer diagnostics in Settings, so that the app looks finished.
19. As a user with one account, I want no account carousel or switcher, so that I'm not shown choices I don't have.
20. As a user with 2+ accounts, I want transfers available from Accounts, so that moving money between my accounts is still possible.
21. As a user, I want to create splits, add entries, settle and export, so that shared trips still work solo.
22. As a user, I want no invite or join options for splits yet, so that I can't create double-counted shared ledgers.
23. As a user, I want no Plans anywhere, so that budgets and splits are the only "where money belongs" concepts.
24. As the owner of my personal account, I want my existing plan and its linked transactions untouched, with those transactions shown normally, so that nothing is lost.
25. As a user in India, I want no currency picker, and new accounts in INR, so that setup is one less decision.
26. As a user with an existing non-INR account, I want it still shown in its own currency, so that old data stays correct.
27. As the person running FLO, I want the hero card built with a skin slot, so that seasonal skins can be added post-launch without a redesign.
28. As the person running FLO, I want `feature_opened` tracked for budgets, bills, splits and insights, so that I can see which secondary features earn their place.

## Implementation Decisions

**Tab bar:**
- the tab layout gets Home, Transactions, a centre + action (opens the Add sheet, not a route), Insights (the renamed Analytics route) and More (a new route);
- the fake Menu tab and the Menu sheet are removed;
- the tab bar meets the 48dp and labelled-button rules (spec 37).

**Home:**
- **header:** an account switcher (2+ accounts, otherwise the month name), the streak chip and the bell. Coins, freezes, level, Trophy and Shop are gone (also flagged off by spec 34).
- **Hero:** "Spent this month" on the emphasis surface, with "left of budget" when a budget covers the period. The hero renders through a **skin slot**: a `skin` prop resolved from data that defaults to the plain emphasis surface. Whatever the skin, **the money figure sits on a fixed-contrast plate (≥4.5:1)**.
- **Today strip:**
  - logged today ✓ or not;
  - **+ Log** (opens the Add sheet);
  - **No spend today** (writes the no-spend mark, spec 34);
  - a small Koban (spec 37);
  - it replaces TodayCard's receipt and XP framing.
- **7-day chart:** the existing daily chart, locked to 7 days, with the toggle removed. Tapping it opens Insights on Week. The empty state is text, not axes, and ticks are whole rupees.
- **Recap card:** shown Monday to Sunday of the recap week (data from spec 39). It opens the recap screen.
- **Recent transactions:** 5 rows. Title: note or merchant, otherwise the category. Subtitle: category · date. Amount with sign and label.
- **Upcoming bills:** only if any are due within the reminder window.
- **Removed:** ReportReadyCard and the hero carousel chrome with 1 account.

**Insights:**
- the Analytics route renamed;
- one period control: Week / Month / Custom;
- a recap summary at the top for the selected period;
- category breakdown, trend chart and budget progress;
- CSV export;
- Reports' screen and settings are retired, their logic folded in;
- the Pro gates on custom ranges, all-accounts view and CSV follow the `billing` flag (specs 32 and 41).

**More:** a grouped list: Budgets · Bills · Splits · Accounts · Categories · Settings, plus Pro when `billing` is on (spec 41).

**Settings:**
- **Account:** profile, sign-in methods.
- **Appearance:** System / Light / Dark (spec 37).
- **Notifications:** the three toggles (spec 39).
- **Preferences:** summary period.
- **Data & export:** CSV, analytics consent (spec 33), delete account.
- **About:** version, privacy policy link.
- **Log out** at the bottom.
- Dev rows render in development only (as spec 32).

**Flags** (the build-time flags module): **`plans: false`**, **`splitInvites: false`**, **`currencyPicker: false`**.
- **Plans:** the routes, menu entry, Add sheet control and collecting-mode default are hidden. Linked transactions render normally, with no plan badge.
- **Split invites:** the share/invite UI and the `/join/[code]` route are hidden. The split core stays.
- **Currency picker:** hidden; new accounts default to INR; existing account currencies display as stored.

**Transfers:** removed from the Add sheet's type toggle. Available from Accounts (each account's actions) only when 2+ accounts exist.

**Streak screen:** simplified per spec 34. The bell opens the alerts sheet, which now also receives budget warnings.

**Analytics:** `feature_opened {budgets|bills|splits|insights}` (spec 33).

## Testing Decisions

- **A good test** checks what's on screen and where things are reachable, in a fresh account and in a data-rich account.
- **Seam 1, the emulator:**
  - tab order and the + action;
  - the Home order top to bottom, in an empty and a populated account;
  - the hero "left of budget" appears only with a budget;
  - chart empty state, and tapping it opens Insights on Week;
  - the recap card appears only in the recap week;
  - transaction rows titled by note;
  - More reaches every secondary screen;
  - Settings sections in order, with Log out last;
  - no Plans, invites or currency picker anywhere;
  - transfers appear only with 2+ accounts;
  - check in both light and dark.
- **Seam 2, Supabase via MCP:**
  - the main personal account's plan and linked transactions are unchanged;
  - new accounts are created in INR;
  - `feature_opened` events land.
- **Prior art:** the existing Home, Analytics and Settings screens; feature 31's on-device split checklist (Phase 1–2 settling, still to tick).

## Out of Scope

- **The seasonal skin Store and admin portal** (post-launch). Only the skin slot ships.
- **Split settlement confirmation and the activity log** (needed before invites return).
- **Reports PDF export.**
- **Going global:** multi-currency UI and locale defaults.
- **The weekly recap's content and push:** spec 39. Only the card's placement is here.

## Further Notes

- This depends on spec 37's components and native headers, and uses spec 34's streak and spec 39's recap data.
- Finish feature 31's on-device settling checks as part of verifying the splits core.
