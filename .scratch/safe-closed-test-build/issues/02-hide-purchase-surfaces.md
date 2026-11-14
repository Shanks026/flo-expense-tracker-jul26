# 02: Hide every purchase surface while billing is off

Spec: .claude/features/archive/32-safe-closed-test-build.md

**What to build:** While `billing` is off, a tester never sees a price, a Buy button or an "upgrade" entry point. That means hiding the Pro screen route and every way into it (Menu banner, upsell triggers, Pro badges and locks on the report and period pickers), plus the Shop's coin-pack Buy UI on the General tab. Coins stay earn-only. Card themes bought with coins still work, since no real money is involved. No "payments aren't live yet" dead end is reachable.

**Blocked by:** 01 (Build flags module with `billing` off, and Pro gates that always pass)

**Status:** ready-for-agent

- [x] The Menu shows no Pro banner, and nothing navigates to the Pro screen (a direct deep link to it lands somewhere safe, not on a price)
- [x] The report and period pickers show no Pro locks, badges or upgrade prompts
- [x] The Shop's General tab shows no coin packs, prices or Buy buttons; buying card themes with coins still works
- [x] A walk of Home, Menu, Settings, Shop, Reports and every former Pro trigger shows no price or Buy button
- [x] Turning `billing` on in a local dev build restores every surface

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-19: Verified on Medium_Phone_API_29 (lite debug build): Menu has no Pro banner; period picker and report export show no locks; `flo:///pro` redirects to Home; Shop General shows only the coin-priced Streak Freeze; bought the Blueprint card theme for 400 coins (1,000 → 600). With `billing: true`, the Menu "Upgrade to Pro" banner and the Pro screen prices came back; flag reverted.
