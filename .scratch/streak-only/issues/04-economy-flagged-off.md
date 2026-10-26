# 04: Economy flagged off

Spec: .claude/features/34-streak-only.md

**What to build:** FLO reads as a calm money app with no game economy, and bringing any piece back is a one-line change.
- `lib/flags.js` gains `economy: false`, in both store and personal builds.
- With it off, nothing renders for coins, XP, ranks, trophies, the spin wheel, the Shop (including coin packs), card themes, Personalize, the rewards hub and rewards history, reward bursts, the welcome bundle or rank-up. That covers header chips, routes, menu and settings entries, sheets, toasts and overlays.
- No new `reward_events` rows are written from any path (daily claim, login reward, trophies, purchases).
- The code stays, and existing data is untouched. Turning the flag on restores the economy as it was.

**Blocked by:** 02 ("No spend today" writes a streak mark) and 03 (Freezes are earned and spent automatically), so no-spend days and freezes already live outside `reward_events`

**Status:** ready-for-agent

- [ ] No coin, XP, rank, trophy, Shop, card-theme, Personalize, rewards or burst UI anywhere in the app
- [ ] Deep links to the Shop, Trophies and Personalize routes don't show those screens
- [ ] Logging, marking no-spend and opening the app write no new `reward_events` rows (checked via the Supabase MCP)
- [ ] The personal account's economy rows are unchanged
- [ ] Flipping `economy` to true brings the hidden UI back

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
