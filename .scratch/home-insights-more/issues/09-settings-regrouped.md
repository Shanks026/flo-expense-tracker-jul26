# 09: Settings regrouped

Spec: .claude/features/38-home-insights-more.md

**What to build:** Settings is laid out in clear sections, in this order:

1. **Account:** profile, sign-in methods.
2. **Appearance:** System / Light / Dark.
3. **Notifications:** the notification toggles. Spec 39 settles them at three.
4. **Preferences:** summary period.
5. **Data & export:** CSV, analytics consent, delete account.
6. **About:** version, privacy policy link.

**Log out** sits at the bottom. Developer diagnostics render in development builds only.

**Blocked by:** 02 (Split invites and currency picker flagged off), 07 (Insights: Analytics with Reports folded in)

**Status:** ready-for-agent

- [ ] Sections appear in the order above, with Log out last
- [ ] No dev diagnostics in a release-style build
- [ ] No currency picker or report settings remain
- [ ] Every row still works: edit profile, appearance, toggles, summary period, CSV, consent, delete account, privacy link
- [ ] Checked in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
