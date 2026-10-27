# Onboarding: 4 screens to the first expense

Status: ready-for-agent
Source: v1-reset map — [Onboarding target flow](../../.scratch/v1-reset/issues/03-onboarding-target-flow.md)

## Problem Statement

A new user goes through about 16 screens and 25 taps before logging a first expense, then 4 more setup screens, a 10-card tour, a welcome bundle and a rank-up popup: about 32 screens in all. 6 of the 10 intro questions configure nothing, and sign-up leads with email and password. Every screen is a chance to quit before the app has shown any value.

## Solution

**Four screens, about six taps to first value:**
1. **The opener:** one line of value, **Continue with Google**, and "Other options / I have an account". It also has the analytics opt-in switch.
2. **The Google account picker.**
3. **The first expense,** in the real Add sheet over an empty Home. It can be skipped.
4. **The reminder ask:** "Logged. Want a 9 pm nudge?", which triggers the OS permission prompt.

Then Home, where 1–2 coach marks replace the tour. Everything else is defaulted or asked later, in context.

## User Stories

1. As a new user, I want the first screen to tell me in one line what FLO does, so that I know why to continue.
2. As a new user, I want to continue with Google in one tap, so that sign-up isn't a form.
3. As a new user without Google, I want email sign-up under "Other options", so that I'm not locked out.
4. As a returning user on a new phone, I want "I have an account" on the first screen, so that I can sign straight in.
5. As a new user, I want to decide on the opener whether to share anonymous usage, so that I consent before anything is collected.
6. As a new user, I want to log my first expense right after signing in, in the same sheet I'll use every day, so that I learn the app by using it.
7. As a new user who has nothing to log right now, I want to skip the first expense, so that I'm not forced to make one up.
8. As a new user, I want FLO to ask about a 9 pm reminder right after my first log, so that the permission prompt makes sense.
9. As a new user, I want to say "Not now" to the reminder, so that I keep control of notifications.
10. As a new user, I want my account, currency (INR), categories and weekly report set up for me, so that I don't answer questions that don't matter yet.
11. As a new user, I want no name, age, income, goal or habit questions, so that I'm not quizzed before I see value.
12. As a new user on Home for the first time, I want a coach mark pointing at +, so that I know how to log.
13. As a new user after my first log, I want a coach mark pointing at the streak, so that I learn what keeps me going.
14. As a new user, I want no celebrations during onboarding, so that the flow stays fast.
15. As an existing user who already onboarded, I want never to see this flow, so that nothing changes for me.
16. As a test user stuck halfway through the old onboarding, I want to restart in the new flow, so that I'm not stranded.
17. As a new user, I want to see Koban on the opener, so that FLO has a friendly face.
18. As the person running FLO, I want `onboarding_step_viewed` and `signup_completed` events, so that I can see the funnel.
19. As the person running FLO, I want onboarding to set `onboarded_at` the moment the user reaches Home, so that routing stays reliable.

## Implementation Decisions

**Routes:**
- **Kept:** the intro opener (rewritten) and the sign-in screen in signup mode (Google first, email behind "Other options").
- **Deleted:**
  - intro: problem, solution, name, age, income, goal, leak, habit, reflection;
  - setup: account, currency, categories, balance, budget, reports, journey;
  - the tour route group, the welcome bundle, done;
  - the forked onboarding expense screen.

  Deletion is allowed because onboarding screens are flow, not features. Profile columns like `onboarding_answers` and `tour_seen_at` stay.

**Flow ownership:** the RootNavigator / OnboardingGate redirect split (in the root layout) is preserved. The onboarding step list becomes **opener → (auth) → first expense → reminder ask**. `onboarded_at` is written when the user finishes or skips the reminder ask.

**Defaults written at sign-up:**
- the account "Personal";
- currency INR (the picker is hidden; spec 38);
- preset categories seeded silently;
- the weekly report on (the weekly recap in spec 39);
- the reminder time 21:00 local.

**First expense:**
- onboarding opens **the real Add sheet** (spec 36) over an empty Home, using the same category grid;
- "Not now" closes it and goes to the reminder ask;
- the sheet passes `source: onboarding` to `expense_logged`.

**Reminder ask:**
- **Turn on:** requests the OS notification permission and registers the push token.
- **Not now:** leaves reminders off and goes to Home.

**Coach marks:**
- a small reusable coach-mark overlay, used once each: **the + button** on first Home, and **the streak chip** after the first log;
- seen-state is stored locally;
- these are character moments (Koban), suppressed while any queue moment is active.

**Existing users:** `onboarded_at` set means skip entirely. Accounts stuck mid-flow fall into the new step list from its start.

**Analytics:** `onboarding_step_viewed {step}` for opener, auth, first_expense and reminder_ask, and `signup_completed {method}` (spec 33). The consent switch sits on the opener.

**Koban:** the opener shows Koban (spec 37's component) in a hello pose.

## Testing Decisions

- **A good test** walks the real flow on a fresh install and counts screens and taps to the first saved expense: the target is 4 screens and about 6 taps.
- **Seam 1, the emulator:**
  - fresh sign-up with Google;
  - fresh sign-up with email;
  - skip the first expense;
  - deny the notification permission;
  - sign in as an already-onboarded user and see no onboarding;
  - coach marks appear once each;
  - no celebration during the flow.
- **Seam 2, Supabase via MCP:**
  - the new profile has `onboarded_at`, INR, the default account and seeded categories;
  - no `onboarding_answers` written;
  - the consent flag matches the switch.
- **Prior art:** feature 12's on-device onboarding checklist and the OnboardingGate redirect notes in the root layout.

## Out of Scope

- **Anonymous-first sign-up** (post-launch backlog).
- **Contextual prompts later in the journey,** such as "Suggest a budget after 14 days" or "Bills on first visit". Each owning screen handles its own.
- **The Add sheet's internals:** spec 36.
- **Koban's art:** spec 37.
- **Forgot password:** spec 42.

## Further Notes

- This supersedes the July 2026 deferral ("trim onboarding only after feature 28 ships").
- Google OAuth's consent screen must be "In production" before the closed test, or unlisted testers can't sign in (closed-test ticket).

## Revised after the first phone check (2026-10-27)

- **Google sign-in is parked.** Email only for now. The Google buttons are commented out in `app/onboarding/intro/opener.js` and `app/sign-in.js`; `signInWithGoogle` stays in AuthContext, so uncommenting brings it back.
- **The opener's main button is "Create account"**, which opens sign-up mode. "Other options" is gone, and "Already have an account? Sign in" stays.
- **The analytics switch left the opener.** It's now a one-time ask after the 3rd expense (33-product-analytics.md, same date).
