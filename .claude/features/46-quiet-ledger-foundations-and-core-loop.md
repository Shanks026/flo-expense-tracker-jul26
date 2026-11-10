# Feature: Quiet Ledger redesign, Phases 1–2 (Foundations + Core loop)
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/46-quiet-ledger-foundations-and-core-loop.md`
**Status**: built (2026-11-11; all 12 tickets done, see `.scratch/quiet-ledger/handoff.md` for what each left unverified)
**Last Updated**: 2026-11-10
**Source of truth for the design**: `docs/redesign-plan.md` ("Quiet Ledger"). Where this spec and that document disagree on a visual detail, the document wins; where they disagree on scope, sequencing or data, this spec wins.

---

## Context

The redesign plan was written on 2026-11-09 and revised on 2026-11-10 after the first Home preview ran on the emulator. Its §7 splits the work into six phases. This spec covers **Phase 1 (Foundations)** and **Phase 2 (Core loop)** only. Phases 3–6 (Onboarding, Money screens, Moments and the rest, Polish) stay in the plan until they're reached.

Part of the foundation is already written, uncommitted, on `feat/spec44-ai-quick-add-voice`, and is **adopted as is, not redone**:
- the ledger tokens (`theme/ledger.js`) and the Inter font, loaded beside Manrope;
- `AmountText`, `Button`, `HeaderIconButton`, `ListRow` (with `toneColors`), `QuickActions`, `SectionHeader`, `AccountCardCarousel` and `WeekLine` under `components/ledger/`;
- the Day scenes (`lib/dayScenes.js`);
- the Home preview (`app/dev/home-preview.js`, Settings → Developer → Home preview), deleted in ticket 08 once the real Home moved onto the kit.

The old `WeekBars` was replaced by `WeekLine` and deleted.

Three decisions the plan left open were settled for this spec on 2026-11-10:
- **Tab names:** Transactions → **Activity** and More → **You**. Only the labels change; the routes stay.
- **Transaction detail:** built as planned (read first, then edit). The live `transactions` table has no `source` or `updated_at` column, so this spec adds both (§Database).
- **Test seams:** the Tracer emulator check per ticket, plus **one** node check script for pure rules (§Testing Decisions).

---

## Phase Overview

```
Phase 1 — Foundations
  Finish the token set, add FLAGS.accents (off), delete Koban, build
  the ten missing kit components, make Day the free default card theme, apply
  the paise rule, and rebuild the Ask FLO proposal card and Settings on the
  kit as the proving ground.

Phase 2 — Core loop
  Home (from the preview), the tab bar, the Add sheet, Activity (search and
  filters), and the new Transaction detail screen, with the source and
  updated_at columns behind it.
