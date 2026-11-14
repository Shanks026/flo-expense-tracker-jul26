# 09: The You tab

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The You tab opens on the person's photo or initial, name and email, then flat rows. Spec 49 §You.

- A `LargeTitle` "You". Profile header: a 56 dp circle with `avatar_url` or the initial, the name in `ledgerType.title`, the email as a muted caption (hidden when it would repeat the title). A tap opens the edit-profile sheet.
- Rows: Cards (with `FLAGS.themes`), Ask FLO (with `FLAGS.ai`), Money (Budgets, Bills, Splits), Set up (Accounts, Categories), then FLO Pro (with `FLAGS.billing`) and Settings. `ListRow`s with sunk circle icons and chevrons, flat on `canvas`, routes unchanged.
- A pure rule, `profileInitial({ fullName, email })`.

**Blocked by:** 08 (the Cards name)

**Status:** done

- [x] The check script covers `profileInitial`: a name, leading spaces, email only, nothing ("?"), lowercase
- [x] Every row opens its screen; the header opens the edit-profile sheet
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal
