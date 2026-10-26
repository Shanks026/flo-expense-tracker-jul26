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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
