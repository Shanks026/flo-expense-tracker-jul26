# 01: Build flags module with `billing` off, and Pro gates that always pass

Spec: .claude/features/32-safe-closed-test-build.md

**What to build:** Add a single build-time flags module in `lib/` (static booleans, no remote flags) with one flag, `billing`, set to off. Later specs add their flags to the same module. While `billing` is off, every create-time Pro gate passes, for accounts, budgets, plans and splits, including the entitlement and limit checks behind the upsell sheet. A tester can create as many as they need and the upsell sheet never opens. The entitlement read path stays as it is, so turning the flag on later brings the gates back unchanged.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One flags module exists, exposing `billing` (off) as a static build-time boolean
- [ ] With billing off, a Free account can create 2+ accounts, 3+ budgets, 2+ plans and 2+ splits with no wall and no upsell sheet
- [ ] The entitlement read path and the Free limits are unchanged; turning `billing` on in a local dev build brings the existing gates back
- [ ] No data-model or schema change

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
