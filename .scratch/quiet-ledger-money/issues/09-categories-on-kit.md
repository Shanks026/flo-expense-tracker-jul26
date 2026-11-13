# 09: Categories on the kit

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** Categories as two flat sections, Expense and Income, each with a + in its header, every category a row with its tinted circle; tapping opens the edit sheet, where Delete now lives. Spec 48 §Categories.

- `ScreenHeader` + large title; `SectionHeader`s with a + `HeaderIconButton` opening the sheet for that type; `ListRow`s with a chevron.
- The category sheet on `Sheet`, with a `danger` Delete in edit mode only; the in-use guard, its message and the confirm are unchanged. No row bin, no swipe.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Add an expense and an income category from each section's +
- [x] Edit a category's name, icon and colour
- [x] Deleting a category in use shows the guard and doesn't delete; deleting an unused one asks first, then deletes
- [x] Emulator check in light and dark (delete test categories through the app)

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments
- 2026-11-13 (resolved): Categories on the kit (two sections with a + each, chevron rows) and the category sheet on `Sheet` with a new edit mode (name, icon, colour; Delete in edit mode only; type only when creating, since switching one in use would misfile its transactions). Writes moved to `lib/categories.js`. Checked: add an expense category from its + (gift, teal), rename it, the Income + opens with Income chosen, the in-use guard on Lunch, delete an unused one after the confirm; light and dark. A wrong-sheet tap during the check deleted the test account's unused expense "Other"; it was recreated by SQL (same name, icon, charcoal colour, is_default), with no transactions, budgets or bills pointing at it.
