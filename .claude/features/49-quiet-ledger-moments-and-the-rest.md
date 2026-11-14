# Feature: Quiet Ledger redesign, Phase 5 (Moments and the rest)
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/49-quiet-ledger-moments-and-the-rest.md`
**Status**: in progress (tickets 01–07 done; handoff `.scratch/quiet-ledger-moments/handoff.md`)
**Last Updated**: 2026-11-14
**Source of truth for the design**: `docs/redesign-plan.md` §4 (Ask FLO, Streak, Celebrations and moments, Settings and the You tab, Pro and upsell), §2.7 (motion) and §7 Phases. Where this spec and that document disagree on a visual detail, the document wins; where they disagree on scope, sequencing or data, this spec wins.

---

## Context

Specs 46, 47 and 48 built Phases 1–4 of the Quiet Ledger redesign: the ledger kit, Home, the Add sheet, Activity, Transaction detail, Settings, the Ask FLO proposal card, Onboarding and the money screens. All are done (handoffs: `.scratch/quiet-ledger/handoff.md`, `.scratch/quiet-ledger-onboarding/handoff.md`, `.scratch/quiet-ledger-money/handoff.md`). Every decision in those handoffs still holds here, in particular:
- a kit screen uses `ScreenHeader` + `LargeTitle` + `useHeaderScroll` with `headerShown: false` on its route;
- sheets use the ledger `Sheet` with a `footer` of `PinnedFooter` props. `Sheet` passes `stackBehavior` through (`push` for a sheet opened from inside another), drops the keyboard before it closes, and retries `present()` once;
- a row's or header's extra actions go in an `OverflowMenu`, never in per-row text buttons;
- the accent is olive and for graphics only, never text and never a button fill; income green is `positive`; `streak` orange is only for the lit flame and streak marks;
- `ProgressBar` state comes from the shared progress rule (warn past 80 %, danger **at** 100 %), never a screen's own threshold;
- date groups come from the shared date-label module;
- bills show their icon through the bill-icon resolver (stored icon → category icon → receipt);
- the disabled `Button` is a flat sunk pill; Koban is deleted; `FLAGS.accents` is off;
- a split's position leads with what the person pays ("You owe ₹200"), the person's choice on 2026-11-13.

This spec is **Phase 5: moments and the rest**:
- the moments: the streak milestone celebration, the bills-due sheet, the share-usage ask, and the toast;
- the Alerts sheet;
- the Streak screen;
- the Ask FLO chat and Past chats;
- Personalize, which becomes **Cards**;
- the You tab;
- Pro and the upsell sheet (flagged off by `FLAGS.billing`);
- the bill detail fixes left over from spec 48's review;
- the cleanup ticket that spec 48 put after this phase.

Decided with the person while writing this spec (2026-11-14):
- **Test seams stay the same two:** pure rules checked by `scripts/ledger-check.mjs`, plus an emulator check per ticket. No new test runner.
- **The economy screens are left as they are.** Shop, Trophies, the rank-up celebration, the rewards history sheet and the spin wheel stay on the old tokens, hidden by `FLAGS.economy`. The cleanup ticket deletes only what nothing imports, so the old tokens, the old theme context and Manrope stay for as long as the economy uses them.

## Phase Overview

One phase, Phase 5. Each surface moves to the kit in its own ticket, so the app keeps working between tickets. No migration.

```
Phase 5 — Moments and the rest
  Moments: milestone celebration · bills-due sheet · share-usage ask · toast
  Alerts sheet · Streak screen
  Ask FLO chat + Past chats
  Cards (was Personalize) · You tab
  Pro + upsell (flag off)
  Bill detail fixes
  Cleanup (delete what nothing imports)
