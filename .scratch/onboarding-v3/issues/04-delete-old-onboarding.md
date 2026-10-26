# 04: The short path (2c): delete the old onboarding screens

Spec: .claude/features/35-onboarding-v3.md

**What to build:** Subticket 2c of "the short path". Nothing routes to the old flow any more, so it's removed:
- the intro questions: problem, solution, name, age, income, goal, leak, habit, reflection;
- the setup screens: account, currency, categories, balance, budget, reports, journey;
- the tour route group, the welcome bundle and done;
- the forked onboarding expense screen.

Their step lists, the pre-auth answer draft and their helpers go with them, along with any components nothing uses any more. Profile columns such as `onboarding_answers` stay. The app behaves exactly as it did after 2b: this is cleanup with no change the user can see.

**Blocked by:** 03 (The short path (2b): new opener and Google-first sign-up)

**Status:** ready-for-agent

- [x] None of the listed routes exist, and nothing in the app imports or navigates to them
- [ ] A fresh sign-up with Google and with email still runs opener → sign-in → reminder ask → Home
- [x] The app bundles with no missing-module errors
- [x] No database column or table is dropped

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-26: Built.
  - **Deleted, 20 routes:** 9 intro questions, 7 setup screens, done, the welcome bundle, the onboarding expense screen and the tour route.
  - **Deleted, everything only they used:** `OnboardingChoice`, `TourScreen`, the dev-only `OnboardingDevBack` (and its mount in the root layout), `assets/tour/`, and 14 mascot images nothing references.
  - **Cut down:**
    - `lib/onboarding.js` is now just the step list, `FIRST_STEP_ROUTE`, `isStepRoute` and `useOnboarding().finish()`.
    - `lib/onboardingDraft.js` is just the introSeen flag; the answer draft and its helpers are gone.
  - **Updated:** two stale comments, in Settings and OnboardingMascot.
- **Checks:**
  - A grep finds no import of, or navigation to, any deleted route or symbol.
  - An esbuild bundle of every file under `app/` resolves every import (images stubbed, packages external).
  - No database change was made.
- Code review: `lib/categoryBank.js` is no longer imported. I kept it on purpose, because its header says the `handle_new_user` seed copies its names, icons and colours. A later cleanup could move it into the docs.
- Open emulator check (paused): fresh Google and email sign-up still run opener → sign-in → reminder ask → Home.
