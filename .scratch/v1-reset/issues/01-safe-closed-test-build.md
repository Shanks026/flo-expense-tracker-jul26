# Safe closed-test build: what goes in the first AAB

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 08, 14

## Question

What is the exact cut list for the **safe closed-test build** (see GLOSSARY)? This is the first lite AAB. It starts Play's 14-day closed test before the v1 reset ships.

- Which surfaces must be hidden or fixed in it? Candidates:
  - Pro prices and Buy buttons;
  - coin packs;
  - dev-only Settings UI;
  - the Forgot-password dead button;
  - the 10 placeholder tour images;
  - the CAMERA permission;
  - androidNavigationBar.
- Which can ride along unchanged until a later fix build?
- What is the minimum that won't embarrass us in front of testers or get rejected by Play?

Refs: audit §2 P0, §6 Launch sequence steps 1–5.

## Answer

Grilled with the user on 2026-10-18.

**1. What's in it:** **today's master plus a short safety list**, not a partial reset. Testers are told it's an early build and that changes arrive weekly.

**2. Blockers that must be in the build:**
- **Store safety:**
  1. Auto-detect excluded: the P0 track's lite default, and the built AAB's merged manifest checked for no `NotificationListenerService`.
  2. **Every price and Buy button hidden:** Pro Upgrade and ProUpsellSheet prices, coin packs, the Shop's General tab packs.
  3. **Pro gates lifted** for this build, so nothing blocks without a way forward.
- **Dead ends and placeholders:**
  4. **"Forgot password?" hidden** until the Resend email setup exists ([12](12-custom-smtp-forgot-password.md)). Testers use Google.
  5. **The tour skipped,** so the 10 placeholder images never show.
  6. Dev-only Settings rows behind `__DEV__`.
- **Build config:**
  7. `CAMERA` added to `blockedPermissions`, the `androidNavigationBar` config fixed, `expo-share-intent` upgraded to 5.1.1.
  8. A minimal in-house root error boundary ([13](13-crash-reporting-sentry-vs-expo-observe.md)).
  9. EAS env vars for Supabase, `appVersionSource: remote`, and the new package id `app.floexpense.tracker` ([14](14-package-id-firebase.md)).

**3. Ships unchanged, to be replaced by fix builds:**
- the 32-screen onboarding;
- the coin economy (earn-only, since buying is hidden);
- themes and card skins;
- the current Home and Add sheet.

**4. Needed before the first upload:**
- the [package-id task](14-package-id-firebase.md);
- the [privacy and deletion pages](15-privacy-and-deletion-pages.md) (Play needs the policy URL and App content declarations before any testing track);
- the P0 safety track (outside this map).

**5. No analytics in this build.** The event pipeline ([17](17-analytics-event-plan-and-consent.md)) arrives with the reset fix builds.

**Fix-build order during the test:** the reset, then billing ([08](08-monetisation-timing.md)) before production. The exact order belongs to the specs.
