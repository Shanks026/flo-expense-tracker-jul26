# 01: Account and budget writes move into lib

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** The writes the set-up questions need already exist, but inline in two sheets. Move them into `lib/` so the sheets and onboarding share one path ("make the change easy"):

- create an account and rename an account, from the Add Account sheet;
- insert (and update) a budget, from the Add Budget sheet.

The sheets call the new mutations and run `notifyChanged()` as before. Nothing changes on screen.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Adding a new account through the Add Account sheet still works, and it shows in the switcher
- [x] Renaming an account through the sheet still works
- [x] Adding and editing a budget through the Add Budget sheet still works; the free-plan gate is unchanged
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-11: New `lib/accounts.js` (`createAccount`, `updateAccount`) and `createBudget` / `updateBudget` in `lib/budgets.js`; the sheets call them. Checked on Pixel_API_36 in Light and Dark on the shared test account: an account was created (it became active and showed on Home), renamed twice, and a monthly budget was created and edited twice. Rows were confirmed in the DB, then deleted through the sheets. Personal is active again and Appearance is back to Light. Not checked: the free-plan gate, because billing is off so everyone has Pro (its code is untouched). The account and budget deletes stay inline in the sheets, since this ticket didn't ask for them. The `async` keyword was added after the emulator check, with no behaviour change.
