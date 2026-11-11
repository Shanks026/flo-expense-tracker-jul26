# 09: Categories on the kit

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** Categories as two flat sections, Expense and Income, each with a + in its header, every category a row with its tinted circle; tapping opens the edit sheet, where Delete now lives. Spec 48 §Categories.

- `ScreenHeader` + large title; `SectionHeader`s with a + `HeaderIconButton` opening the sheet for that type; `ListRow`s with a chevron.
- The category sheet on `Sheet`, with a `danger` Delete in edit mode only; the in-use guard, its message and the confirm are unchanged. No row bin, no swipe.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Add an expense and an income category from each section's +
- [ ] Edit a category's name, icon and colour
- [ ] Deleting a category in use shows the guard and doesn't delete; deleting an unused one asks first, then deletes
- [ ] Emulator check in light and dark (delete test categories through the app)

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
