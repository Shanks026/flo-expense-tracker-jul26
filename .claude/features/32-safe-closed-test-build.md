# Safe closed-test build

Status: ready-for-agent
Source: v1-reset map — [Safe closed-test build](../../.scratch/v1-reset/issues/01-safe-closed-test-build.md), [Crash reporting](../../.scratch/v1-reset/issues/13-crash-reporting-sentry-vs-expo-observe.md), [Package id](../../.scratch/v1-reset/issues/14-package-id-firebase.md)

## Problem Statement

FLO can't reach Google Play production until it has run a closed test with at least 12 testers for 14 days in a row, and that clock hasn't started. Today's app isn't safe to put in front of testers or Play review:
- it shows prices and Buy buttons for things that can't be bought;
- it walls users off at Pro limits with no way through;
- it has a dead "Forgot password?" link and a tour full of placeholder images;
- its Settings show developer-only diagnostics;
- it still carries the placeholder package id `com.anonymous.flo`, which becomes permanent at the first upload;
- it has no crash safety net;
- a cloud EAS build would crash at boot because the Supabase keys don't reach it.

The person running FLO wants the clock started now, on today's app. The lean v1 reset then reaches testers as weekly fix builds during the test.

## Solution

Ship today's app plus a short safety list, as the first lite AAB on Play's closed-testing track:
- no purchase surface anywhere, and no limit wall;
- no dead ends or placeholder content;
- no developer UI;
- a recoverable error screen instead of a crash;
- the permanent package id `app.floexpense.tracker`;
- an EAS configuration that builds cleanly in the cloud.

Everything else ships unchanged and is replaced by later fix builds: the long onboarding, the coin economy (earn-only), themes, Home and the Add sheet. Testers are told it's an early build that changes weekly.

## User Stories

1. As a closed-test tester, I want to install FLO from Play's testing track, so that I can use it like a real user without sideloading.
2. As a tester, I want FLO to never show me a price or a Buy button, so that I'm not confused by purchases that don't work.
3. As a tester, I want to create as many accounts, budgets and splits as I need, so that no Pro limit stops me in the middle of testing.
4. As a tester, I want any "upgrade" entry points removed, so that I never hit a "payments aren't live yet" dead end.
5. As a tester, I want to never see a "Forgot password?" link that does nothing, so that the sign-in screen doesn't look broken.
6. As a tester signing in with Google, I want sign-in to just work, so that I can get into the app on day one.
7. As a tester finishing onboarding, I want to skip straight past the placeholder tour, so that I don't see unfinished screens.
8. As a tester, I want Settings to show only real user settings, so that the app doesn't look like a debug build.
9. As a tester, if something crashes while rendering, I want a friendly error screen with a way to recover, so that I can keep using the app instead of it closing.
10. As the person running FLO, I want crashes and ANRs to show up in Play Console's Android vitals, so that I can fix what testers hit without any third-party SDK.
11. As the person running FLO, I want the store build to have no notification-listener (auto-detect) code at all, so that Play never sees a restricted permission.
12. As the person running FLO, I want the app's package id to be `app.floexpense.tracker`, so that the permanent store identity is neutral and doesn't carry my name.
13. As the person running FLO, I want my personal auto-detect build to install alongside the Play build as `app.floexpense.tracker.personal`, so that I can run both on one phone.
14. As the person running FLO, I want push notifications to keep working under the new package ids, so that the reminder pipeline isn't broken by the rename.
15. As the person running FLO, I want EAS cloud builds to receive the Supabase URL and key, so that the AAB doesn't crash at boot.
16. As the person running FLO, I want version codes managed remotely by EAS, so that every upload gets a fresh, higher version code automatically.
17. As the person running FLO, I want the CAMERA permission blocked and the navigation-bar config fixed, so that the manifest is clean and expo-doctor passes.
18. As the person running FLO, I want `expo-share-intent` at 5.1.1, so that share-to-FLO keeps working on the supported version.
19. As a Play reviewer, I want the app to contain no purchase flows or prices, so that the first build needs no in-app-purchase declarations.
20. As the person running FLO, I want one switch that lifts the Pro gates and hides purchases, so that the billing fix build later turns them back on without hunting through screens.
21. As the person running FLO, I want my personal account's data untouched by this build, so that switching package ids loses nothing (all data is server-side).

## Implementation Decisions

**Build-time feature flags (new module).**
- A single flags module in `lib/` exposes static, build-time booleans. This is the "flagged off" mechanism decided in the gamification ticket: UI hidden, nothing new written, data kept, and no remote flags.
- This spec introduces it with one flag, **`billing`**, set to **off**. Later specs add their flags to the same module.