```

**After the phase: stop and wait for approval before Phase 6 (polish).**

## Problem Statement

Every screen people open on purpose now reads as one calm ledger, but the moments that interrupt them still belong to the old app:
- **The celebration is a dark, permanently black screen with confetti**, and it fires on day one of a streak as well as at the milestones, so a single expense gets a full-screen party.
- **The bills-due reminder is a centred modal card** with a heavy dark "Mark Paid" pill on each bill and a Title Case heading.
- **The share-usage ask and the toast** use the old fonts and colours.

Around them, the screens that sit one tap from Home still look like the old app:
- **The bell's Alerts sheet** mixes bills and budgets in one list with filled tiles. It also warns about a budget at exactly 80 %, while the Budgets list calls 80 % fine, so the two disagree.
- **The Streak screen** is a stack of cards: the hero, two stat cards and the calendar.
- **Ask FLO** still uses the old empty state and the breakdown tables, with accent-coloured bubbles. Past chats is the old grouped card list.
- **Personalize** opens on a phone mock-up with economy counters.
- **The You tab** is the old More list with an extra-bold title and boxed groups.
- **Pro and the upsell sheet** are dark, extra-bold screens. They're hidden today, but they'd look out of place the day billing turns on.

## Solution

Move these surfaces onto the ledger kit, so they share Home's chrome, type, flat lists and colour rules.

**Celebrations happen only at the 7, 30, 100 and 365 day milestones.** Each is one calm full screen on the app's own background: one object animating in, the number large, one line of copy, and Continue.

**Reminders and asks become bottom sheets:**
- **Bills due:** a sheet titled "2 bills need you", listing the bills with Mark paid and Later.
- **Share usage:** the same "Stay in the know" shape.
- **The toast:** an ink pill.

**The screens one tap from Home move to flat lists:**
- **Alerts** groups what needs the person under Overdue, Budgets and Due soon.
- **Streak** is a big count, two quiet stats and the month calendar, with no cards.
- **Ask FLO** shows ink question bubbles, outlined starter chips and breakdowns as rows. Past chats groups chats by date.
- **Personalize becomes Cards:** a large live preview, Seasonal designs first, then every design in a grid, with Equip pinned.
- **The You tab** opens on the person's name and photo, then flat groups of rows.
- **Pro** is a benefits checklist with plan rows and a pinned button. It stays hidden while billing is off.

Every feature stays, and gates, flags and data behave as before. The only behaviour changes are:
- the day-one celebration goes;
- Alerts follows the shared 80 % / 100 % rule;
- the bill detail tells "deleted" apart from "couldn't load".

## User Stories

### Milestone celebrations
1. As a FLO user who reaches a 7, 30, 100 or 365 day streak, I want a celebration screen, so that a real milestone feels marked.
2. As a FLO user on day one of a streak, I want no celebration, so that a single expense doesn't get a full-screen takeover.
3. As a FLO user, I want the celebration on the app's own background (white, or near-black in dark mode), so that it feels part of FLO, not a different app.
4. As a FLO user, I want one object (a trophy) to animate in and nothing else to move, so that the moment is calm.
5. As a FLO user, I want no confetti and no emoji, so that the moment matches the rest of the app.
6. As a FLO user, I want the day count as the largest text, so that I see the number first.
7. As a FLO user, I want one line of copy under the number, so that the screen says something without a paragraph.
8. As a FLO user, I want the last seven days as a row of marks (logged, no-spend, frozen), so that I see the run that got me here.
9. As a FLO user, I want one Continue button pinned at the bottom, so that leaving is obvious.
10. As a FLO user, I want Android's back gesture to close the celebration too, so that I'm never stuck.
11. As a FLO user, I want a success haptic when the celebration opens, so that the milestone feels physical.
12. As a FLO user with reduced motion on, I want the object to appear without animating, so that nothing moves.
13. As a FLO user, I want a celebration I missed today to still show in my next session, until the end of tomorrow, as now, so that a milestone isn't lost.
14. As a FLO user, I want celebrations to keep waiting behind the bills-due sheet, onboarding and an open Add sheet, as now, so that they never interrupt something more important.

### The bills-due sheet
15. As a FLO user with bills due today or overdue, I want a bottom sheet once a day instead of a centred pop-up, so that the reminder feels lighter.
16. As a FLO user, I want the sheet titled "1 bill needs you" or "2 bills need you", so that the count is the first thing I read.
17. As a FLO user, I want overdue bills first, then bills due today, each sorted by date and then name, so that the oldest problem is at the top.
18. As a FLO user, I want each bill as a row with its own icon, name, "Overdue since 9 Nov" (red) or "Due today", and the amount, so that one row says everything.
19. As a FLO user with one bill due, I want Mark paid as the primary button and Later beside it, so that paying is one tap.
20. As a FLO user with several bills due, I want a small Mark paid on each row and Later in the footer, so that I can pay them one at a time.
21. As a FLO user, I want Mark paid to close the reminder and open the pay sheet as now, so that paying works exactly as before.
22. As a FLO user, I want tapping a bill row to open its bill detail, so that I can check it before paying.
23. As a FLO user, I want swiping the sheet down or pressing back to count as Later, so that dismissing never logs a payment.
24. As a FLO user who paid or deleted the bills while the reminder waited, I want it not to show at all, as now, so that I'm not reminded about nothing.

### The share-usage ask
25. As a FLO user who has logged three expenses, I want the share-usage ask as a bottom sheet with one object, two lines and two buttons, so that it reads as a calm question.
26. As a FLO user, I want "Share usage" and "Not now" as its buttons, and my answer remembered as now, so that I'm asked once.
27. As a FLO user, I want Settings → Data & export to keep its switch, so that I can change my mind.

### The toast
28. As a FLO user, I want toasts as an ink pill with white text (dark text in dark mode) and a small status icon, so that they match the rest of the app.
29. As a FLO user, I want the Undo action in the save toast to keep landing on the first tap, as fixed in spec 46, so that nothing regresses.

### Alerts
30. As a FLO user, I want the bell's Alerts sheet grouped under Overdue, Budgets and Due soon, so that I can see what kind of thing needs me.
31. As a FLO user, I want Overdue's group title in red, so that it stands out.
32. As a FLO user, I want each alert as a row with a tinted circle (red for overdue or over budget, amber for almost out or due soon), a title and one line, so that the list is quick to scan.
33. As a FLO user, I want tapping an alert to close the sheet and open that bill's or budget's detail, as now, so that I land where I can act.
34. As a FLO user, I want a budget alert at the same point the Budgets list turns amber or red (past 80 %, and at 100 %), so that the two screens agree.
35. As a FLO user with an ended custom budget, I want no alert for it, as now, so that FLO doesn't nag about a finished period.
36. As a FLO user with a paused bill, I want no alert for it, as now, so that a bill I'm not tracking stays quiet.
37. As a FLO user with nothing to see, I want "You're all caught up" with one line, so that an empty sheet reads as good news.
38. As a FLO user, I want the bell's dot to show exactly when the sheet has something in it, so that the dot never lies.

### Streak
39. As a FLO user, I want the Streak screen to open on the count as the largest text, with the flame lit orange when today counts, so that I see where I stand.
40. As a FLO user, I want "day streak" under the count and one line of copy below that, as now, so that the screen still talks to me.
41. As a FLO user with no streak, I want the count and flame in muted grey, so that a zero doesn't look like an error.
42. As a FLO user, I want freezes ("1 of 2") and the next milestone ("30 · 12 days to go") as two small stats in one row, with no cards, so that they're there without clutter.
43. As a FLO user past 365 days, I want the next-milestone stat to say there's none left, so that it doesn't show a dash.
44. As a FLO user, I want the month calendar as a fixed seven-column grid with weekday initials, so that every date sits under the right day.
45. As a FLO user, I want logged days as an orange dot, no-spend days as a ring and frozen days as a snowflake, so that each kind of day is clear.
46. As a FLO user, I want today marked and days outside the month or in the future dimmed, so that I know where I am in the month.
47. As a FLO user, I want a legend under the calendar, so that I know what each mark means.
48. As a FLO user, I want the footnote explaining how days count and how freezes work, as now, so that the rules are on the screen.
49. As a FLO user, I want a skeleton shaped like the count and calendar while it loads, so that loading doesn't look like a zero streak.
50. As a FLO user, I want Home's flame chip to keep opening this screen, so that the link from Home still lands.

### Ask FLO
51. As a FLO user opening a new chat, I want the spark object, "Ask about your money" and one line, so that I know what to ask.
52. As a FLO user, I want the four starter questions as outlined chips, so that starting is one tap.
53. As a FLO user, I want my questions as ink bubbles with white text (dark text in dark mode), so that they match the app's primary colour instead of the accent.
54. As a FLO user, I want answers on the page with no bubble, in the ledger's body type, so that long answers read easily.
55. As a FLO user, I want breakdowns in an answer as flat rows (name and amount, with a total row), so that they look like every other list.
56. As a FLO user, I want proposal cards to stay as they are (Review and Dismiss, "Saved ✓" after), so that the spec 46 card keeps working.
57. As a FLO user, I want the composer as a capsule field with the mic and an ink send button, so that it matches the Add sheet's quick-add line.
58. As a FLO user, I want the thinking line, voice input and word-by-word reveal to behave as now, so that nothing about the chat's behaviour changes.
59. As a FLO user, I want Past chats and New chat as circle icons in the header, so that both are one tap from any chat.
60. As a FLO user, I want Past chats as rows grouped by date (Today, Yesterday, Sat 7 Nov), so that I can find a recent chat.
61. As a FLO user, I want each past chat row to show its title and time, and to open that chat, as now, so that past chats still open.
62. As a FLO user, I want a New chat row at the top of Past chats, as now, so that starting fresh is there too.
63. As a FLO user with no past chats, I want one line saying so, so that the screen isn't blank.

### Cards (was Personalize)
64. As a FLO user, I want Personalize renamed Cards, so that its name says what it's for.
65. As a FLO user, I want a large live preview of the card I've picked at the top, with my active account's name and last 4, so that I see exactly how Home will look.
66. As a FLO user, I want a seasonal card to animate once in the preview, as on Home, so that I see it come alive before I equip it.
67. As a FLO user, I want Seasonal designs first, under their own header, so that the special ones are easy to find.
68. As a FLO user, I want every other design in a two-column grid under "All cards", so that I can browse them all.
69. As a FLO user, I want the picked design marked with an ink ring and a check, so that I know which one I've chosen.
70. As a FLO user, I want picking a design to change only the preview until I tap Equip, as now, so that I can try designs freely.
71. As a FLO user, I want Equip pinned at the bottom, disabled while the picked design is already equipped, so that I can't equip twice.
72. As a FLO user, I want a toast after equipping and Home showing the new card at once, so that I know it worked.
73. As a FLO user, I want no phone mock-up and no economy counters, so that the screen is about cards.
74. As a FLO user, I want no accent swatches while the accent picker is off, as now, so that only cards are personal.
75. As a FLO user, I want Cards to stay hidden, and a deep link to it to land on Home, while card themes are flagged off, as now, so that the flag still works.

### You
76. As a FLO user, I want the You tab to open on my photo (or my initial in a circle), my name and my email, so that it feels like my space.
77. As a FLO user without a name, I want my email's first letter as the initial and my email as the title, so that the header is never empty.
78. As a FLO user, I want tapping the header to open the edit-profile sheet, so that changing my name or photo is one tap.
79. As a FLO user, I want Cards as the first row, so that the signature feature is easy to reach.
80. As a FLO user, I want Ask FLO next (while AI is on), then Money (Budgets, Bills, Splits) and Set up (Accounts, Categories) under sentence-case headers, so that everything is where it was.
81. As a FLO user, I want FLO Pro (only while billing is on) and Settings at the bottom, so that the screen ends on setup.
82. As a FLO user, I want every row flat on the background with a grey icon circle and a chevron, so that the tab matches Settings.

### Pro and upsell (flagged off)
83. As the developer, I want the Pro screen on the app's own background with the standard header, so that it isn't a permanently dark screen.
84. As the developer, I want Pro's benefits as a checklist in one card, so that the value reads at a glance.
85. As the developer, I want the plan options as selectable rows with the price and the per-month equivalent, so that choosing a plan is clear.
86. As the developer, I want the Pro button pinned and naming the chosen plan, so that the action is always in reach.
87. As the developer, I want Pro's existing placeholder behaviour unchanged (no payment), so that nothing new ships with billing.
88. As the developer, I want the upsell sheet in the standard sheet: a title, the reason it opened, the benefits, and one button to Pro, so that it matches every other sheet.
89. As the developer, I want the crown on locked options in ink, not a colour, so that it follows the colour rules.
90. As the developer, I want Pro and the upsell to stay unreachable while `FLAGS.billing` is off, as now, so that the restyle ships nothing visible.

### Bill detail fixes (from spec 48's review)
91. As a FLO user with a network blip, I want the bill detail to say it couldn't load and offer Retry, instead of closing, so that a blip doesn't look like a deleted bill.
92. As a FLO user, I want the bill detail to go back only when the bill is really gone, so that I'm only taken away from a deleted bill.
93. As a FLO user who opens a bill link with no id, I want to land back where I came from, not on an endless loading screen, so that a broken link isn't a dead end.
94. As a FLO user, I want the bills list, the bill detail's band and its timeline to word due dates the same way, so that "Due 12 Nov" never reads differently in two places.

### Developer
95. As the developer, I want every flag (`billing`, `economy`, `themes`, `themeGating`, `accents`, `plans`, `ai`) to behave exactly as now on every moved surface, so that the restyle changes no behaviour.
96. As the developer, I want the moment queue's order, caps and expiry unchanged, so that moments arrive as before.
97. As the developer, I want old components deleted only once nothing imports them, so that the flagged-off economy keeps working.
98. As the developer, I want the new pure rules in the node check script, so that alert grouping, due bills, celebrations, the streak calendar, card sections and the profile initial are checked without the app.
99. As the developer, I want each ticket verified on Pixel_API_36 in light and dark mode, so that "done" means seen on the device.

## Implementation Decisions

### Approach
- **Same as specs 46–48.** Each surface moves in its own ticket. Old components stay until the cleanup ticket at the end of this phase. Read hooks keep the `version` / `activeAccountId` / `{ data, loading, refetch }` shape. Writes stay in `lib/`, with `notifyChanged()` after.
- **Presentational except for:**
  - the day-one celebration's removal;
  - Alerts moving to the shared progress rule;
  - the bill detail's error handling.
- **Pure rules live in plain `lib/` modules** with no React Native, Expo or Supabase imports (explicit `.js` extensions in their imports), so the check script can load them. Components call them and never re-implement them.

### Milestone celebrations
- **The source enqueues milestones only.** A celebration is enqueued only when the day's first log lands on a milestone (7, 30, 100, 365). The day-one ("streak start") moment is no longer enqueued. Everything else is unchanged:
  - the moment id format (`streak-milestone:<days>:<date>`);
  - its priority;
  - the end-of-tomorrow expiry;
  - the payload snapshot;
  - the `streak_milestone` event.
- **A pure rule decides it:** `celebrationFor({ current, isMilestone, loggedToday })` returns `{ id, days }` or null. It is null on day one, null without a log today, and null away from a milestone.
- **The screen:**
  - a full-screen `Modal` (keeping `statusBarTranslucent`) on `canvas`, so it follows light and dark;
  - the `trophy` `Illustration` (large);
  - the day count in brand display type (Inter 700, 36, tracking −0.8), with a "day streak" caption;
  - one line of copy from the existing milestone recap;
  - the last seven days as a row of streak marks (the same marks as the Streak calendar, oldest on the left, today on the right);
  - `PinnedFooter` **Continue** (primary).
- **Motion:** only the object animates in (a short scale and fade). The text and the row appear in place. Confetti is not used. Reduced motion shows everything still. A success haptic plays on open.
- The recap copy helpers stay (text, not art). Their day-one variants become unused and go in the cleanup ticket if nothing else calls them.

### The bills-due sheet
- **The trigger is unchanged:** once a day while an active bill is due today or overdue, through the moment queue (actionable priority, expiring at the end of the day). The renderer still reads bills live, and gives the takeover back (`skipped`) when nothing is due by the time it shows.
- **A pure rule:** `dueBillsMoment(bills, today)` returns `{ title, bills }` or null:
  - **which bills:** active bills due on or before today;
  - **order:** overdue first, then due today, each by due date and then name;
  - **title:** "1 bill needs you" or "N bills need you";
  - **null** when nothing is due.
  It lives beside the bill grouping rule and uses the same overdue test.
- **The sheet:**
  - The ledger `Sheet` with the rule's title. It's presented by the moment renderer, and dismissing it in any way finishes the moment.
  - One `ListRow` per bill:
    - the resolved bill icon in its category tint (danger tint when overdue);
    - the name;
    - a sub of "Overdue since 9 Nov" (danger) or "Due today";
    - the amount on the right.
  - Tapping a row finishes the moment and opens bill detail.
- **Footer:**
  - one bill: **Mark paid** (primary) + **Later** (secondary);
  - two or more: each row gets a compact quiet **Mark paid**, and the footer is **Later** alone.
  - Mark paid finishes the moment, then opens the pay sheet as now.
- Retires the old centred modal card.

### The share-usage ask
- Same trigger, storage key and writes as now. It moves into the ledger `Sheet`:
  - the `spark` object (small);
  - the title "Help improve FLO?";
  - the existing one-line body;
  - **Share usage** (primary) + **Not now** (secondary).
- Dismissing counts as Not now, as the current close does.

### The toast
- Same API (`showToast({ message, variant, action })`), same position and timing, and still no slide-in (spec 46's Undo fix).
- Restyled on ledger tokens:
  - an `ink` capsule with `inkOnInk` text in `ledgerType.body`;
  - a small status glyph: `positive` for success, `danger` for error, none for plain;
  - the action as a 600-weight text button.

### Alerts
- **A pure rule:** `alertGroups({ bills, budgets, plans, today, plansOn })` returns `[{ key, title, tone, alerts }]` with empty groups left out. It moves the feed's logic out of the hook into a plain module.
- **Groups:**
  - **Overdue** (danger title): active bills due before today;
  - **Budgets:** each budget whose shared progress state is warn or danger. Ended custom budgets are skipped, as now. The sub reads "Over by ₹X" or "N % used this month / this week / in this period";
  - **Due soon:** active bills in the existing due-soon window;
  - **Plans:** only while `FLAGS.plans` is on, with the existing plan rules.
  Each alert keeps its `id`, `route`, `title` and `sub`, and its tone (danger or warn).
- **The threshold change:** budgets move from the hook's own rule (warn at 80 % exactly, over only above 100 %) to the shared progress rule (warn past 80 %, danger at 100 %), so Alerts and the Budgets list agree. The budget save toast switches to the shared rule too. (Amended 2026-11-14: Insights' "Frequently over" also uses the old rule and keeps it, since spec 48 left Insights' rules as they were; the cleanup must not delete it.)
- **The sheet:**
  - the ledger `Sheet` titled "Alerts";
  - a `SectionHeader` per group;
  - `ListRow`s with a tinted circle (danger or warn tone), the title, the sub and a chevron;
  - tapping a row dismisses the sheet, then routes;
  - the ledger `EmptyState` with no object: "You're all caught up", "Bills due and budget warnings show up here."
- The bell's dot reads the same rule (any group present).

### Streak
- **The screen:**
  - `ScreenHeader` + `LargeTitle` "Streak", with `headerShown: false` on its route;
  - **Hero:** the flame glyph (filled `streak` when the count is above 0, muted otherwise) beside the count in `display`, "day streak" as a caption, then the existing headline line;
  - **Stats row:** two captioned figures with no cards. "Freezes" reads "1 of 2". "Next milestone" reads "30" with "12 days to go", or "All milestones reached" past 365;
  - **Calendar:** a `SectionHeader` with the month and year, weekday initials (Monday first), then the grid, then a legend row (Logged, No spend, Frozen), then the footnote as a muted caption;
  - **Loading:** a skeleton shaped like the hero and the grid, not a spinner.
- **A pure rule:** `streakCalendar(history, today)` returns weeks of `{ key, day, inMonth, future, isToday, mark }`, where `mark` is `'logged' | 'nospend' | 'frozen' | null`. A day outside the history window is null. The grid is built from fixed seven-cell rows (the Android wrapping fix stays).
- **A pure rule:** `nextMilestone(current)` returns `{ days, toGo }` or null past the last one.
- **Streak marks** move onto a ledger mark component shared by the screen, the celebration's seven-day row and the legend:
  - logged: a filled `streak` dot;
  - no-spend: a `streak` ring;
  - frozen: a snowflake glyph in `muted`;
  - nothing: an empty sunk circle.
  It retires the old flame cells.

### Ask FLO
- **Behaviour unchanged:**
  - the `FLAGS.ai` redirect;
  - the `id` and `at` route params;
  - the voice composer;
  - the thinking steps;
  - the word-by-word reveal and its reduced-motion rule;
  - failed turns putting the question back;
  - the proposal card (spec 46).
- **The chat:**
  - `ScreenHeader` with two `HeaderIconButton`s: Past chats (history) and New chat (pencil);
  - **Empty:** `Illustration` `spark`, the title "Ask about your money", one line of body, and the four starters as outlined ledger `Chip`s that send on tap;
  - **The person's bubbles:** `ink` fill, `inkOnInk` text, round corners with the tail corner (bottom-right) tighter (the person, 2026-11-14, after briefly trying all corners fully round);
  - **Answers:** full width with no bubble, in `ledgerType.body`;
  - **Breakdowns:** flat rows in place of the breakdown table. Each row shows the category's tinted circle when it has a category, the name and the amount on the right, with a 600-weight total row. The data shape the table reads stays;
  - **Composer:** a `surfaceSunk` capsule field (`ledgerRadius.field`), the mic, and a 40 dp ink circle send button (`inkOnInk` arrow). Disabled send is the sunk state.
- **Past chats:**
  - `ScreenHeader` + `LargeTitle` "Past chats";
  - a **New chat** `ListRow` first;
  - then chats grouped by the shared date-label module, each a `ListRow` with the title (one line) and the time as its sub;
  - with none, one muted line: "Your chats will show up here."
- Retires the breakdown table (the cleanup ticket deletes it once nothing imports it), and these screens' uses of `Card`, `Row` and the old `EmptyState`.

### Cards (was Personalize)
- **Same route, same draft-then-Equip behaviour** and the same `FLAGS.themes` redirect. The visible name becomes "Cards" everywhere: the title, the You row and the Settings row.
- **Layout:**
  - `ScreenHeader` + `LargeTitle` "Cards";
  - a large live preview: the drafted theme drawn by the same card surface as Home, with the active account's name and masked last 4, at full width within the gutter (2:1). A seasonal theme plays its once-on-focus animation;
  - the sections, each a `SectionHeader` and a two-column grid of card swatches (2:1, `ledgerRadius` 12, the name under each). The picked one gets a 2 dp ink ring and a small ink check;
  - `PinnedFooter` **Equip**, disabled (flat sunk) while the draft equals the equipped card;
  - a success toast after equipping, as now.
- **A pure rule:** `cardSections(themes, { economy, ownedIds })` returns `[{ key: 'seasonal', title: 'Seasonal', themes }, { key: 'all', title: 'All cards', themes }]`:
  - legacy themes are left out, as the catalog does;
  - seasonal-tier themes go only in Seasonal;
  - both lists keep catalog order;
  - an empty Seasonal section is left out;
  - while `economy` is off, every theme is choosable, as now; while it's on, the existing owned/locked rule applies, with locked swatches muted and a lock glyph.
- **Removed:** the phone mock-up preview with its economy counters, and the accent swatches (already hidden while `FLAGS.accents` is off; that code path stays behind the flag).
- **Not built:** "Coming for Diwali" placeholders and Home's "New: <skin> card" row. The catalog has no availability windows yet.

### You
- **The screen:**
  - the tab screen with a `LargeTitle` "You" (no back button on a tab);
  - **Profile header:** a 56 dp circle with the person's photo (`avatar_url`) or their initial, the name (`full_name`) in `ledgerType.title`, and the email as a muted caption. A tap opens the existing edit-profile sheet;
  - **Rows:**
    - Cards (only with `FLAGS.themes`);
    - Ask FLO (only with `FLAGS.ai`);
    - `SectionHeader` **Money:** Budgets, Bills, Splits;
    - `SectionHeader` **Set up:** Accounts, Categories;
    - then FLO Pro (only with `FLAGS.billing`) and Settings.
  - Each row is a `ListRow` with a sunk circle icon and a chevron. Everything is flat on `canvas`, with routes unchanged.
- **A pure rule:** `profileInitial({ fullName, email })` returns one uppercase letter: from the name if it has one, else from the email, else "?".
- **Header fallbacks:** the title is the name when set, otherwise the email, and the caption is hidden when it would repeat the title.

### Pro and upsell (flag off)
- **Pro screen:**
  - `ScreenHeader` + `LargeTitle` on `canvas` (no longer permanently dark);
  - the benefits as a checklist inside one `surface` card with a hairline border: a check glyph and a line per benefit, from the existing benefits list;
  - the plan options as selectable `ListRow`s, one per `PRO_PRICING` plan: the price, the per-month equivalent as the sub, and a radio check trailing on the chosen one;
  - `PinnedFooter` primary naming the plan, with the existing placeholder behaviour on tap (no payment).
- **The upsell sheet:**
  - the ledger `Sheet` titled "Go further with FLO";
  - the `reason` (or the default) as one line;
  - the benefits as rows;
  - footer primary "Level up for ₹58/mo" (from the existing monthly-equivalent constant), opening Pro.
- **The crown badge** on locked options draws in `ink` on a `surfaceSunk` circle.
- **Gates unchanged:** the route redirects while billing is off, and the upsell opens only from the existing create-time gates, which pass while billing is off. The ticket's emulator check flips `FLAGS.billing` on locally and never commits it flipped.

### Bill detail fixes (spec 48 review leftovers)
- **Missing vs failed:** the bill-detail hook reports `{ bill, payments, loading, error, missing }`:
  - `missing` is true only when the fetch succeeded and found no row (deleted, or not the person's). Only then does the screen go back;
  - a fetch error shows an inline `Callout` (danger) "Couldn't load this bill" with a **Retry** button (refetch), keeping the header;
  - no id in the route goes back at once, instead of loading forever.
- **One due wording:** the bills list sub, the detail band's terms and the timeline's open step all take their date phrase ("Due 12 Nov", "Due today", "Overdue since 9 Nov") from one pure function in the bill grouping module. The existing outputs are kept exactly; the checks for all three keep passing.

### Cleanup (last ticket)
- **A file is deleted only when nothing imports it.** Every candidate is checked by a project-wide import search at ticket time, and re-checked after each deletion, because deleting one file can free another. Candidates:
  - retired in spec 48: `InsightsPeriodControl`, `IncomeExpenseChart`, `ChartAxis`, `DonutChart`, `CategoryBreakdownAccordion`, `BreakdownTable`, `DailySpendingChart`;
  - retired here: the old due-bills card, `Confetti`, `PersonalizePreview`, the old flame cells;
  - the old shared pieces: `Card`, `IconTile`, `Pill`, `BackButton`, the old `Button`, the old `EmptyState`, the old `ProgressBar`, `Row`/`RowGroup`, `SegmentedChoice`, `Screen`, `Skeleton`, `FadeIn`, `IconButton`;
  - unused helper exports in the streak copy module.
- **Stays while the economy imports it:** `theme/tokens.js`, the old theme context, Manrope and any old component the economy screens use. The economy is left as is (decided 2026-11-14).
- **Manrope** is unloaded only if nothing still references its family names. Otherwise it stays, with a comment naming the economy as the reason.
- **Verification:** the check script passes, and the app cold-starts on the emulator with Home, Activity, Insights, You, Settings, Ask FLO, Cards, Streak and a bill detail each opened once, with no red screen.

### Flags
- `billing`: Pro and the upsell are unreachable while off; their restyle is checked with the flag flipped on locally.
- `economy`: the economy screens are untouched; nothing from the economy shows on the moved surfaces; the economy rule in Cards applies only while it's on.
- `themes`: off hides Cards (route, You row, Settings row) as now.
- `themeGating`: unchanged.
- `accents`: off; no swatches.
- `plans`: off; no Plans group in Alerts.
- `ai`: off hides Ask FLO (the You row and the route redirect, as now).

### Database
- None. No migration, no RLS change, no Edge Function change.

### Analytics
- No new events. The existing events fire as now: `streak_milestone`, `feature_opened`, the onboarding and consent events, and the share-usage answer. Removing the day-one celebration removes no event (it had none).

## Testing Decisions

- **What a good check is:** it checks behaviour through a module's public function, never its internals. For example: given these bills and this date, which are due and what's the title? Given these budgets, which group is each alert in? A refactor that keeps the behaviour keeps the check green. Nothing asserts on components, styles or hook state.
- **Seam 1, pure rules, `scripts/ledger-check.mjs`.** Prior art: spec 48's bill grouping, bill timeline, split net and last-4 groups, and spec 46's progress and date-label groups. New groups:
  - **celebrations:** day one gives null; days 7, 30, 100 and 365 give a celebration; day 8 gives null; no log today gives null; the id format;
  - **due bills:**
    - nothing due gives null;
    - one bill due today: "1 bill needs you";
    - an overdue and a due-today bill: "2 bills need you", with the overdue one first;
    - a paused overdue bill is left out;
    - ties sort by name;
  - **alert groups:**
    - overdue and due-soon bills land in the right groups, and paused bills nowhere;
    - budgets at 80 % (none), 81 % (warn), exactly 100 % (danger) and an ended custom budget (none);
    - plans only when `plansOn`;
    - empty groups are left out;
    - the group order;
  - **streak calendar:**
    - a month starting mid-week gets leading days from the previous month, with `inMonth` false;
    - future days;
    - today;
    - each mark type;
    - a day outside the history is null;
    - every week has seven days;
    - `nextMilestone` at 0, 6, 7, 29 and 365 (null);
  - **card sections:** a seasonal theme only in Seasonal; legacy left out; catalog order kept; Seasonal left out when empty; all themes choosable with economy off;
  - **profile initial:** a name, a name with leading spaces, no name with an email, nothing ("?"), and a lowercase name gives an uppercase letter;
  - **due wording:** the three existing bill-wording outputs, unchanged, through the shared function.
- **Seam 2, the emulator** (Pixel_API_36, light and dark), per ticket, with the shared test account. After each check, put back Appearance Light, Personal as the active account, and the card.
  - **Celebrations:** trigger one by seeding the streak marks the screen reads. This is lasting test data, so ask first and remove it through the app or with the person's yes. Confirm day one shows nothing.
  - **Bills due:** use a test bill due today, created and deleted through the app.
  - **Share-usage ask:** reset its stored answer in dev only.
  - **Pro:** flip `FLAGS.billing` locally and never commit it.
  - **Bill detail fixes:** check the error state with the network turned off on the emulator, then Retry with it back on.
- **No new test runner** (AGENTS.md: verify by running the app).

## Out of Scope

- **Phase 6 polish:** the light and dark pass, TalkBack, the largest font size, a 48 dp audit, reduced motion everywhere, the vivo I2220 check.
- **The economy screens:** Shop, Trophies, rank-up, the rewards history sheet, the spin wheel, the trophy toast. They're not restyled and stay behind `FLAGS.economy` (decided 2026-11-14).
- **Seasonal availability windows:** "Coming for Diwali" placeholders, and Home's "New: <skin> card" row.
- **New seasonal skins**, and the real 3D illustration assets (`Illustration` keeps its placeholders).
- **Payments** or any change to Pro's placeholder behaviour or the free limits.
- **Recording skipped bill cycles**, or any data change to bills.
- **Changing the moment queue's priorities, caps or expiry.**
- **Removing `theme/tokens.js`, the old theme context or Manrope while the economy imports them.**
- **The unmounted freeze prompt:** left as is, deleted by the cleanup ticket only if nothing imports it.

## Further Notes

- **Suggested ticket order** (`/to-tickets` decides):
  1. the moments: the celebration (with the shared streak mark), the bills-due sheet, the share-usage ask, the toast;
  2. Alerts (with the shared rule for the bell's dot);
  3. Streak (uses the streak mark from 1);
  4. Ask FLO chat and Past chats;
  5. Cards;
  6. You;
  7. Pro and upsell (flag off);
  8. bill detail fixes;
  9. cleanup (after all the others).

  Tickets 2, 4, 5, 6, 7 and 8 don't depend on each other; 3 needs 1; 9 needs all.
- **Before starting, confirm with the codebase:**
  - that the moment host is inside the bottom-sheet provider, so a moment can present a ledger `Sheet`. It is mounted inside it today; check it hasn't moved;
  - which values the streak hook's history uses for each day type (`logged`, `nospend`, `frozen`), so the calendar rule maps them all;
  - every caller of the old budget status rule and the budget save toast, before switching or deleting them;
  - every place that shows the Personalize name (the You row, the Settings row, deep links), so the rename to Cards is complete;
  - how the Ask FLO answer hands breakdown data to the table, so the new rows read the same shape.
- **The celebration's seven-day row order:** the redesign plan says "newest first". This spec keeps today on the right (oldest → today, reading order), matching the Streak calendar. Raise it at the ticket's emulator check if it looks wrong.
- **Related specs:**
  - 04: bills and the due reminder;
  - 23: Personalize;
  - 33: product analytics and the share-usage ask;
  - 34: streak only, the moment queue;
  - 43: card themes and seasonal skins;
  - 44: Ask FLO;
  - 14: Pro;
  - 46, 47, 48: the kit and its rules.