```

**After each phase: stop and wait for approval before proceeding.** Each phase is cut into tickets by `/to-tickets`. Each screen moves over in its own ticket, so the app keeps working between tickets.

---

## Problem Statement

Today FLO looks like a game, not a ledger. Almost everything is a rounded card on a grey background, so every screen reads at the same volume. The lime accent fills buttons, chips, tabs, bars and the + button, so nothing stands out. Type is extra-bold everywhere, buttons are chunky 56 dp pills, icons sit on filled square tiles, and emoji and a cartoon cat appear on everyday screens.

The chrome is inconsistent: some screens have a boxed back button and others a native arrow, and some sheets have an X while others don't. Amounts change size and weight between screens, paise show in some places and not others, and columns don't line up.

The core loop shows these problems most, because it's the part used every day:
- the Home hero is a card stack with no clear first read;
- the Add sheet's fields are in a 3-tap-era order;
- Transactions has month arrows and type pills but no search;
- tapping an entry drops straight into an edit sheet, so it's easy to change something by accident;
- nothing shows where an entry came from (typed, voice, Ask FLO, a share, auto-detect).

## Solution

A clean white ledger where the money is the loudest thing on screen. It's neutral black and white, with colour only where it means something:
- green for money in;
- red for overdue and over budget;
- one static blue for charts and progress;
- category tints in a circle behind each icon.

Lists sit flat on the canvas with hairline dividers, and every screen uses the same header, back button, sheet and pinned footer. The themed account card stays the one decorative object, and its free default becomes **Day**: four landscapes that follow the local time.

Phase 1 builds the shared kit beside the old components and proves it on two contained screens: the Ask FLO proposal card and Settings. Phase 2 moves the daily loop onto it:
- **Home:** the greeting, the account card with the balance under it, quick actions, the Today prompt, the This week row, upcoming bills and recent activity;
- **the Add sheet:** reordered, with a centred amount;
- **Activity:** search, filter chips and a one-line summary;
- **Transaction detail (new):** read first, see where the entry came from and what happened to it, then edit or delete.

Every feature stays. Flagged-off features keep their flags and get the same look, so turning one back on doesn't look out of place.

## User Stories

### Look and feel (Phase 1)
1. As a FLO user, I want every screen on a pure white canvas (near-black in dark mode), so that the app reads as calm and money-first.
2. As a FLO user, I want the main money figure on every screen to be the largest text, in tabular figures, so that I find it first and columns line up.
3. As a FLO user, I want paise shown only when they're non-zero, the same way everywhere (card included), so that ₹1,200 and ₹1,367.60 both read as complete numbers.
4. As a FLO user, I want money in shown as "+" in green and money out as "−" in ink, so that red only ever means a warning.
5. As a FLO user, I want a negative balance shown as "−" in red, so that I notice I'm overdrawn.
6. As a FLO user, I want primary buttons to be solid ink with white text (white with black text in dark mode), so that the one action that matters is obvious.
7. As a FLO user, I want secondary actions outlined or as plain text, so that they don't compete with the primary.
8. As a FLO user, I want destructive actions as a pale-red pill, so that I can tell Delete apart before I tap it.
9. As a FLO user, I want every category icon in a circle washed in that category's colour, so that I can scan a list by colour without loud tiles.
10. As a FLO user, I want sentence-case headers and no uppercase captions, so that labels read quietly.
11. As a FLO user, I want the same circle back button and header on every screen I open, so that I always know how to go back.
12. As a FLO user, I want every bottom sheet to have the same handle, title row and circle X, so that sheets behave predictably.
13. As a FLO user, I want the main action on a form pinned to the bottom above the keyboard and safe area, so that I can always reach Save.
14. As a FLO user, I want info, warning and danger notes as one-line callouts with an icon, so that advice doesn't look like data.
15. As a FLO user, I want progress shown as a thin blue bar that turns amber past 80 % and red at 100 % (amended 2026-11-10: a budget spent to its limit is red), so that I can read a budget at a glance.
16. As a FLO user, I want choices like Expense/Income as a segmented control with a white thumb on a grey track, so that the selected option is clear without colour.
17. As a FLO user, I want filter and category chips outlined, and filled ink when selected, so that the selection is clear without the accent.
18. As a FLO user, I want empty screens to show one small object, one title, one line and at most one button, so that an empty state helps without lecturing.
19. As a FLO user, I want the cartoon cat gone from everyday screens, so that the app feels like a finance tool.
20. As a FLO user who once picked an accent colour, I want my choice remembered even though the picker is hidden, so that it comes back if the picker returns.
21. As a FLO user, I want lime gone from the redesigned screens, so that nothing competes with my card.
22. As a FLO user who never picked a card, I want the free default card to be a Day landscape that changes with the time of day, so that Home feels alive without me doing anything.
23. As a FLO user who equipped a theme or seasonal skin, I want it to keep replacing the Day card, so that my choice wins.
24. As a FLO user who explicitly chose Ink, I want Ink to stay selectable and stay mine, so that the plain card is still an option.
25. As a FLO user with Reduce motion on, I want nothing to animate, so that the app respects my setting.

### Proving ground (Phase 1)
26. As an Ask FLO user, I want a proposal (budget, bill, entry) shown as the one card on the chat screen, with Review as the primary and Dismiss as a quiet button, so that I know it needs my decision.
27. As an Ask FLO user, I want a saved proposal to show "Saved ✓" as a green caption, so that I know it went through.
28. As a FLO user, I want Settings as flat grouped rows under sentence-case section headers, with switches right-aligned, so that it's quick to scan.
29. As a FLO user, I want Appearance (System / Light / Dark) as a segmented control, so that I change mode in one tap.
30. As a FLO user, I want the battery advice in Settings as a warning callout, so that I notice it without a wall of text.
31. As a FLO user, I want Delete account as a danger row at the bottom above Log out, so that I can't hit it by accident.
32. As the developer, I want the Developer section in Settings only in dev builds, so that testers never see it.
33. As a FLO user, I want every Settings feature (notifications, summary period, voice language, detection, consent, export all, delete account, log out, currency when its flag is on) still there, so that nothing is lost in the restyle.

### Home (Phase 2)
34. As a FLO user, I want Home to greet me for the time of day with today's date under it, so that the screen feels personal and current.
35. As a FLO user, I want the streak, Ask FLO and alerts as three circle icons in Home's header, so that they're one tap away without clutter.
36. As a FLO user with a streak, I want the flame filled orange only when today already counts, so that I know whether I've logged today.
37. As a FLO user with unread alerts, I want a dot on the bell, so that I know there's something to see.
38. As a FLO user, I want my account's themed card at the top of Home, showing its name (and last 4 when set), so that I know which account I'm looking at.
39. As a FLO user, I want my in-hand balance as the largest text under the card, with "₹X in · ₹Y out this month" under it (the period follows Settings → Summary period: "this quarter", "this year", "since 3 Nov"), so that I know where I stand in one look.
40. As a FLO user, I want the balance to count up on the first load of the day only, so that it feels alive once without being slow every time.
41. As a FLO user with several accounts, I want to swipe the card to switch accounts, with dots under it, so that switching is quick.
42. As a FLO user, I want the card's chevron to open the account switcher sheet, so that I can jump to any account.
43. As a FLO user, I want a one-time, dismissible "New: <skin> card" row when a seasonal skin is live and I haven't equipped it, so that I hear about new cards without being nagged.
44. As a FLO user, I want Add, Transfer and Ask FLO as three quick-action tiles, so that my common actions are big targets.
45. As a FLO user with only one account, I want no Transfer tile, so that I don't see an action I can't use.
46. As a FLO user who hasn't logged anything today, I want a "Nothing logged today" row with a compact No spend button, so that I can keep my streak in one tap.
47. As a FLO user, I want one "Last 7 days" row with that spend' spend and the daily average, so that I get the number without a chart taking half the screen. Under the amount, a TrendingUp (red) or TrendingDown (green) icon and the % change against the 7 days before; "About the same" in grey under 5 %, and nothing when the 7 days before had under ₹100 (`lib/weekChange.js`). *(Changed 2026-11-10: the week line chart left Home. Kit and Wise keep charts a tap away from their money screens.)*
48. *(Dropped 2026-11-10 with the chart: tapping a day. Insights' Week view does this.)*
49. As a FLO user, I want the This week row to open Insights on the Week view, so that I can dig deeper.
50. As a FLO user with nothing spent in the last 7 days, I want the row to say "Nothing spent in the last 7 days", so that the empty state is honest.
51. As a FLO user with bills due soon, I want up to two upcoming bills on Home with "See all", so that I'm reminded without the full list.
52. As a FLO user with an overdue bill, I want its circle and caption in red, so that it stands out.
53. As a FLO user with no bills due in the window, I want no bills block at all, so that Home stays short.
54. As a FLO user, I want recent activity date-grouped ("Today", "Yesterday", "Sat 7 Nov"), so that I can find an entry by when it happened.
55. As a FLO user, I want each recent row to show the note (or merchant) as the title and the category as the sub, without repeating the category when there's no note, so that rows aren't redundant.
56. As a FLO user, I want "See all" on recent activity to open Activity, so that the full list is one tap away.
57. As a FLO user, I want the card skeleton to have the card's shape while loading, and never a ₹0 balance, so that loading never looks like wrong data.
58. As a FLO user, I want pull-to-refresh on Home to keep working, so that I can force fresh numbers.
59. As a new FLO user, I want the + coach mark to still point at the + button once, so that I learn how to add.

### Tab bar (Phase 2)
60. As a FLO user, I want the tabs labelled Home, Activity, Insights and You, with an ink + in the middle, so that the bar matches the new look.
61. As a FLO user, I want long-press on + to still open the Add sheet listening, so that voice add is still one gesture.

### Add sheet (Phase 2)
62. As a FLO user, I want the quick-add line with its mic at the top of the Add sheet, so that typing or saying an entry is the first option.
63. As a FLO user, I want Expense | Income as a segmented control under it, so that switching type is one tap.
64. As a FLO user, I want a large centred amount with a blinking caret and a muted ₹, so that the number I'm entering is the focus.
65. As a FLO user, I want categories as a swipeable row of circle chips, with the selected one an ink circle and a white icon, so that I can pick a category with my thumb.
66. As a FLO user, I want Today, Yesterday and Pick a date chips, so that backdating is quick.
67. As a FLO user, I want the Note row, then the Account row (only with 2+ accounts), then the split row (only with open splits), so that optional fields don't crowd the form.
68. As a FLO user, I want Save pinned at the bottom above the keyboard, so that I can save without dismissing it.
69. As a FLO user, I want the save toast "Logged ₹120 · Food" with Undo to appear without sliding in, so that a fast Undo tap always lands.
70. As a FLO user editing an existing entry or transfer, I want the same sheet, pre-filled, so that editing works as before.
71. As an Ask FLO, share-to-FLO or auto-detect user, I want the pre-filled Add sheet to look the same as a manual one, so that I review every source the same way.
72. As a FLO user on the free plan, I want the existing Pro gates to behave as before, so that nothing changes in what I can do.

### Activity (Phase 2)
73. As a FLO user, I want the Transactions tab called Activity, so that it matches what it shows.
74. As a FLO user, I want a search field at the top of Activity that matches the note, category name and amount, so that I can find one entry fast.
75. As a FLO user, I want filter chips for Type, Category, Account and Date range, so that I can narrow the list without month arrows and pills.
76. As a FLO user, I want each filter chip to show its current value and open a sheet to change it, so that I can see what's applied.
77. As a FLO user, I want Activity to start on this month and my active account, so that the default matches Home.
78. As a FLO user, I want an "All accounts" option in the Account filter, so that I can search across accounts.
79. As a FLO user, I want a one-line "Spent ₹X · Received ₹Y" summary for the current filter, so that I see the total of what I'm looking at.
80. As a FLO user, I want transfers excluded from Spent and Received, so that moving money between my accounts doesn't count as spending.
81. As a FLO user, I want a transfer shown as one ⇄ row ("Personal → Savings") instead of two legs, so that the list isn't doubled.
82. As a FLO user, I want the list date-grouped like Home, so that both lists read the same.
83. As a FLO user with no matches, I want an empty state with the receipt object and a way to clear filters, so that I'm not stuck.

### Transaction detail (Phase 2)
84. As a FLO user, I want tapping an entry on Home or Activity to open a read-only detail screen, so that I can't change something by accident.
85. As a FLO user, I want the detail's top band to show the category circle, a large amount (+ green for income), the title, then the date and account, so that the key facts come first.
86. As a FLO user, I want a Details | History segmented control on the detail screen, so that the facts and the story are both there without crowding.
87. As a FLO user, I want Details to list category, account, date, note, the split it's in (as a link), and where it came from, so that I understand the entry fully.
88. As a FLO user, I want to see whether an entry was typed, quick-added, spoken, proposed by Ask FLO, shared in, auto-detected, or created by a bill, split or transfer, so that I can trust or question it.
89. As a FLO user, I want older entries with no recorded source to simply not show a source line, so that FLO never guesses.
90. As a FLO user, I want History as a timeline (created, last edited, added to a split), so that I can see what happened to an entry.
91. As a FLO user, I want an entry I've never edited to show only "Created", so that the timeline doesn't invent events.
92. As a FLO user, I want Edit as the pinned primary, opening the existing edit sheet, so that editing is still one tap away.
93. As a FLO user, I want Delete as a danger pill that asks me to confirm, so that deleting is deliberate.
94. As a FLO user deleting a transfer, I want both legs deleted together, so that my balances stay right.
95. As a FLO user deleting an entry linked to a split, I want the split entry to stay, so that what others rely on isn't lost.
96. As a FLO user, I want the detail to refresh after I edit, so that it shows what I just saved.
97. As a FLO user viewing a transfer, I want "From Personal → To Savings" in the same layout, so that transfers read naturally.
98. As a FLO user, I want the split link in Details to open that split, so that I can jump to it.
99. As a FLO user, I want the back button to return me to the list where I was, so that I don't lose my place or filters.

### Flags and the developer (both phases)
100. As the developer, I want `FLAGS.accents` (off) to hide the accent picker while keeping the code and stored `theme_accent`, so that "flagged off" never means deleted.
101. As the developer, I want Koban deleted (code, poses and dev gallery), with each of his places showing an `Illustration` object or nothing, so that no placeholder cartoon is left in the app.
102. As the developer, I want `economy`, `plans`, `billing`, `splitInvites` and `currencyPicker` to keep working exactly as now on every moved screen, so that the restyle changes no behaviour.
103. As the developer, I want the old components left in place until the last screen moves, so that unmoved screens keep working between tickets.
104. As the developer, I want one node check script for the pure rules, so that I can check money formatting, grouping, filtering and history without the app.
105. As the developer, I want each ticket verified on Pixel_API_36 in light and dark mode, so that "done" means seen on the device.

## Implementation Decisions

### Approach
- **Beside, not instead.** The ledger tokens and components live beside `theme/tokens.js` and the old components. A screen moves only in its own ticket, and nothing global is restyled at once. Manrope, the old tokens and every retired component are removed in **one cleanup ticket after the last screen of Phase 5 has moved**, not in this spec.
- **Read and write shapes are unchanged.** Read hooks keep the `version` / `activeAccountId` / `{ data, loading, refetch }` shape, and mutations stay in `lib/` with `notifyChanged()` afterwards. The redesign is presentational except for the Database changes below and two read helpers for Activity and Transaction detail.
- **Pure rules live in plain modules.** Anything the check script tests sits in a `lib/` module that imports nothing from React Native, Expo or Supabase, so node can load it. Components call these modules; they don't re-implement the rules.
- **Inventory names files on purpose.** The component inventory below names the old files each new piece retires, as the plan's §8 handoff asks. Everywhere else, modules are described by role.

### Tokens and type (Phase 1)
- The ledger palette, type scale, spacing, radii and sizes as already in `theme/ledger.js` are the source of truth (plan §2.2–2.4). Phase 1 adds what's missing:
  - `accent` as the public name for the one accent colour (`chart` and `highlight` stay as aliases). Since ticket 12 (2026-11-10) it is a muted olive, `#76952B` light (lightened from `#5F7A1F` on the person's ask; 3.44:1 on white, 3.12:1 on sunk, so graphics only) / `#B5CC6A` dark, with an `accentSoft` fill (`#E9F0D2` / `#2A3315`);
  - **olive rule:** the accent is decoration and meaning only (chart lines and fills, progress, selection marks, the switch, the caret, soft info fills). It is never a button fill or a primary action (those stay ink), and never text on white at body size. Text on `accentSoft` is ink, not muted (muted is 4.46:1 there), and a soft fill that marks a boundary keeps a hairline. On the dark olive track the switch knob is dark (`knobOn`); white fails at 1.78:1;
  - **income green:** `positive` is a deep cash green, `#166534` light / `#3FB97A` dark (the person's choice on 2026-11-10: income stays green, darker, apart from the olive). The pairs are checked against WCAG AA in `scripts/ledger-check.mjs`;
  - `streak` orange;
  - a `ledgerType` entry for the greeting (18/24/600) and the quick-action label (12/16/500).
- The `upper` helper is removed from use (no uppercase captions).
- `useLedger()` ignores the accent axis. The palette depends only on the mode.
- Inter weights 400, 500, 600 and 700 only. 700 is for money heroes and brand moments.
- **Paise rule:** the existing "fraction only when non-zero, then both digits" behaviour in the currency module becomes the only display path:
  - every amount on a moved screen renders through `AmountText`, or through the currency formatter for inline strings;
  - no moved screen calls `Math.round` (or `toFixed`) on money for display;
  - the Home card follows the same rule.
- The sign and tone logic in `AmountText` is extracted into a pure function in the currency module. It takes a value, type and signed flag and returns `{ sign, tone, text }` (tone is one of `positive`, `ink` or `danger`). `AmountText` maps the tone to a palette colour.

### Flags (Phase 1)
- **`FLAGS.accents`**, off:
  - the accent swatches are hidden in Personalize;
  - the stored `profiles.theme_accent` is neither read nor written;
  - unmoved old-token screens resolve the default accent until they move.
  - Turning it on later lets the choice repaint `accent` only (never the primary).
- **Koban is deleted (decided 2026-11-10, replacing the planned `FLAGS.mascot`):**
  - his component, art, faces, poses and the dev gallery are removed, with no flag;
  - each call site changes directly: the onboarding opener, the share-usage ask, streak celebrations and the old `EmptyState` show an `Illustration` object (the old `EmptyState` maps the pose its callers pass to the nearest object); the coach mark, the nothing-logged card and the streak hero show no art;
  - the streak copy helpers in `lib/koban.js` are text and stay.
  - Phases 3 and 5 replace those call sites properly.
- Existing flags are respected on every moved screen:
  - `economy`: no coins, XP or rank on Home or in Settings;
  - `plans`: no plan badges on rows, no plan link in Details;
  - `billing`: no Pro badge or upsell surfaces while off, gates pass;
  - `splitInvites`: unchanged;
  - `currencyPicker`: the Settings currency row is hidden, and stored currencies still display;
  - `themes`: card themes render;
  - `themeGating`: off;
  - `ai`: when off, there's no Ask FLO icon, quick action, quick-add line, mic or `ai` source label.

### Component inventory
Built components are adopted. "Retires" means the old file stops being used by moved screens and is deleted in the cleanup ticket once nothing imports it.

| Component | Status | Replaces / retires | Shape and contract | Flags |
|---|---|---|---|---|
| `ScreenHeader` | new (P1) | `BackButton`, boxed `IconButton` back buttons, mixed native headers | 40 dp circle back button; optional left-aligned large title that collapses into the bar on scroll; up to two circle icon actions on the right (uses `HeaderIconButton`) | — |
| `Button` | built | `components/Button.js` | `primary` / `secondary` / `quiet` / `danger`, 52 dp, weight 600; `compact` 34 dp with hitSlop. Phase 1 drops the underline on `quiet` | — |
| `HeaderIconButton` | built | `IconButton` in headers | 40 dp circle icon, optional dot | — |
| `PinnedFooter` | new (P1) | each screen's and sheet's own footer | a full-width primary, plus an optional secondary side by side; safe-area inset; rises with the keyboard | — |
| `ListRow` | built | `Row.js`, `IconTile` rows, bespoke transaction/settings/bill rows | 40 dp tinted circle icon, title and sub, right value and sub, chevron or switch slot, hairline divider. Phase 1 adds a `trailing` slot (chevron, switch, check, compact button) | — |
| `SectionHeader` | built | assorted group titles | 16/600 sentence-case ink title plus an optional right action ("See all") or node | — |
| `AmountText` | built | `components/AmountText.js`, inline money texts | `display` / `title` / `row`, tabular, sign rule, paise rule; reads the pure sign/tone function | `currencyPicker` (shows the stored currency) |
| `Segmented` | new (P1) | `SegmentedChoice`, the Expense/Income pills, `AppearanceToggle` | a sunk track with a white (dark: `surface`) thumb; 2–4 options; controlled `value` / `onChange`; 48 dp target | — |
| `Chip` | new (P1) | `Pill`, the filter pills | outlined pill; selected = ink fill with `inkOnInk` text; optional leading icon and trailing ▾ for filter chips; 48 dp target via hitSlop | — |
| `Callout` | new (P1) | ad-hoc info cards and paragraph rows | `info` (sunk), `warn` (warnSoft), `danger` (dangerSoft); icon plus one line, optional action | — |
| `ProgressBar` | new (P1) | `components/ProgressBar.js` | 4 dp, `accent` on a `surfaceSunk` track; `warn` past 80 %, `danger` from 100 % (amended 2026-11-10; was "past 100 %") | — |
| `Timeline` | new (P1) | — | a vertical step list: a dot per step, a title, a muted time/sub, a connecting hairline; the last step has no line | — |
| `Illustration` | new (P1) | Koban on everyday screens, emoji art | named objects `coins`, `token`, `whistle`, `calendar`, `receipt`, `spark`, `trophy`; sizes `small` / `large`. **Until the 3D assets exist** (plan §6 open item 2), each name renders a lucide glyph in a large sunk circle. Swapping in the PNG/WebP files later is a data change inside this component only | — |
| `EmptyState` | new (P1) | `components/EmptyState.js` (Koban) | small `Illustration`, a title, one line, an optional secondary button | — |
| `Sheet` | new (P1) | the per-sheet chrome inside every `Add*Sheet` | wraps `@gorhom/bottom-sheet`: one handle, a title row with a circle X, a scrollable body, a `PinnedFooter`; radius 20; a soft shadow in light mode, a hairline top edge in dark mode. **Keeps the existing `<XSheetProvider>` + `useXSheet()` opener pattern**: `Sheet` is the visual shell inside each provider, not a new provider | — |
| `QuickActions` | built | Home's action buttons | three equal 64 dp sunk tiles; hides Transfer with fewer than 2 accounts | `ai` |
| ~~`WeekLine`~~ | deleted 2026-11-10 (Home shows a This week `ListRow` instead) | `IncomeExpenseChart` / daily bars on Home | line plus area in `accent`, dotted average, today's dot, tap a day for its total, empty-week note | — |
| `AccountCardCarousel` | built | `AccountHeroCarousel`, `AccountDots` | 2:1 themed card, name, optional `•••• last4` (spec 45), swipe, dots, card-shaped skeleton | `themes` |
| Today prompt | new (P2), a `ListRow` composition | `NothingLoggedCard` | a bordered row "Nothing logged today" with a compact No spend button; shown only while nothing is logged today | — |
| Tab bar | restyled (P2) | `components/TabBar.js` look | ink + button; labels Home, Activity, Insights, You; long-press + unchanged | — |
| Toast | restyled (P2) | `components/Toast.js` entrance | fades in place, no slide; Undo stays | — |
| `ProposalCard` | restyled (P1) | its `Card` usage | the one `surface` card with a hairline border; Review primary, Dismiss quiet, "Saved ✓" positive caption | `ai` |

### Day as the free default card (Phase 1)
- The card theme catalog gains a free **`day`** theme. It renders the scene for the current period (morning 5–12, afternoon 12–17, evening 17–20, night 20–5) from the Day scenes module, and re-resolves when Home regains focus.
- A profile with **no equipped theme** (`equipped_card_theme` null) resolves to `day`. An explicitly equipped `ink` stays Ink. Ink stays selectable in Personalize, and Day is listed first.
- No database change. `day` is just a new valid value for `equipped_card_theme`.

### Proving ground (Phase 1)
- **Ask FLO proposal card:** rebuilt on `Button`, `ListRow` and `AmountText`. Its behaviour is unchanged: Review opens the pre-filled sheet, Dismiss hides it, and saved proposals show the positive caption. The rest of the chat screen moves in Phase 5.
- **Settings:** rebuilt on `ScreenHeader`, `SectionHeader`, `ListRow` (with switch and chevron trailing), `Segmented` for Appearance, `Callout` (warn) for the battery advice, and a danger row for Delete account above Log out. Every row and its behaviour carries over. Developer rows appear only in dev builds; this includes the Home preview entry, which is removed once Home has moved.

### Home (Phase 2)
- Built from the preview's composition. The order is header → account card → balance block → quick actions (12 below) → Today prompt → This week → Upcoming bills → Recent activity, with 24 between blocks and a 20 gutter.
- **Data:** the existing read hooks only (account summaries, spending trend, transactions with a limit, bills, alerts, streak). No new queries.
  - The in-hand balance is the transfer-aware `in_hand_balance` already used.
  - "In · out" is the income and expense for the profile's summary period (Settings → Summary period), labelled to match: "this month" for the default Monthly, "this quarter", "this year", or "since <date>" for Custom. Decided 2026-11-10 (ticket 08); it reuses the summaries hook's totals, so no new query.
  - It never shows ₹0 while loading.
- **Count-up:** the balance counts up only on the first Home load of the local day, gated by a stored last-count-up date. Reduce motion skips it.
- **Seasonal row:** shown when a seasonal skin is live and not equipped, until dismissed. Dismissal is stored on the device per skin.
- **Removed from Home:** Koban, `NothingLoggedCard`, the `Card` stack, and the streak-chip coach mark (the + coach mark stays).
- The Home preview dev route is deleted when Home ships.

### Add sheet (Phase 2)
- The same provider and opener (including long-press-to-listen and every pre-fill entry point: Ask FLO proposals, share-to-FLO, auto-detect, the first-expense step, edit).
- The field order and controls follow plan §4 "Add sheet". The save, undo, transfer-edit, split-link and Pro-gate logic is untouched.
- The sheet now records how the entry arrived as `source` on insert (§Database). An edit never changes `source`.

### Activity (Phase 2)
- The Transactions tab route is unchanged; its label becomes **Activity**, and More's becomes **You** (the You screen's restyle is Phase 5).
- **Filters:** `{ search, type: all|expense|income|transfer, categoryId|null, accountId|'all', range: {from, to} }`.
  - Default: this calendar month, the active account, all types.
  - Each chip opens a `Sheet`. Date range offers This month, Last month, Last 30 days and Custom (two dates).