**Purchase surfaces and gates** (driven by `billing`). While billing is off:
- **Pro gates:** every create-time Pro gate (accounts, budgets, plans, splits; the entitlement and limit checks behind the upsell sheet) **passes**. No upsell sheet opens.
- **Pro screen:** the Pro screen route and every entry point to it (Menu banner, upsell triggers, report/period pickers) are hidden.
- **Shop:** the coin-pack Buy UI (the Shop's General tab packs) is hidden. Coins stay earn-only. Card themes bought with coins are allowed, since no real money is involved.
- **The entitlement read path is unchanged**, so turning the flag on later restores the gates as they are.

**Dead ends and placeholders:**
- The **"Forgot password?"** link on sign-in is removed until the forgot-password spec ships.
- **The onboarding tour is skipped.** The onboarding router sends the last setup step straight to the done screen, so the tour cards and the welcome-bundle reveal are bypassed. The tour code stays; the onboarding spec deletes it later.
- **Developer-only Settings rows** (the push "Send test" row with its dev-build note, and the detection debug log rows) render only in development builds.

**Error boundary:**
- An in-house root error boundary wraps the app below the providers it needs for theming.
- On a render error it shows a calm, branded recovery screen with "Try again", which remounts the tree, and "Go to Home".
- In development it shows the error message.
- No third-party SDK. Native crashes and ANRs are covered by Play Console's Android vitals.

**Package identity:**
- Store (lite) package: **`app.floexpense.tracker`**.
- The app config derives the package from the variant: **`app.floexpense.tracker.personal` whenever auto-detect is built in**, otherwise the store id.
- `google-services.json` is replaced with one file covering both Firebase Android apps. The console steps are a task on the map.
- The FCM V1 key is uploaded to EAS for both package ids.
- The native auto-detect module's Kotlin namespace is not renamed. It only exists in the personal build.

**Build config:**
- `CAMERA` is added to the blocked permissions.
- The `androidNavigationBar` config is changed to the form expo-doctor accepts.
- `expo-share-intent` is upgraded to 5.1.1.
- `eas.json` switches to **`appVersionSource: remote`**, with the version code above the current 2.
- The **Supabase URL and anon key are EAS environment variables** for the preview and production environments.
- The lite profile is the store profile. The default flip itself, and removing `submit.full`, belong to the P0 safety track; this spec assumes they've landed.

**Release check before every upload:** inspect the built AAB's merged manifest and confirm there's no `NotificationListenerService` and no CAMERA permission.

## Testing Decisions

- **What makes a good test here:** observable behaviour in the built app and the built artifact, never implementation details. "No price appears anywhere a tester can reach" is the test, not "the flag is read in component X".
- **Seam 1, the emulator** (Pixel_API_36, test account), on a **lite release build** (`lite-preview` or a local release APK) installed fresh, since the package id changed:
  - walk sign-up, onboarding through to Home, Menu, Settings, the Shop and every former Pro trigger;
  - confirm no price or Buy button, no upsell, no tour, no "Forgot password?" link, and no dev rows;
  - create 2+ accounts, 3+ budgets and 2+ splits with no wall;
  - force a render error in a dev build to see the error screen and recover;
  - a manually invoked push arrives under the new package id.
- **Seam 2, the artifact:** inspect the AAB's merged manifest (`aapt dump` or bundletool) for the absence of the notification listener and of CAMERA, and confirm the package id and version code.
- **Prior art:** feature 17's on-device push checklist (manual invoke of `send-push`), and the release-APK build notes in `00-index.md`.

## Out of Scope

- **The P0 safety fixes** (split RLS holes, flipping the store build's default to lite, removing `submit.full`, deleting the AI Edge Functions). They're a separate track and must land before the first upload.
- **The Firebase and EAS console steps,** the **Play Console account** and **App content forms**, and the **privacy and deletion pages**. These are map tasks, not code.
- **Everything in the v1 reset:** new onboarding, the streak-only economy, the design system, the new Home, the Add sheet, notifications and the recap, analytics, share-import improvements, billing.
- **Forgot password** itself (its own spec).
- **Analytics:** none in this build.

## Further Notes

- **The package id is permanent** after the first upload, and after billing exists. Don't upload any build before the package-id change lands.
- **Installed apps won't upgrade** across the package change: reinstall on the emulator and phones. The main personal account's data is server-side and unaffected.
- **Personal builds** need "Allow restricted settings" per install (standing rule). The new `.personal` id doesn't change that.
- **The billing fix build** turns `billing` on as part of the Pro-with-Play-Billing spec.
