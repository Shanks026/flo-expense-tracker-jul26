# Permanent package id and Firebase re-registration

Map: [../map.md](../map.md)
Type: task
Labels: wayfinder:task
Status: open
Blocked by: 

## Question

Choose and register FLO's permanent Android package id, replacing `com.anonymous.flo`:
1. Add a Firebase Android app for the new id.
2. Replace `google-services.json`.
3. Upload the FCM V1 key to EAS.
4. Set `android.package`.
5. Record the Google OAuth client changes this needs.

HITL: the human does the console steps from a `wizard` checklist.

Resolved when the id is chosen and registered. The answer records the id and where each credential lives.

Refs: audit §6 P0 package name, Launch sequence step 1.

## Comments

**2026-10-18: package id decided, console steps not done yet** (parked while the remaining grilling tickets are worked).
- **Store (lite) build:** `app.floexpense.tracker`. **Personal (auto-detect) build:** `app.floexpense.tracker.personal`. Neutral and brand-only; the user did not want their name in it. `com.anonymous.flo` was rejected: it's Expo's default and could collide with another app, and it reads as a template.
- **No domain yet.** The package id doesn't need one. A domain is still needed later for Resend email and the policy pages.
- **Display name:** "FLO" on the launcher, "FLO: Expense Tracker" as the Play title.
- **Agreed steps:**
  1. Firebase project `flo26-7de68`: add both Android apps.
  2. Download one `google-services.json` (it covers both apps) into the repo root.
  3. Generate an FCM V1 service-account key, kept outside the repo.
  4. `eas credentials`: upload the FCM V1 key for both package ids.
  5. Repo: set `app.json` `android.package` to `app.floexpense.tracker`; `app.config.js` appends `.personal` when auto-detect is built in.
  6. Reinstall on the emulator and phone, because the package change breaks upgrades.
- **To verify:** whether Play shows a monetising developer's address publicly. The user wants to stay anonymous.
