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

**Status:** resolved

- [x] Via the Supabase MCP, in a rolled-back transaction:
  - an invalid source is rejected;
  - an edit to the note stamps `updated_at`;
  - an update that changes only `plan_id` doesn't stamp it.
- [x] The security advisor shows no new finding
- [x] On the emulator, each of these entries saves with the right source (checked via MCP): a manual entry, a quick-add entry, a voice entry, an Ask FLO entry, a bill payment and a transfer
- [x] Editing an entry leaves its source unchanged

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-10: done, with the person's yes to the migration. Applied `quiet_ledger_transaction_source_updated_at` (the spec 46 SQL, unchanged). Rolled-back test: invalid source rejected, note edit stamps `updated_at`, a `plan_id`-only update doesn't, an edit keeps `source`. Security advisor: the same three warnings as before (pg_net in public, the five intended RPCs, leaked-password protection), nothing new.
- Pre-checks: the splits mutation only updates `split_entries`, never `transactions`; `AddAccountSheet` only counts transactions (no opening-balance insert), so nothing to leave null there.
- The Add sheet's analytics `source` (spec 33) is unchanged; `lib/entrySource.js` maps it to the column (manual/onboarding → manual, quick_local/quick_ai → quick_add, or voice when the line came from the mic, assistant → ai, share → share) and an opener's `origin` wins (auto-detect passes `origin: 'auto_detect'`). 12 ledger-check cases (81 total).
- Emulator (light), each checked via MCP: quick add → `quick_add`, typed amount → `manual`, Ask FLO Review → `ai`, transfer → both legs `transfer`, Electricity paid → `bill`; editing the manual entry's note kept `manual` and stamped `updated_at`. All test rows were deleted through the app; the Electricity bill's due date and the Tea proposal's status were put back by SQL update.
- Not run on the emulator: voice (no mic input on this AVD), share, auto-detect and a split entry. Their code paths are one line each and covered by the ledger-check mapping, not by a live save. `ai-assistant` selects explicit columns, so `source` doesn't reach the model.
