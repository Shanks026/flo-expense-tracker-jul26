# Handoff: Quiet Ledger Phase 5 (Moments and the rest)

**Last updated:** 2026-11-14, after tickets 01–09 and the Ask FLO bubble revert. Next session: ticket 10 (Pro and upsell, flag off).

Spec: `.claude/features/49-quiet-ledger-moments-and-the-rest.md`. Every decision in the spec 46–48 handoffs still holds (`.scratch/quiet-ledger/`, `.scratch/quiet-ledger-onboarding/`, `.scratch/quiet-ledger-money/`).

| Ticket | Blocked by | State | Commit |
|---|---|---|---|
| 01 Streak mark and milestone celebration | — | done (real queue path not seen on device) | `a51e6e1`, `69b28d6` |
| 02 Bill detail fixes and one due wording | — | done | `26b9024` |
| 03 Bills-due sheet | 02 | done (real queue path not seen on device) | `b5784f9` |
| 04 Share-usage ask and toast | — | done | `e30a9a3` |
| 05 Alerts grouped | — | done (empty state and Due soon not seen on device) | `5fc4dd9` |
| 06 Streak screen | 01 | done (a lit count not seen on device) | `9a94a2f` |
| 07 Ask FLO chat and Past chats | — | done; bubble revert done (voice not checked) | `e6f931c`, `f2d54f9` |
| 08 Cards (was Personalize) | — | done | `bc3a3ee` |
| 09 You tab | 08 | done | see git log |
| 10 Pro and upsell (flag off) | — | ready | |
| 11 Cleanup | 01–10 | blocked by 08, 09, 10 | |

**Suggested order:**
1. ~~The Ask FLO bubble revert~~ done (`f2d54f9`: radius 20, bottom-right 8).
2. ~~Ticket 08 Cards~~ done.
3. Ticket 09, ticket 10, then ticket 11.

## Decisions (2026-11-14, with the person)

- **Test seams** stay the same two: the check script (`node --no-warnings scripts/ledger-check.mjs`, 506 passing) plus an emulator check per ticket.
- **The economy screens are left as they are.** The cleanup keeps the old tokens, the theme context and Manrope while those screens import them. No migration in this phase.
- **The celebration's seven-day row runs oldest → today,** like the Streak calendar. The person kept it.
- **Ask FLO question bubble: one corner tighter (supersedes "fully rounded").**
  - During ticket 07 the person first asked for fully rounded bubbles; that's what is committed in `e6f931c`.
  - They then reversed it: one side partly rounded, the other fully rounded, as in the original plan and the pre-redesign bubble (radius 16, bottom-right 8).
  - Make the tail corner (bottom-right, on the sending side) the smaller one, and keep the rest large.
  - The style is `userBubble` in `app/assistant.js`, currently `borderRadius: ledgerRadius.card` on every corner.
- **Cards (ticket 08):**
  - The route stays `/personalize`; only the visible name is "Cards". Ticket 09's You row should push `/personalize` and read "Cards".
  - The preview is Home's own card face, `AccountCardFace` (exported from `components/ledger/AccountCardCarousel.js` with `CARD_ASPECT`). `PersonalizePreview` is deleted.
  - Locks use `FLAGS.economy || FLAGS.themeGating`, because `useCardThemes` reads ownership under `themeGating`. Both are off, so nothing is locked.
  - Swatches have a hairline edge so Ink shows on the dark canvas. Picking Christmas again replays its animation (the preview is keyed by design).
  - The toast still says "Applied", as before.
- **Mark paid on bill rows is the round green check.** This was the person's call on 2026-11-12. It is now the shared `components/BillPaidButton.js`, used by the Bills list and the bills-due sheet.
- **Budget alerts follow the shared rule** (past 80 % warns; 100 % and over is danger, and exactly 100 % reads "Used up"). That covers Alerts, the Budgets list and the budget save toast.
  - Insights' "Frequently over" (`lib/analytics.js`) still uses the old `budgetStatus` in `hooks/useBudgets.js`, deliberately. **Ticket 11 must keep it.**
