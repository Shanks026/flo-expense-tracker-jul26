# 02: Split invites and currency picker flagged off

Spec: .claude/features/archive/38-home-insights-more.md

**What to build:** Two new build-time flags.

- **`splitInvites: false`:**
  - the split share/invite UI and the `/join/[code]` route are hidden;
  - the split core still works solo: create a split, add entries, settle, export.
- **`currencyPicker: false`:**
  - the currency picker is hidden everywhere;
  - new accounts are created in INR;
  - existing non-INR accounts still show amounts in their stored currency.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No invite, share or join option on any split screen; a `/join/<code>` link does not open a join flow
- [ ] Create a split, add entries, settle up and export all work (feature 31's on-device settling checklist ticked)
- [ ] No currency picker anywhere, including account creation and Settings
- [ ] A newly created account has `currency = 'INR'` in Supabase (MCP)
- [ ] A seeded non-INR account still displays its own currency

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built in `1fbd606`.
- **`splitInvites: false`:**
  - the split screen's "Invite people" and "Turn off the invite link" rows are hidden;
  - `/join/[code]` redirects to Home without parking the code;
  - `PendingInviteHandler` isn't mounted.
- **Kept on purpose:** the split's Share (as text or PDF) and Export CSV. They're exports of the summary, not invites.
- **`currencyPicker: false`:**
  - the picker is hidden in Settings, the account sheet and the bill sheet;
  - new accounts and bills seed INR instead of `profiles.currency`;
  - existing accounts and bills keep their stored currency.
- Open (emulator checks paused): feature 31's on-device settling checklist; a new account's `currency = 'INR'` via MCP after creating one on device; a non-INR account still shows its own currency.
