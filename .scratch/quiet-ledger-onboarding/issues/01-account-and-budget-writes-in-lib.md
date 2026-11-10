# 01: Account and budget writes move into lib

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** The writes the set-up questions need already exist, but inline in two sheets. Move them into `lib/` so the sheets and onboarding share one path ("make the change easy"):

- create an account and rename an account, from the Add Account sheet;
- insert (and update) a budget, from the Add Budget sheet.

The sheets call the new mutations and run `notifyChanged()` as before. Nothing changes on screen.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Adding a new account through the Add Account sheet still works, and it shows in the switcher
- [ ] Renaming an account through the sheet still works
- [ ] Adding and editing a budget through the Add Budget sheet still works; the free-plan gate is unchanged
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
