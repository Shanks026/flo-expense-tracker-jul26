# 02: Hide every purchase surface while billing is off

Spec: .claude/features/32-safe-closed-test-build.md

**What to build:** While `billing` is off, a tester never sees a price, a Buy button or an "upgrade" entry point. That means hiding the Pro screen route and every way into it (Menu banner, upsell triggers, Pro badges and locks on the report and period pickers), plus the Shop's coin-pack Buy UI on the General tab. Coins stay earn-only. Card themes bought with coins still work, since no real money is involved. No "payments aren't live yet" dead end is reachable.

**Blocked by:** 01 (Build flags module with `billing` off, and Pro gates that always pass)

**Status:** ready-for-agent

- [ ] The Menu shows no Pro banner, and nothing navigates to the Pro screen (a direct deep link to it lands somewhere safe, not on a price)
- [ ] The report and period pickers show no Pro locks, badges or upgrade prompts
- [ ] The Shop's General tab shows no coin packs, prices or Buy buttons; buying card themes with coins still works
- [ ] A walk of Home, Menu, Settings, Shop, Reports and every former Pro trigger shows no price or Buy button
- [ ] Turning `billing` on in a local dev build restores every surface

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
