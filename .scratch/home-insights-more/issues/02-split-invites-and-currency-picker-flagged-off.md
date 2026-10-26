# 02: Split invites and currency picker flagged off

Spec: .claude/features/38-home-insights-more.md

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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
