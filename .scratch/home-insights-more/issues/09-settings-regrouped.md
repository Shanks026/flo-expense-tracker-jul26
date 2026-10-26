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

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built. Sections under the profile card, in order:
1. **Account:** "Signed in with" Google / Email, from `app_metadata.providers`.
2. **Appearance:** System / Light / Dark (plus Personalize, economy only).
3. **Notifications:** the existing toggles, battery row, reminder times and bill reminder. Spec 39 settles the three toggles.
4. **Preferences:** summary period (+ start date for Custom). The currency picker would sit here, flagged off.
5. **Transaction Detection:** auto-detect builds only, unchanged.
6. **Data & export:**
   - "Export all transactions" CSV for every account (new `fetchAllTransactions` in `lib/export.js`, which pages past PostgREST's 1,000-row cap; Pro-gated, so open with `billing` off);
   - analytics consent;
   - Delete Account.
7. **About:** version from `expo-constants`. The privacy-policy row renders only once `PRIVACY_POLICY_URL` in the new `lib/about.js` is set. **No hosted policy exists yet**, so the row is hidden today.
8. **Developer** (`__DEV__` only): Koban gallery and the push test row (moved out of Notifications).
9. **Log out** last. It had no home since 03 removed the Menu sheet, which is where it lived.

Also removed: "Manage Categories" (More → Categories) and the version footer text. Reports' section went in 07.

Open (emulator checks paused): section order, a release-style build without the Developer group, export on device, light and dark.
