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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
