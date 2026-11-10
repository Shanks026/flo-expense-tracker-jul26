# Quiet Ledger (spec 46): handoff

Last updated 2026-11-10, after tickets 12, 04 and 07 plus the Home and Day-card changes the person asked for (see "Since ticket 12" below).

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
| 06 Kit gallery and ProgressBar | done (release build not run) | `acb514f` + the 100 % follow-up |
| 07 Recording where each entry came from | done (migration applied with the person's yes; voice/share/auto-detect/split not run live) | `c875cee` |
| 08 Home goes live, new tab bar | done (seasonal row deferred; see the ticket's Comments) | `3c8a165`, `d795f06` |
| 09 Add sheet on the kit | done (see the ticket's Comments for what wasn't run) | `56bbe16`, `112e40b` |
| 10 Activity search and filters | ready | |
| 11 Transaction detail | blocked by 07, 10 | |
| 12 Olive accent replaces the blue | done (info callout, caret, income green not seen on screen; see Comments) | `b89f842` |

Suggested order: **10 next**, then 11 (unblocked once 10 is done; 07 is done).

Palettes now live in `theme/ledgerPalettes.js` (plain data); colour pairs
are WCAG-checked in `scripts/ledger-check.mjs` (94 cases now). The kit gallery (Settings → Developer → Kit,
`app/dev/kit.js`, `flo://dev/kit`) shows every ledger component; add new
ones there. `ProgressBar` is `components/ledger/ProgressBar.js`.

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
  Not ticketed yet; offer to pull it forward when Phase 2 is done.
- Test data hygiene: the test account's Tea proposal (`ai_messages`
  `7cc79a2e…`) is `dismissed` and Electricity is due 2026-11-12 unpaid; put
  them back if a check changes them. The person declined a SQL `delete`
  once: delete test entries through the sheet's Delete button; SQL
  `update` to restore state has been fine.

Branch: `feat/spec44-ai-quick-add-voice` (all commits local, nothing pushed).
`design-inspirations/` and `day-themes/` are deliberately untracked.

## Decisions made during 01–03 (not to re-litigate)

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
- `node` ignores `TZ` on this Windows machine, so timezone cases only run
  in IST here.

## How the work is done

- One ticket at a time with `/mattpocock-skills:implement <ticket path>`.
  Start it on the tracker (`mcp__flo-ticket-tracker__tickets` start
  `quiet-ledger/NN`).
- Pure rules go in `lib/` modules with no React Native imports, checked by
  `node --no-warnings scripts/ledger-check.mjs` (31 cases so far). Imports
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
  rather than trusting HMR.
- Tick all three Tracer boxes once the emulator check passes (person's
  standing instruction), set `Status: resolved`, add a Comments line saying
  what wasn't checked, then commit with the attribution line.
- Review with `/mattpocock-skills:code-review` (two agents) when the budget
  allows; ticket 03 was self-reviewed only.