- **Read helper:** an Activity hook fetches by account (or all of the user's accounts) and date range from Supabase. Search, type and category are applied client-side by a pure filter function, then a pure summary and a pure transfer-pairing function run on the result.
  - Search matches the note, category name and amount text (case-insensitive; an amount query matches "120" against 120 and 1,200.00 only as a prefix of the formatted number).
  - The summary's Spent is the sum of expenses and Received the sum of income. Transfers and settlements are excluded.
  - Pairing joins two legs that share a `transfer_id` into one row ("From → To"). When only one leg is in view (a single-account filter), it shows that leg as a ⇄ row with the other account named.
- Filters live in the screen's state, so returning from Transaction detail keeps them.
- **Date groups:** a pure function turns a date and today into "Today", "Yesterday", or "Sat 7 Nov" (adding the year only when it isn't the current one). Home and Activity both use it.

### Transaction detail (Phase 2)
- A new stack route keyed by the transaction id, opened from Home's recent rows and Activity. Lists on screens not yet moved (budget detail, splits) keep tap-to-edit until their phase.
- **Read helper:** a detail hook loads the transaction with its category, account, transfer counterpart and any `split_entries` row that references it (with its split's name), depending on `version` like every read hook.
- **Layout:** plan §4 "Transaction detail":
  - a sunk top band;
  - `Segmented` Details | History;
  - `PinnedFooter` with Edit (primary) and Delete (danger).
- **Delete:**
  - confirms first;
  - a transfer deletes both legs through the existing transfers mutation;
  - a normal entry deletes through the same path the edit sheet uses;
  - a split-linked entry leaves the split entry in place (the FK is already ON DELETE SET NULL);
  - afterwards it runs `notifyChanged()` and goes back.
- **Source labels:** a pure function maps each `source` value to a label:
  - `manual` → "Added by you";
  - `quick_add` → "Quick add";
  - `voice` → "Voice";
  - `ai` → "Ask FLO";
  - `share` → "Shared to FLO";
  - `auto_detect` → "Auto-detected";
  - `bill` → "Bill paid";
  - `split` → "Split entry";
  - `transfer` → "Transfer";
  - null → no row.
- **History:** a pure function builds the timeline from the transaction and its optional split entry:
  - "Created" at `created_at` (with the source label as the sub);
  - "Edited" at `updated_at` when it's set;
  - "Added to <split name>" at the split entry's `created_at`.
  - Steps are sorted oldest first.
  - Undo isn't shown, because an undone entry no longer exists.

### Database (Phase 2)
Two nullable columns on `transactions` and one trigger. RLS already covers the table (row ownership), and the 2026-11-08 `WITH CHECK` hardening is unaffected. No view reads these columns, so no view is recreated and there's no `security_invoker` step.

```sql
-- 46-quiet-ledger, Phase 2
alter table public.transactions
  add column source text
    constraint transactions_source_check check (source is null or source in
      ('manual','quick_add','voice','ai','share','auto_detect','bill','split','transfer')),
  add column updated_at timestamptz;

-- Stamp updated_at only when a field the person sees changes, so internal
-- updates (for example linking a split) don't show up as "Edited".
create or replace function public.stamp_transaction_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.amount, new.type, new.category_id, new.note, new.occurred_at, new.account_id)
     is distinct from
     (old.amount, old.type, old.category_id, old.note, old.occurred_at, old.account_id) then
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger transactions_stamp_updated_at
  before update on public.transactions
  for each row execute function public.stamp_transaction_updated_at();

revoke execute on function public.stamp_transaction_updated_at() from public, anon, authenticated;
```

- Existing rows stay `source` null and `updated_at` null. No backfill: FLO doesn't guess where old entries came from.
- **Writers set `source` on insert:**
  - the Add sheet sets `manual`, `quick_add`, `voice`, `ai`, `share` or `auto_detect` according to how its draft arrived;
  - marking a bill paid sets `bill`;
  - a split entry that creates a transaction sets `split`;
  - both transfer legs set `transfer`.
  - Any other insert leaves it null.
- The record of this change is this section plus a row in `00-index.md`'s migrations table when it's applied.
- The `ai-assistant` context builder must not start sending `source` to the model without a decision (as with spec 45's `last4`).

### Analytics
- No new events in Phases 1–2. Existing events (for example `expense_logged`) fire from the same places as before.

## Testing Decisions

- **What a good test is here:** it checks behaviour a person would notice, through the highest seam available, and never asserts on component internals, style objects or hook state.
- **Seam 1 (primary): the emulator check.** Each ticket ends with the Tracer checklist. **Verified** means the rebuilt app checked on **Pixel_API_36** in **light and dark** mode with the reusable test account (memory: FLO emulator setup), covering the ticket's screens and every feature listed for them. For the Database ticket, Verified also needs the columns, check constraint and trigger confirmed via the Supabase MCP. That includes three cases, run in a rolled-back transaction:
  - an invalid `source` is rejected;
  - a note edit stamps `updated_at`;
  - an update that only changes `plan_id` does not stamp it.
- **Seam 2: one node check script** for the pure rules, run with node and no app or network. It exits non-zero on any failure. It covers:
  - the amount sign/tone/text function: income +, expense −, negative balance danger, the paise rule (1200 → "1,200", 1367.6 → "1,367.60", 0.5 → "0.50"), en-IN grouping (100000 → "1,00,000"), and an unknown currency degrading to INR;
  - date-group labels: today, yesterday, this year, another year;
  - the Day period boundaries (4:59 → night, 5:00 → morning, 12:00 → afternoon, 17:00 → evening, 20:00 → night);
  - the Activity filter (search by note, category name and amount; type including transfers; category), the summary (transfers and settlements excluded), and transfer pairing (both legs → one row; one leg in view → one ⇄ row);
  - the source label map (every allowed value plus null);
  - the History builder (never edited → one step; edited → two; split-linked → three, oldest first).
- **Prior art:** `scripts/quick-parse-check.mjs`, which runs the quick-add test set through a pure `lib/` parser in node and prints a per-case table. The new script follows the same shape (plain ESM, imports `lib/` modules directly, a tally, a non-zero exit on failure).
- **Not tested by script:** components, hooks, Supabase reads and layout. Those are covered by the emulator check. There's no test runner, and none is added.

## Out of Scope

- Phases 3–6 of the plan:
  - the onboarding carousel, sign-up/sign-in, the set-up questions, the reminder ask and the coach mark rework;
  - Insights, Budgets, Bills and bill detail, Splits, Accounts and Categories;
  - celebrations, the bills-due sheet, Alerts, Streak, the Ask FLO screen beyond the proposal card, Personalize/Cards, the You screen and Pro;
  - the polish pass (TalkBack, the largest font size, a 48 dp audit, reduced motion everywhere, the vivo I2220 check).
- Removing Manrope, `theme/tokens.js`, `theme/themes.js` accent axis or any retired component (the later cleanup ticket).
- The real 3D illustration assets (plan §6 open item 2). `Illustration` ships with glyph placeholders.
- Seasonal skin choices and any Pro gating of skins (plan §6 open item 1).
- Account last 4 (spec 45) beyond the slot `AccountCardCarousel` already has.
- Bill and plan icons from names (plan §2.6, Phase 4).
- An audit-log table or a full edit history. History shows created, last edited and split link only.
- Backfilling `source` for existing rows.
- Changing any feature's behaviour, gate, query or flag default other than adding `accents` (off) and deleting Koban.

## Further Notes

- **Order inside Phase 1:** tokens and flags, then the components, then Day, then the paise rule, then the proving-ground screens (proposal card, Settings). The components ticket(s) can be split by component, since none depend on each other except `Sheet` → `PinnedFooter` and `EmptyState` → `Illustration`.
- **Order inside Phase 2:**
  - the Database ticket first, because Transaction detail and the writers' `source` need it;
  - Home and the tab bar can run beside it;
  - then the Add sheet (which also sets `source`);
  - then Activity;
  - then Transaction detail.
- **Before starting, confirm with the codebase:**
  - how `equipped_card_theme` is written when a user has never chosen. If any path writes `'ink'` as a default rather than leaving null, Day-as-default must treat that path's value as "never chose";
  - which of the Add sheet's entry points can tell it the draft's origin (quick add vs voice vs AI proposal vs share vs detect), and add a parameter where one can't;
  - what the transaction update in the splits mutation changes, to confirm the trigger doesn't count it as an edit;
  - that the opening-balance insert in the account sheet (if that's what it is) should stay `source` null.
- **Device checks still owed from the plan:** ₹ and en-IN grouping in Inter, Tamil falling back to the system font, Android line heights, and the largest system font size. Phase 6 owns the full pass, but any ticket that sees a problem notes it.
- Related: spec 43 (card themes and seasonal skins), spec 44 (Ask FLO, quick add, voice), spec 45 (account last 4), spec 37 (old tokens, superseded by the plan), spec 38 (current Home, Insights and More).
