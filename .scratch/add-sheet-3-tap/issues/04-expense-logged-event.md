# 04: The full `expense_logged` event

Spec: .claude/features/archive/36-add-sheet-3-tap.md

**What to build:** Every new expense records `expense_logged` with all three props from spec 33:
- `source`: `manual`, `share` or `onboarding`;
- `category_was_prefilled`: true when the saved category is the one the sheet chose on open;
- `seconds_to_save`: whole seconds from the sheet opening to Save.

The share-intent opener passes `source: share`. Notification and auto-detect opens stay `manual` until their own specs tag them. The amount is never sent. This is what holds the 3-tap target (median `seconds_to_save` under 5 s).

**Blocked by:** 03 (Quiet save with Undo)

**Status:** ready-for-agent

- [ ] With consent on, a manual save leaves an `expense_logged` row with source, category_was_prefilled and seconds_to_save, and no amount
- [ ] Changing the category before saving records category_was_prefilled false
- [ ] A share-intent save records source share
- [ ] Income saves and edits record nothing

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-26: Built.
  - **The event:** `expense_logged` now carries `source`, `category_was_prefilled` and `seconds_to_save`, and never the amount.
    - The sheet records when each open began and which category it picked by itself: the opening default, a late-loading default, or the re-default when the type is switched. A payload `categoryId` also counts as pre-filled.
    - `seconds_to_save` is timed at the Save tap, so the insert's round trip isn't counted.
  - **Share-intent:** opens now pass `source: 'share'`. Notification and auto-detect opens stay `manual` until spec 39 and the auto-detect work tag them.
  - **Edits and income:** they record nothing, as before.
- Code review: fixed, `seconds_to_save` was first measured after the insert. Left: notification and auto-detect saves are tagged `manual`.
- Open emulator checks (paused): every acceptance line, read back through the Supabase MCP.
