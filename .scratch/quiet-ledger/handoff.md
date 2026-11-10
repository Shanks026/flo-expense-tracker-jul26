# Quiet Ledger (spec 46): handoff

Last updated 2026-11-11, after tickets 06, 10 and 11: **Phases 1 and 2 are done** (all 12 tickets). Phase 3 (Onboarding) is next and has no spec yet. See "Since ticket 07" below for the changes the person asked for along the way.

Read this, then the ticket you're starting. The spec is
`.claude/features/46-quiet-ledger-foundations-and-core-loop.md`; the design
source is `docs/redesign-plan.md`.

## Where it stands

| Ticket | State | Commit |
|---|---|---|
| 01 Ledger tokens, money rule, check script | done | `a937827` |
| 02 Illustration, EmptyState, Koban deleted | done | `e5e529c` |
| 03 Day as the free default card | done (two small checks open, see the ticket's Comments) | `3f624d5` |
| 04 Ask FLO proposal card | done (income proposal not seen; see Comments) | `b8297ab`, `e076a9c` |
| 05 Settings on the kit | done (see the ticket's Comments for what wasn't run) | `cb691ec` |
| 06 Kit gallery and ProgressBar | done (release build not run) | `acb514f`, `af4c1e5` |
| 07 Recording where each entry came from | done (migration applied with the person's yes; voice/share/auto-detect/split not run live) | `c875cee` |
| 08 Home goes live, new tab bar | done (seasonal row deferred; see the ticket's Comments) | `3c8a165`, `d795f06` |
| 09 Add sheet on the kit | done (see the ticket's Comments for what wasn't run) | `56bbe16`, `112e40b` |
| 10 Activity search and filters | done (custom date pickers not driven; see Comments) | `1218105` |
| 11 Transaction detail | done (split-linked delete not run live; see Comments) | `4a5376f` |
| 12 Olive accent replaces the blue | done (info callout, caret, income green not seen on screen; see Comments) | `b89f842` |

**Next: Phase 3, Onboarding** (redesign plan §4 Onboarding and §7; the person confirmed 2026-11-11 to follow the plan's order). Its spec is written: `.claude/features/47-quiet-ledger-onboarding.md` (2026-11-11). Next is `/mattpocock-skills:to-tickets` on it, then implementation in a new chat. Decided with the person while writing it: "My salary day" is a real monthly cycle (new `salary_day` period + `profiles.reset_month_day`, a migration that needs their yes), the first bank picked renames the seeded "Personal" account, and testing keeps spec 46's two seams. It covers the 3-slide opener, sign-up/sign-in with live password rules, the four set-up questions (accounts, month start, monthly limit, card), the first-expense strip and the reminder ask with a time picker. The set-up questions write real rows (accounts, `reset_period`, a budget), so their emulator checks need a fresh test account, not the shared one.

After that: Phase 4 (Insights, Budgets, Bills + bill detail, Splits, Accounts, Categories; Plans is flagged off and only restyled, best done here), Phase 5 (moments, Alerts, Streak, Ask FLO chat, Personalize, You, Pro), Phase 6 (polish). The Ask FLO chat restyle the person asked for can be pulled forward as one small ticket at any point.

Palettes now live in `theme/ledgerPalettes.js` (plain data); colour pairs
are WCAG-checked in `scripts/ledger-check.mjs` (151 cases now). The kit gallery (Settings → Developer → Kit,
`app/dev/kit.js`, `flo://dev/kit`) shows every ledger component; add new
ones there. `ProgressBar` is `components/ledger/ProgressBar.js`.

## Since ticket 07 (asked for by the person, 2026-11-10/11)

- `af4c1e5` ProgressBar turns danger AT 100 %, not past it (spec 46 and the redesign plan amended).
- In ticket 10 (`1218105`): Activity's filter chips wrap inside the gutter instead of scrolling off the edge; the Account filter sheet shows each account's in-hand balance and the total on All accounts; the selected account is an ink circle with a check in the icon slot (an olive check on grey was "not distinguishable enough"), so the amounts line up.
- In ticket 11 (`4a5376f`): the Add sheet's amount caret is pinned to the end (a tap on the big number put the caret mid-number, so digits went in front and Backspace did nothing; the person spotted it); a disabled kit `Button` is a flat sunk pill with muted text (the 40 % fade left a dark ring on Android).
- `updateTransfer` now edits both legs in place (found in review: replacing the pair left an open detail screen on a dead id).

## Since ticket 12 (all asked for by the person, 2026-11-10)

- `bbf4057` Home has no chart: a "Last 7 days" ListRow (rolling, so not
  "This week": Insights' Week is the calendar week). `WeekLine.js` deleted.
- `9aa09a7` that row shows the change vs the 7 days before:
  TrendingUp red / TrendingDown green + %, `lib/weekChange.js` (hidden when
  the earlier week had < ₹100, grey "About the same" under 5 %).
  `ListRow`'s `rightSub` accepts a node.
- `550e0ae` Day card uses the person's painted landscapes
  (`assets/day-themes/*.jpg`; originals in untracked `day-themes/`).
- `b8297ab` / `e076a9c` ticket 04, plus the bill proposal's next-due date
  on its own line. Kit `Button` takes `accessibilityLabel`.
- `c875cee` ticket 07: `transactions.source` + `updated_at` live.
  `lib/entrySource.js` maps the Add sheet's analytics source to the column;
  openers can pass `origin` (auto-detect does). Ticket 11 shows it.
- The person wants the Ask FLO chat screen restyled (redesign plan §Ask FLO,
  Phase 5: ink bubbles, outlined starter chips, date-grouped past chats).
  Not ticketed yet; offered 2026-11-11, the person chose Phase 3 first.
- Test data hygiene: the test account's Tea proposal (`ai_messages`
  `7cc79a2e…`) is `dismissed` and Electricity is due 2026-11-12 unpaid; put
  them back if a check changes them. The person declined a SQL `delete`
  once: delete test entries through the sheet's Delete button; SQL
  `update` to restore state has been fine.

Branch: `feat/spec44-ai-quick-add-voice` (all commits local, nothing pushed).
`design-inspirations/` and `day-themes/` are deliberately untracked.

## Decisions made during spec 46 (not to re-litigate)

- **Koban is deleted**, not flagged off (2026-11-10). No `FLAGS.mascot`.
  His places use `Illustration` objects or nothing. `lib/koban.js` (streak
  copy text) stays.
- **Celebrations stay for now.** Whether to drop them is decided after the
  redesign. Until then the streak celebration shows an Illustration.
- **Day default:** `profiles.equipped_card_theme` is NOT NULL, default
  `'ink'`. A stored `'ink'` means "never chose" and shows Day; choosing Ink
  saves `ink-classic`. Use `resolveEquippedTheme()` / `normalizeEquippedId()`
  in `lib/cardThemes.js`, never `getTheme(equippedId)` for the hero card.
- **`FLAGS.accents` is off**; `theme_accent` is neither read nor written.
- **Tabs:** Activity and You (labels only, ticket 08).
- **Kit (ticket 05):** a screen on the kit uses `ScreenHeader` + `LargeTitle` +
  `useHeaderScroll` with `headerShown: false` on its route. `ListRow`'s
  `trailing` / `switchValue` replace the old `Row` props. Callouts are one
  line. Thumb, knob and edge colours are ledger tokens, not literals.
- **Home (ticket 08):** the "in · out" line follows Settings → Summary period
  (agreed 2026-11-10; spec 46 amended). Date-group labels come
  from `lib/dateLabels.js`; pass `occurred_at` straight in (date-only strings
  are read as local days). The Home preview route is gone; the kit gallery
  (ticket 06) is where Illustration and EmptyState samples go now.
- **Sheets (ticket 09):** new sheets use `components/ledger/Sheet` with a
  `footer` of PinnedFooter props; chips are `components/ledger/Chip`.
- **Colour (ticket 12):** accent is olive, light `#76952B` (lightened from
  `#5F7A1F` at the person's ask; graphics only, never text), dark `#B5CC6A`.
  Income `positive` stays green, deep cash green `#166534` / `#3FB97A`.
- **Home has no chart (2026-11-10):** the week line is gone (WeekLine.js
  deleted). "Last 7 days" is one ListRow (it is rolling, while Insights Week is the calendar week): the spend, "₹X a day", and a
  tap into Insights on Week. Under the amount: a trend icon and the %
  against the 7 days before (red up, green down; `lib/weekChange.js`,
  hidden under ₹100 before, grey under 5 %). Charts belong in Insights, with y-axis numbers
  (the person wants the numbers).
- **Day card art (2026-11-10):** the four SVG scenes are replaced by the
  person's painted landscapes, `assets/day-themes/<period>.jpg` (resized
  from their PNGs in the untracked `day-themes/` to 1200 px, ~40 KB each).
  `lib/dayScenes.js` names them (`type: 'image'`); the require()s are in
  `components/dayThemeImages.js` so node can still load dayScenes. Give the
  `<Image>` an explicit 100% size: absoluteFill alone cropped it on Android.
- **ProgressBar (ticket 06):** danger starts AT 100 % (spent to the limit
  is red), warn past 80 %. Rule in `lib/progressState.js`; Budgets (Phase 4)
  should use it rather than its own threshold.
- **Activity (ticket 10):** rows open `/transaction/<id>` (ticket 11; a paired transfer opens its out leg). Lists use `components/ledger/TransactionRow` (Home too). Filter chips wrap, they don't scroll. In a filter sheet whose rows carry an amount, the selection is an ink circle with a check in the icon slot, so amounts align; plain choice lists keep the trailing check.
- **Detail (ticket 11):** `updateTransfer` edits both legs in place (one upsert by id); it no longer replaces the pair. Deletes go through `lib/transactions.js` `deleteTransaction`.
- **Kit Button disabled** is its own flat look (sunk fill, muted text), never an opacity fade. **Amount input** caret is pinned to the end.
- `node` ignores `TZ` on this Windows machine, so timezone cases only run
  in IST here.

## How the work is done

- One ticket at a time with `/mattpocock-skills:implement <ticket path>`.
  Start it on the tracker (`mcp__flo-ticket-tracker__tickets` start
  `quiet-ledger/NN`).
- Pure rules go in `lib/` modules with no React Native imports, checked by
  `node --no-warnings scripts/ledger-check.mjs` (151 cases now). Imports
  inside modules the script loads need explicit `.js` extensions.
- Verify on **Pixel_API_36**: start the emulator and `npx expo start
  --dev-client`, then `adb reverse tcp:8081 tcp:8081` and open
  `flo://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`.
  Deep links like `flo://personalize`, `flo://streak` and `flo://settings`
  work (`flo://dev/home-preview` is gone since ticket 08). The test account's email is in
  `.env.test.local`; never print the password. Its Appearance is Light and its
  card is Dusk, and Personal is the active account: put all three back
  after a check. Delete test entries through the sheet's Delete button.
- Tap by label, not by coordinate: `uiautomator dump`, then tap the centre
  of the node's bounds (with `MSYS_NO_PATHCONV=1` in Git Bash). Blind taps
  land on the bell or switch the account card when a sheet is mid-close. A
  save takes about 2 s on this connection, so the Undo toast appears then.
- The Supabase MCP (`execute_sql`, project `uergtlcfpwajztqgncim`) is the
  quickest way to confirm a save or undo reached the database.
- After a hot-reload error the app can keep stale code; force-stop and relaunch
  rather than trusting HMR. Back to the launcher does NOT reset the JS either:
  a relaunch after it can still run old code, so always `am force-stop
  com.anonymous.flo` first. (2026-11-11: two fixes looked broken for this reason.)
- On a cold launch the app may show the daily "Bill due today" pop-up over
  Home; it covers the tab bar, so dismiss it ("Later") before tapping tabs.
  After a cold launch Activity can sit on its skeleton for ~5 s; wait.
- The Add sheet's amount field moves when the keyboard opens and closes:
  re-dump bounds after each `keyevent 111`, or a tap lands on a keyboard
  key (that typed a stray "6" once). Home's transfer rows are labelled
  "Transfer to Savings", not their note.
- A Blast Radius hook holds `rm` commands, even in the scratchpad; don't
  retry them. Leave scratch files in place.
- Test data: every entry made in this session was deleted through the app
  (confirmed in the DB). The test account has **no splits**; a split-linked
  check needs one created first, which is lasting test data, so ask.
- Tick all three Tracer boxes once the emulator check passes (person's
  standing instruction), set `Status: resolved`, add a Comments line saying
  what wasn't checked, then commit with the attribution line.
- Review with `/mattpocock-skills:code-review` (two agents) when the budget
  allows; ticket 03 was self-reviewed only.
