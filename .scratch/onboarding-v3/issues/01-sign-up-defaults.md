# 01: Sign-up defaults on the server

Spec: .claude/features/35-onboarding-v3.md

**What to build:** A brand-new account is ready to use the moment it exists, without any onboarding screen writing setup data. Sign-up leaves it with:
- the "Personal" account, in INR;
- the preset categories;
- the weekly report on;
- a 21:00 local reminder time.

Today the categories only appear because the old categories screen inserts them (the sign-up trigger stopped seeding them), and the currency comes from the old currency screen. So this has to land before those screens go. The defaults are written server-side at sign-up, so they hold for Google and email sign-up alike. Existing accounts are untouched. The migration SQL is shown to the person before it's applied.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A new sign-up's profile and "Personal" account have currency INR
- [x] The preset categories exist for the new user, with no duplicates if a client also inserts them
- [x] The weekly report is on and the reminder time is 21:00 for the new user
- [x] Sign-up writes no `onboarding_answers`
- [x] Existing users' accounts, categories and settings are unchanged
- [x] Supabase advisors show nothing new after the migration

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-26: Migration `signup_defaults_categories_and_weekly_report` applied, with the SQL shown to the person first. `handle_new_user` now sets `report_cadence = 'weekly'` and `report_cadence_started_at = now()` on the new profile. It also seeds 9 expense categories (Food, Groceries, Transport, Shopping, Bills, Rent, Health, Entertainment, Other) and 3 income (Salary, Freelance, Other), with `on conflict do nothing`. The person picked this list over the old 6 that onboarding pre-ticked. INR and the 21:00 evening reminder were already column defaults.
- Verified through the Supabase MCP, which counts as Verified for a Supabase-only change. A simulated sign-up in a rolled-back transaction got currency INR on the profile and on "Personal", cadence weekly with a start time, evening 21:00, no `onboarding_answers`, no `onboarded_at`, and exactly the 12 categories. No rows were left behind. The trigger only fires on new users, so existing ones are untouched. The security advisor shows only the 4 WARNs that were already there.
- Docs: `00-index.md` (the migrations table and the `categories` row) and the header comment in `lib/categoryBank.js` (which the seeded list copies).
- Still left for 02: `profiles.reminders_enabled` defaults to true, so "Not now" on the reminder ask must turn it off explicitly.
