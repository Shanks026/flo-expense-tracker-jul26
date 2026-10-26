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

- [ ] None of the listed routes exist, and nothing in the app imports or navigates to them
- [ ] A fresh sign-up with Google and with email still runs opener → sign-in → reminder ask → Home
- [ ] The app bundles with no missing-module errors
- [ ] No database column or table is dropped

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
