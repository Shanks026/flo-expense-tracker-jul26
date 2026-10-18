# Add sheet: 3-tap logging

Status: ready-for-agent
Source: v1-reset map — [Add sheet speed design](../../.scratch/v1-reset/issues/18-add-sheet-speed-design.md)

## Problem Statement

Logging is the core loop, and it's slow. The default category is alphabetically first, so most saves need a change. Categories hide in a horizontal scroll. The sheet carries 7 controls (type, account, date, plan, split, note) around a two-field task, and the keypad has no decimal key. Saving often triggers a reward burst and popups. The best case is 4–5 taps, often 6. Every daily log pays this cost.

## Solution

**+ → digits → Save = 3 taps when the default category is right:**
- a smart default category (time of day, or the remembered merchant on share-import);
- a 4×2 grid of the top 8 categories, plus "More";
- a decimal keypad with **Save pinned above the keyboard**;
- an Expense | Income toggle, with everything else in one collapsed **Details** row;
- after Save: a haptic and an Undo toast, then the moment queue decides whether anything else appears.

## User Stories

1. As a user, I want the amount focused the moment the sheet opens, so that I type immediately.
2. As a user, I want a decimal keypad, so that I can enter paise when I need to.
3. As a user, I want Save always visible above the keyboard, so that I never dismiss the keyboard to save.
4. As a user, I want Save disabled until the amount is above zero, so that I can't save empty entries.
5. As a user, I want the category I usually pick at this time of day selected by default, so that most saves need no category tap.
6. As a new user with no history, I want Food as the default, so that the first log is quick.
7. As a user sharing a bank SMS, I want the merchant's remembered category selected, so that repeat merchants are one tap.
8. As a user, I want my top 8 categories as a grid under the amount, so that the right one is one tap away and never off-screen.
9. As a new user, I want a sensible starting 8 (Food, Groceries, Transport, Shopping, Bills, Health, Fun, Other), so that the grid is useful from day one.
10. As a user, I want "More" to open all my categories, so that rare ones are still reachable.
11. As a user, I want to switch between Expense and Income with one toggle, so that income is easy without cluttering expenses.
12. As a user, I want date, note, account and split tucked into one Details row, so that the sheet stays simple.
13. As a user, I want Today and Yesterday as quick date chips, so that backdating needs no calendar most of the time.
14. As a user with one account, I want no account picker, so that I'm not shown choices I don't have.
15. As a user with no splits, I want no split control, so that the sheet only shows what I use.
16. As a user, I want the sheet to close with a light haptic after Save, so that I feel the save land.
17. As a user, I want a "Logged ₹X · Food" toast with Undo for 5 seconds, so that I can fix a mistake instantly.
18. As a user, I want no reward burst after saving, so that logging stays quick.
19. As a user over a budget limit, I want the warning in the bell instead of a toast on save, so that saving isn't noisy.
20. As a user, I want streak moments shown only by the moment queue after the sheet closes, so that nothing interrupts entry.
21. As a user in onboarding, I want the first expense in this same sheet, so that I learn the real thing.
22. As the person running FLO, I want `expense_logged` with source, whether the category was pre-filled, and `seconds_to_save`, so that I can hold the 3-tap target.

## Implementation Decisions

**Default category resolver (pure, one module).** In priority order:
1. the merchant memory (spec 40) for a pre-filled share;
2. the most-used category in the current time-of-day window over the last 30 days;
3. the most-used overall;
4. Food.

It's computed from the user's own transactions, and it feeds both the default and the grid order.

**Grid:**
- the top 8 by usage (30 days, falling back to all time), **4×2**, directly under the amount;
- the 9th tile is **More**, which opens the full category list (the existing manage/list UI in picker mode);
- new users get the seeded starting order.

**Layout:**
- the amount field (autofocused, decimal keypad, ₹ prefix);
- the **Expense | Income** segmented toggle;
- the grid;
- the **Details** row, collapsed, which expands to:
  - the date: Today and Yesterday chips plus a picker;
  - a note or merchant;
  - the account (only with 2+ accounts);
  - a split (only once ≥1 split exists).
- **Removed:**
  - the Plan control (Plans flagged off);
  - Transfer on the type toggle (moved to Accounts, shown with 2+ accounts, spec 38).

**Save:**
- pinned above the keyboard (keyboard-aware footer);
- inserts the transaction, calls `notifyChanged()`, closes the sheet, plays a light haptic, and shows the **Undo toast** (5 s);
- **Undo** deletes the row and calls `notifyChanged()`.

**After-save side effects:**
- **removed:** RewardBurst, budget/plan toasts, rank and trophy checks;
- **instead:** budget warnings go to the alerts sheet (bell), and streak moments are enqueued on the moment queue (spec 34) and shown after the sheet closes.

**Opening the sheet:**
- the `useAddTransactionSheet()` opener keeps its prefill API: amount, type, note/merchant, date, a source tag and `categoryId`;
- it adds `source: manual | share | onboarding` and records the open time for `seconds_to_save`.

**Analytics:** `expense_logged { source, category_was_prefilled, seconds_to_save }` (spec 33). Never the amount.

## Testing Decisions

- **A good test** counts taps and checks what's saved. Example: open → type 250 → Save produces a ₹250 Food expense today in 3 taps when the default is Food.
- **Seam 1, the emulator:**
  - time-of-day default: seed lunch-time Food history, open at noon, see Food selected;
  - grid order follows usage;
  - More lists everything;
  - Details hidden by default; account and split controls appear only when relevant;
  - Undo removes the entry;
  - no burst or popups during entry;
  - the onboarding path uses the same sheet.
- **Seam 2, Supabase via MCP:**
  - the saved row has the right category, date and account;
  - `events` gets `expense_logged` with no amount;
  - Undo leaves no row.
- **Prior art:** the existing AddTransactionSheet, its `useAddTransactionSheet` opener contract, and feature 08's on-device budget checks.

## Out of Scope

- "Save & add another".
- The share-import parser and merchant-memory table: spec 40. This spec only consumes them.
- Transfers' new home: spec 38.
- Category management changes.

## Further Notes

- The target median `seconds_to_save` is under 5 s. Watch it after the reset ships.
- Keep the opener's API backward-compatible so share-import and onboarding plug in without changes elsewhere.
