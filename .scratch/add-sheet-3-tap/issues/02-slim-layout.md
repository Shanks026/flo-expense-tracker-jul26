# 02: The slimmer sheet layout

Spec: .claude/features/36-add-sheet-3-tap.md

**What to build:** The Add sheet is cut down to the two-field task. From top to bottom:
- the amount, focused on open, with a decimal keypad and a ₹ prefix (paise allowed);
- an **Expense | Income** toggle;
- the category grid from ticket 01;
- one collapsed **Details** row.

**Save** is pinned just above the keyboard, so it never needs the keyboard dismissed, and it's disabled until the amount is above zero.

**Details** expands to:
- the date, as **Today** and **Yesterday** chips plus a picker;
- a note;
- the account, only with 2+ accounts;
- a split, only once at least one open split exists;
- a "Transfer between accounts" link, only with 2+ accounts, until spec 38 moves Transfer to Accounts.

**Removed:** the Plan control (Plans are flagged off) and Transfer on the type toggle.

Editing an existing transaction keeps its plan untouched, and editing an existing transfer still opens the transfer form. The opener's prefill API (amount, type, note, date, categoryId, source, onDone) keeps working for share-intent, notifications and onboarding.

**Blocked by:** 01 (Smart default category and the 4×2 grid)

**Status:** ready-for-agent

- [ ] Opening the sheet focuses the amount with a decimal keypad; 12.50 saves as 12.5
- [ ] Save stays visible above the keyboard and is disabled at 0 or empty
- [ ] Details is collapsed by default; Today and Yesterday chips set the date
- [ ] With one account there's no account picker and no Transfer link; with two, both appear
- [ ] With no open splits there's no split control
- [ ] No Plan control; editing a transaction that has a plan keeps it
- [ ] Editing a transfer still works; a share-intent prefill still fills the amount and note
- [ ] Theme tokens only, correct in light and dark

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-26: Built in `components/AddTransactionSheet.js`.
  - **Order:** header → amount (`BottomSheetTextInput`, `decimal-pad`, sanitised to 2 decimals) → Expense | Income → the grid → a collapsed **Details** row.
  - **Details row:** its summary reads date · note · account · split. It expands to Today / Yesterday / Pick-a-date chips, the note, the account picker (new entries with 2+ accounts), the split picker (new expenses with an open split) and a "Transfer between accounts" link (new entries with 2+ accounts).
  - **Transfer mode** has a "Back to expense" link, keeps From/To, date and note, and still opens for an existing transfer.
  - **Save** moved into a `BottomSheetFooter`, disabled until the amount is above 0. The modal now has `keyboardBehavior="interactive"`, `keyboardBlurBehavior="restore"` and `android_keyboardInputMode="adjustResize"`, and the scroll content has bottom padding to clear the footer.
  - **Removed:** the Plan control, the collecting-plan default and the top "Adding to X" row (the account picker now lives in Details), plus their now-dead styles and the usePlans / useCollectingPlan imports. An explicit `plan_id` from Plan Detail still lands, and edits keep their plan.
  - **Prefills:** amounts keep paise (no more `Math.round`), and the opener can now pass `date`.
- Code review, left:
  - Save sitting above the keyboard on Android is the riskiest part. It relies on bottom-sheet's footer and keyboard handling at the 92% snap point, and needs the emulator check before green.
  - The note row keeps its old margins inside Details (cosmetic).
- Open emulator checks (paused): every acceptance line, especially Save above the keyboard and 12.50 saving as 12.5.
