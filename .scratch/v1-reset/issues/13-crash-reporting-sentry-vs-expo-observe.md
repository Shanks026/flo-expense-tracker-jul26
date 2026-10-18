# Crash reporting: Sentry vs expo-observe

Map: [../map.md](../map.md)
Type: research
Labels: wayfinder:research
Status: resolved
Blocked by: 

## Question

Which crash, ANR and error reporting should v1 ship?
- Sentry: `@sentry/react-native` with the Expo plugin.
- EAS `expo-observe`.

Compare them on:
- coverage of crashes, ANRs and JS errors;
- source maps for EAS builds;
- Expo SDK 54 and New Architecture support;
- free tier;
- impact on Play Data safety;
- root error boundary support;
- setup effort.

Recommend one.

Refs: audit §6 P1 crash and ANR reporting.

## Answer

**Sentry.** Install `@sentry/react-native` with `npx expo install`; it resolves to `~7.2.0` for SDK 54. Wrap the root of `app/_layout.js` in `Sentry.ErrorBoundary`, and add `SENTRY_AUTH_TOKEN` as a sensitive EAS env var.
- **Coverage:** JS errors with source maps uploaded during EAS Build, native and NDK crashes, ANRs, and app-start and frozen-frame metrics.
- **Free plan:** 5k errors a month.
- **Play Android vitals stays the second signal** for pre-init crashes and for ANRs on older Android versions.

**expo-observe is ruled out.** It needs SDK 55+, and Expo itself says it has no crash reporting.

**Data safety:** declare Crash logs and Diagnostics as collected, not shared. Keep `sendDefaultPii` off and Session Replay off.

**Open risks:**
- India data residency is unverified;
- the R8 mapping upload once minify is on is unverified;
- each `eas update` would need its source maps uploaded.

Findings: branch `research/crash-reporting-sentry-vs-expo-observe`, `research/crash-reporting-sentry-vs-expo-observe.md` (commit 8bddf45).

## Answer (revised 2026-10-18, user direction)

**Superseded: "no need for external applications like Sentry."** v1 ships with no third-party crash SDK. From the research above:
- **Native crashes and ANRs:** Play Console Android vitals.
- **JS render crashes:** an in-house root error boundary in `app/_layout.js`. It shows a recoverable error screen. Whether it also writes the error to a Supabase table is left to the spec.

The Sentry findings stay on the research branch for reference only.
