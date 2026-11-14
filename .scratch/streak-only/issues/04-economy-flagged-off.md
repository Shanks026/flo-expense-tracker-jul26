# 04: Economy flagged off

Spec: .claude/features/archive/34-streak-only.md

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

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- `lib/flags.js` → `economy: false`, the same in every build.
- **Writes:** all 11 economy writers (`lib/rewardsMutations.js` ×9: daily log, no-spend, buy freeze, use freeze, milestone, spin, trophy, welcome bundle, rank; `lib/cardThemeMutations.js` ×2: buy and equip theme) return a no-op result first thing when the flag is off. That stops new `reward_events` rows at the source whoever calls them (the Add sheet's daily claim included). The pending login reward is never stored or burst.
- **UI:** the Home coins/freezes/level chip and the Trophy and Shop buttons are hidden; the account card uses the default theme instead of the equipped one; `/shop`, `/trophies` and `/personalize` redirect to Home; `RankUpCelebration` and `TrophyToast` aren't mounted; `showRewardBurst` does nothing; the Settings Personalize row is hidden; `StreakCelebration` shows no milestone reward and chains no spin wheel. The rewards history sheet only opened from the hidden Home chip.
- Code and data untouched: economy reads (`useRewards`, `useTrophies`, `useCardThemes`) still run, and flipping the flag on restores everything.
- Baseline for the "no new rows" check, via the MCP: `reward_events` has 176 rows, the latest at 2026-10-21 03:39 UTC. After the rebuild, any row newer than that is a leak (or a fresh account after the planned wipe should have 0).
- **Side effect to decide on:** Personalize also held the accent colour and the Light/Dark appearance switch, so those are unreachable until spec 37 adds System/Light/Dark. Say if they should stay reachable now (for example, a Personalize that hides only card themes).
- Open (emulator checks paused): no economy UI anywhere, deep links redirect, and no new `reward_events` rows after logging, marking no-spend and opening the app.
