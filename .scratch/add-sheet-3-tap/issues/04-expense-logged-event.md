# 04: The full `expense_logged` event

Spec: .claude/features/36-add-sheet-3-tap.md

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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
