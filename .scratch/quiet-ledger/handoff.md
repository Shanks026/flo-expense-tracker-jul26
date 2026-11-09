# Quiet Ledger (spec 46): handoff

Last updated 2026-11-10, after ticket 03. Paused on the weekly usage limit.

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
| 05 Settings on the kit | ready | |
| 06 Kit gallery and ProgressBar | blocked by 05 | |
| 07 Recording where each entry came from | ready (DB change: needs the person's yes before applying) | |
| 08 Home goes live, new tab bar | ready | |
| 09 Add sheet on the kit | blocked by 05 | |
| 10 Activity search and filters | blocked by 08, 09 | |
| 11 Transaction detail | blocked by 05, 07, 08, 10 | |

Suggested order: 05 (unblocks 06 and 09), then 08, 09, 04, 07, 06, 10, 11.

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

## How the work is done

- One ticket at a time with `/mattpocock-skills:implement <ticket path>`.
  Start it on the tracker (`mcp__flo-ticket-tracker__tickets` start
  `quiet-ledger/NN`).
- Pure rules go in `lib/` modules with no React Native imports, checked by
  `node --no-warnings scripts/ledger-check.mjs` (23 cases so far). Imports
  inside modules the script loads need explicit `.js` extensions.
- Verify on **Pixel_API_36**: start the emulator and `npx expo start
  --dev-client`, then `adb reverse tcp:8081 tcp:8081` and open
  `flo://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`.
  Deep links like `flo://personalize`, `flo://streak`, `flo://settings` and
  `flo://dev/home-preview` work. The test account's email is in
  `.env.test.local`; never print the password. Its Appearance is Light and its
  card is Dusk: put both back after a check.
- After a hot-reload error the app can keep stale code; force-stop and relaunch
  rather than trusting HMR.
- Tick all three Tracer boxes once the emulator check passes (person's
  standing instruction), set `Status: resolved`, add a Comments line saying
  what wasn't checked, then commit with the attribution line.
- Review with `/mattpocock-skills:code-review` (two agents) when the budget
  allows; ticket 03 was self-reviewed only.
