# Home information architecture and tab structure

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 02, 07

## Question

What does Home show, top to bottom, and what are v1's top-level tabs?

The audit proposes that Home answers "how am I doing this month?" in one glance:
- a money-first header;
- one quiet streak indicator;
- no game controls.

It also proposes a lean IA with Insights and More, and splitting up the 1,241-line Settings.

Grill:
- What goes in the Home header?
- Which cards stay?
- What are the tabs, and in what order?
- Where do Budgets, Bills, Splits and Reports live?
- What moves into More, and what stays in Settings?

Refs: audit §1 P1 Home, §4 P1 Settings / P2 destinations, §5 Lean v1 IA.

## Answer

Grilled with the user on 2026-10-18.

**1. Tabs: Home · Transactions · (+) · Insights · More.** The centre + is the app's one verb. More is a real screen that replaces the fake Menu sheet. Analytics is renamed Insights.

**2. Home header:**
- the account switcher on the left, only with 2+ accounts (otherwise the month name);
- the **streak chip** and the **bell** on the right;
- nothing else.

**3 and 7. Home, top to bottom:**
1. **Spent this month:** the hero emphasis card, with "₹X left of budget" when a budget exists.
2. **Today strip:**
   - logged or not logged today;
   - a **+ Log** button;
   - **No spend today**;
   - a small Koban (a character moment, not a money figure).
3. **7-day chart:** kept on Home at the user's request.
   - 7 days only, with no 7D/1M/3M toggle;
   - tapping it opens Insights;
   - with no data it shows "Log a few days to see your week" instead of empty axes.
4. **Weekly recap card:** only during the recap's week.
5. **Recent transactions:** 5 rows, with the note or merchant as the title and the category and date underneath.
6. **Upcoming bills:** only if any are due.

ReportReadyCard is removed; the recap card replaces it.

**4. Insights:** Analytics with Reports folded in.
- one period control: **Week / Month / Custom**;
- the recap summary at the top;
- categories, the trend chart, and budget progress for the period;
- CSV export (whether it's Pro-only follows [08](08-monetisation-timing.md)).

**5. More:** Budgets · Bills · Splits · Accounts · Categories · Settings, plus Pro if [08](08-monetisation-timing.md) keeps it visible.
- **Settings sections:** Account · Appearance · Notifications · Preferences (summary period) · Data & export · About.
- **Log out** sits at the bottom.
- Dev-only rows are behind `__DEV__`.

**6. Header taps:**
- **Streak chip:** opens a simplified streak screen with the calendar, freezes held (0–2), and the next milestone.
- **Bell:** opens the alerts sheet. Budget warnings go there instead of showing as toasts on save.

**8–10. Seasonal card skins** (raised by the user while working this ticket):
- **Timing:** v1 ships the plain hero, but **the hero is built with a skin slot**. Seasonal skins (Christmas, World Cup, Easter and so on) are **the first feature after launch**.
- **The Store** sells single skins and seasonal bundles **for real money via Play Billing**, one-time purchases. No coins: the economy stays flagged off and coin packs stay cut.
- **An admin portal** will publish skins, themes, cards and bundles to the Store and set their prices. That's later, outside this map. It implies the skin slot renders skins from data, not from code shipped in a release.
- **Legibility rule:** a skin decorates only the hero card's background and edges. The rupee figure always sits on a fixed-contrast plate (≥4.5:1). Skins never appear on other money screens.