- **Bill alerts and the bills-due sheet show each bill's own icon** (`billIconKey`).
- **The streak flame lights only when today counts,** on the Streak screen as on Home's chip. A live streak not yet logged today keeps its count in ink.
- **Past chats:** Delete moved from a bin on each row into each row's ⋯ menu. New chat is always in the Ask FLO header.
- **Kit additions:**
  - `StreakMark`;
  - `EmptyState` takes `illustration={null}` for no object;
  - Kit previews under Settings → Developer → Kit:
    - "Show the 7-day celebration";
    - "Show the bills-due sheet", which uses the account's real bills;
    - "Show the share-usage ask", whose answers are real (it skips itself while sharing is on);
    - a Toast row with Success, Error and Plain.
  - The moment queue shows each moment at most once a day, so use these previews to see one again.

## For ticket 11 (cleanup), found while building

- **Already gone:** `BreakdownTable` (deleted in 07), and the More tab's `Row`/`RowGroup` use (09; check whether `components/Row.js` still has importers).
- **Duplicated in 09:** the You tab (`app/(tabs)/more.js`) has its own `Group` helper, a near copy of the one in `app/settings.js` (Settings' also skips `Callout`). It could become one kit component.
- **Now without importers, to check and delete:**
  - `components/StreakDays.js` and `components/StreakFlameIcon.js` (old flame cells);
  - `Confetti`;
  - the day-one recap copy and `recapCta` in `lib/koban.js` (keep `pickRecap`'s milestone pool, `streakHeadline` and `streakHero`).
- **Stale comment:** `components/ProgressBar.js` mentions `budgetStatus()`.
- **Keep:** `budgetStatus` (see Decisions).

## Gotchas

- **Inline Python through bash can fail.** A `python - <<'EOF'` heredoc containing JSX quotes sometimes gives `unexpected EOF while looking for matching`. Write the script to the scratchpad with Write, then run `python <file>`.
- **Escaped quotes in check names.** An escaped apostrophe inside a `check('…', '…')` name written from Python loses its escape. Avoid apostrophes in check names.
- **Emulator taps:**
  - Half-size screenshots (450 wide) map ×2.4 to device pixels.
  - Prefer tapping by label from a `uiautomator dump`, and run `MSYS_NO_PATHCONV=1 adb shell …` so Git Bash doesn't rewrite `/sdcard`.
  - Settings → Theme: Light is at (632, 1303) and Dark at (911, 1303), but only with Settings scrolled to the top.
  - Home's bell is at (972, 218) and the flame chip at about (707, 218).
- **Taps can land in text fields.** A tap meant for a switch can focus a text field and type into it; this happened with a bill's name. Read the field back before saving, and fix it before anything is written.
- **Toast Undo has a time limit.** Tap it within about 1 s of saving. A slow tap opened Streak, and the test entry had to be deleted through the app.
- **Fast refresh can miss changes.** It doesn't always pick up new Kit sections or `_layout.js` edits. Reload with `adb shell input keyevent 46 46` (R R).
- **A hot reload can leave Ask FLO stuck.** Once, after Past chats had been opened straight from a deep link, picking a past chat showed an empty chat until a full reload. It wasn't reproduced after reloading.
- **Saving a bill fills in its icon.** It stores an icon from the bill's name (ticket 05 of spec 48). If you only meant to toggle something, put `icon` back by SQL, filtering by `user_id`.

## State left behind

- **Test account (`f16c9544-…`):**
  - Appearance is Light.
  - Usage sharing is on (`analytics_consent` true).
  - Personal is the active account.
  - Its streak is 0 (it broke on 13 Nov; that's real data, not a test change).
  - It has no test transactions, splits or test chats.
  - Electricity is active again with `icon` null, and Netflix is unchanged.
  - The share-usage answer is stored on the emulator (AsyncStorage), so the ask won't come back by itself.
- **Not committed, on purpose:** `day-themes/` and `design-inspirations/`.
- **Running:** the emulator and Metro (`npx expo start --dev-client`, log in the session scratchpad).
