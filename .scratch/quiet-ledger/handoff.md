# Quiet Ledger (spec 46): handoff

Last updated 2026-11-10, after ticket 12 (olive accent, week-line y-axis).

Read this, then the ticket you're starting. The spec is
`.claude/features/46-quiet-ledger-foundations-and-core-loop.md`; the design
source is `docs/redesign-plan.md`.

## Where it stands

| Ticket | State | Commit |
|---|---|---|
| 01 Ledger tokens, money rule, check script | done | `a937827` |
| 02 Illustration, EmptyState, Koban deleted | done | `e5e529c` |
| 03 Day as the free default card | done (two small checks open, see the ticket's Comments) | `3f624d5` |
| 04 Ask FLO proposal card | ready | |
| 05 Settings on the kit | done (see the ticket's Comments for what wasn't run) | `cb691ec` |
| 06 Kit gallery and ProgressBar | ready | |
| 07 Recording where each entry came from | ready (DB change: needs the person's yes before applying) | |
| 08 Home goes live, new tab bar | done (seasonal row deferred; see the ticket's Comments) | `3c8a165`, `d795f06` |
| 09 Add sheet on the kit | done (see the ticket's Comments for what wasn't run) | `56bbe16`, `112e40b` |
| 10 Activity search and filters | ready | |
| 11 Transaction detail | blocked by 07, 10 | |
| 12 Olive accent replaces the blue | done (info callout, caret, income green not seen on screen; see Comments) | this commit |

Suggested order: 04, 07, 06, 10, 11.

Palettes now live in `theme/ledgerPalettes.js` (plain data); colour pairs
are WCAG-checked in `scripts/ledger-check.mjs` (51 cases). Ticket 06's
gallery should show a `Callout tone="info"`: nothing uses it on screen yet.

Branch: `feat/spec44-ai-quick-add-voice` (all commits local, nothing pushed).
`design-inspirations/` is deliberately untracked (third-party screenshots).

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
  tap into Insights on Week. Charts belong in Insights, with y-axis numbers
  (the person wants the numbers).
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
