# 06: Calm feedback

Spec: .claude/features/37-design-system-and-koban.md

**What to build:** The app feels fast and responds to touch, without decorative motion.
- Content no longer fades in on every load; it simply appears once ready. Entrance animation is kept only for first-time moments (onboarding, celebrations, coach marks).
- Destructive confirmations (delete a transaction, budget, bill, account and so on) give a light haptic when confirmed, matching the save haptic from spec 36.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Home and the other tabs show their content without a fade-in after loading
- [ ] Onboarding, celebrations and coach marks still animate in
- [ ] Each destructive confirmation gives one light haptic

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- **No fade-in on load:** `components/FadeIn.js` is now a plain `View` unless a caller passes `animate`, so all 19 load-time uses (Home, Insights, Transactions, Bills, Budgets, Plans, Splits) just appear once their data is ready, with their layout unchanged. With `animate`, it still eases in (using `motion.base`) and respects reduced motion, for a first-time moment that wants it. Onboarding, the celebrations and coach marks use their own Reanimated entrances and are untouched. No count-up number animations are in use.
- **Destructive haptic:** new `lib/haptics.js` → `destructiveHaptic()` (one light impact, matching the Add sheet's save). It fires once at each destructive commit point:
  - after an alert confirm: delete category, delete account (from its sheet), turn off a split invite link, remove a split member, delete a split entry, delete a split, and the dev-only clear-detection-log;
  - after the Settings delete-account dialog;
  - on the delete tap in the bill, budget, plan, split-person and transaction sheets, where that tap is the confirmation.
- Open (emulator checks paused): the tabs show content without a fade, and each destructive confirm gives one haptic. `expo-haptics` is already in the build from spec 36.
