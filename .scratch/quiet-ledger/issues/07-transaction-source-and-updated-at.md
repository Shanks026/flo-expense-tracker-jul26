# 07: Recording where each entry came from

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** Every new entry records how it arrived, and real edits are timestamped, so Transaction detail can show its source and history.

- **Database** (the spec's Database section has the SQL):
  - a nullable `transactions.source`, with a check that allows only the nine values (manual, quick_add, voice, ai, share, auto_detect, bill, split, transfer);
  - a nullable `updated_at`;
  - a BEFORE UPDATE trigger that stamps `updated_at` only when the amount, type, category, note, date or account changes;
  - EXECUTE revoked from the API roles;
  - no backfill.
- **Writers:**
  - the Add sheet passes how its draft arrived. Where an entry point can't tell it, add an origin parameter to the opener;
  - marking a bill paid sets `bill`;
  - a split entry that creates a transaction sets `split`;
  - both transfer legs set `transfer`;
  - edits never change `source`.
- **Before building, check:**
  - what the transaction update in the splits mutation changes;
  - whether the account sheet's transaction insert is an opening balance. If it is, leave its source null.
- Add a row to the migrations table in `00-index.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Via the Supabase MCP, in a rolled-back transaction:
  - an invalid source is rejected;
  - an edit to the note stamps `updated_at`;
  - an update that changes only `plan_id` doesn't stamp it.
- [ ] The security advisor shows no new finding
- [ ] On the emulator, each of these entries saves with the right source (checked via MCP): a manual entry, a quick-add entry, a voice entry, an Ask FLO entry, a bill payment and a transfer
- [ ] Editing an entry leaves its source unchanged

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
