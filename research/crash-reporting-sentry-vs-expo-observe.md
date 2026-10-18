# Crash reporting for v1: Sentry vs EAS `expo-observe`

Ticket: `.scratch/v1-reset/issues/13-crash-reporting-sentry-vs-expo-observe.md`
Audit context: `docs/flo-pre-launch-audit-2026-10.md`, §6 "[P1] Crash and ANR reporting: none installed".
Researched 2026-10-18.

## Question

Which crash/ANR and error reporting should FLO v1 ship: Sentry (`@sentry/react-native` + its Expo config plugin) or EAS `expo-observe`? Does Play Console's Android vitals already cover native crashes and ANRs, so the added tool only needs to handle JS errors?

## What FLO has today

- `package.json`: `expo ~54.0.37`, `react-native 0.81.5`, `react 19.1.0`, `expo-router ~6.0.24`. There is no Sentry, Crashlytics, `expo-observe`, or error-boundary package.
- `app.config.js`: only sets `extra.autoDetectEnabled` and the autolinking exclude for the `lite` variant. It has no Sentry/Observe plugin.
- `app/_layout.js`: there is no `ErrorBoundary` of any kind.
- `eas.json`: it has `production` / `lite` / `full` profiles, with no `environment` key and no `uploadSourceMaps`. Only `FLO_VARIANT` is set in `env`.

## Recommendation

Ship **Sentry (`@sentry/react-native`, installed with `npx expo install` so SDK 54 resolves `~7.2.0`)** for v1. Rely on **Play Console Android vitals** as the second, independent signal for native crashes and ANRs. `expo-observe` is not an option for FLO today, for three reasons:

- It requires Expo **SDK 55 or later**, and FLO is on SDK 54. There is no `sdk-54` dist-tag on npm.
- Its error reporting is undocumented on SDK 55/56 and labelled "preview" in the SDK 57+ docs.
- Expo itself says it has **no crash reporting** ("use Sentry or BugSnag for that"), and its Free plan excludes the error dashboard.

Sentry covers all three layers in one SDK:

- JS errors, with Hermes source maps uploaded automatically during EAS Build.
- Native Java/NDK crashes.
- JVM ANR detection, on by default.

It also provides `Sentry.ErrorBoundary` for the root "Something went wrong, Reload" screen, plus app-start and slow/frozen-frame metrics. The free Developer plan (1 user, 5k errors, 30-day lookback) is enough for a closed test and a small v1. Setup is one wizard run, a Metro config swap and one EAS secret (`SENTRY_AUTH_TOKEN`). Configure it to keep the Data-safety footprint small: `sendDefaultPii: false`, no Session Replay, and no user e-mail in `setUser`. Revisit `expo-observe` for **performance** metrics (TTI/TTR) after an SDK 55+ upgrade, not as the crash reporter.

## Comparison

| Criterion | Sentry `@sentry/react-native` | EAS `expo-observe` | Play Console Android vitals (already free) |
|---|---|---|---|
| Works on FLO's SDK 54 | Yes. Expo SDK 54 pins `~7.2.0`; the Sentry SDK supports Expo SDK 50+ | **No.** Requires SDK 55+; no `sdk-54` npm tag | Yes (no SDK) |
| JS errors (Hermes) | Yes, automatic global handler, symbolicated via source maps | Unhandled JS errors recorded as non-fatal `exception` events (undocumented on 55/56, "preview" on 57+) | No JS stack; a fatal JS error shows up as a native crash from the RN runtime |
| Native crashes (Java/NDK) | Yes (native Android SDK bundled; `Sentry.nativeCrash()` test hook) | **No.** "Observe still has no crash reporting" | Yes, with stack traces; NDK needs native debug symbols uploaded |
| ANRs | Yes. JVM-based ANR detection "always on by default"; NDK hang tracking opt-in | No | Yes (user-perceived ANR rate, bad-behaviour threshold 0.47%) |
| Crashes before SDK init / ANRs before Android 12 | No (SDK-side) | No | **Yes.** Vitals sees events SDKs cannot |
| Source maps / symbolication on EAS | Auto-upload during EAS Build release builds (needs `SENTRY_AUTH_TOKEN`); EAS Update needs `npx sentry-expo-upload-sourcemaps dist` | `uploadSourceMaps: true` on the eas.json profile, EAS CLI >= 22.0.0 (agent prompt in docs only) | Upload R8 `mapping.txt` + native debug symbols to Play |
| New Architecture | Supported; Expo includes it in SDK 54's tested module list. 8.x changelog has New-Arch fixes (8.12, 8.17.x, 8.25) | N/A on SDK 54 | N/A |
| Root error boundary | `Sentry.ErrorBoundary` / `withErrorBoundary`, `fallback` with `resetError()`; `Sentry.GlobalErrorBoundary` for fatal non-render errors | `ObserveErrorBoundary` with `fallback({error, resetError})` (exported, undocumented) | None |
| Performance / app start | Cold/warm app start, slow and frozen frames, Expo Router route instrumentation (tracing) | Its core strength: cold/warm launch, TTR, TTI, per-route metrics (SDK 56+) | Startup time, slow rendering, frozen frames (aggregate) |
| Free tier | Developer: 1 user, 5k errors, 5M spans, 50 replays, 30-day lookback | Free: 100K events/month, 90-day retention, launch metrics only; **error dashboard not on Free** | Free |
| Data safety impact | Crash logs + Diagnostics (collected, not shared; Sentry is a service provider). IP inferred server-side by default. Replay/PII would add more | Diagnostics (+ Crash logs if error events are used) | None extra (Google-collected) |
| Setup effort | `npx @sentry/wizard -i reactNative` (or manual: config plugin + `getSentryExpoConfig` Metro + `Sentry.init` + `Sentry.wrap`); 1 EAS secret; new dev-client build | Would first need the SDK 54 → 55+ upgrade, then install + `AppMetricsRoot.wrap` + `markInteractive()` | Already on once the app is on Play |

## Key facts with sources

**expo-observe**
- "EAS Observe requires SDK 55 or later"; it is not available in Expo Go and needs a dev or production build. Source: https://docs.expo.dev/eas/observe/get-started/
- npm dist-tags for `expo-observe` are `sdk-55` (0.2.6), `sdk-56`, `sdk-57` and `latest` 58.x. There is no SDK 54 line. Source: https://registry.npmjs.org/expo-observe
- Error reporting appears in the get-started page only as an agent-prompt step: "SDK 57 and later: set up error reporting, which is in preview". The same prompt sets `"uploadSourceMaps": true` in eas.json (EAS CLI >= 22.0.0). Source: https://docs.expo.dev/eas/observe/get-started/
- Expo's own `eas-observe` agent skill (expo plugin 1.13.9, verified against `expo-observe` 57.0.9) says `ObserveErrorBoundary`, `Observe.reportError` and `errorHandlingEnabled` "are exported but undocumented. Observe still has no crash reporting; use Sentry or BugSnag for that." It also says error events "are **not** a replacement for a crash reporter such as Sentry". Canonical docs root: https://docs.expo.dev/eas/observe/
- Free plan: 100K included events/month and 90-day retention. It includes launch timing metrics. Navigation, update, **error** and custom-event dashboards are not included. Source: https://expo.dev/pricing. (The Expo skill text says "up to 10,000 MAU"; the pricing page is the primary source and takes precedence.)

**Sentry**
- "The `@sentry/react-native` SDK requires Expo SDK 50+". Setup uses the config plugin (`url`, `project`, `organization`), `getSentryExpoConfig` from `@sentry/react-native/metro` (adds Debug IDs to bundles/source maps), and `SENTRY_AUTH_TOKEN` stored as an EAS secret. "Source maps for the Release version of your application are uploaded automatically during the native application build." Source: https://docs.sentry.io/platforms/react-native/manual-setup/expo/
- Expo's guide: run `npx @sentry/wizard@latest -i reactNative`; "Ensure that `SENTRY_AUTH_TOKEN` is set in your build environment with sensitive visibility"; for EAS Update, run `eas update --branch <b> && npx sentry-expo-upload-sourcemaps dist`. An optional EAS dashboard ↔ Sentry project link is also available. Source: https://docs.expo.dev/guides/using-sentry/
- Expo SDK 54's compatibility list pins `"@sentry/react-native": "~7.2.0"`. Source: https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo/bundledNativeModules.json
- ANR: JVM-based ANR detection "is always on by default"; `enableNdkAppHangTracking` is opt-in. Source: https://docs.sentry.io/platforms/react-native/configuration/app-hangs/
- `Sentry.ErrorBoundary`: `fallback` can be an element or a function receiving `resetError()`, which "clears the fallback and remounts the children". It catches only render/lifecycle/constructor errors. `Sentry.GlobalErrorBoundary` also handles fatal non-render errors via `ErrorUtils`. In dev mode React rethrows, so test on a release build. Source: https://docs.sentry.io/platforms/react-native/integrations/error-boundary/
- Tracing: App Start instrumentation distinguishes cold and warm starts (`measurements.app_start_cold/warm`), records slow and frozen frames, and has an Expo Router routing instrumentation. Source: https://docs.sentry.io/platforms/react-native/tracing/instrumentation/automatic-instrumentation/
- Default data: user IP "is inferred by the Sentry backend"; logged-in user info is not sent by default; Android device name is not sent by default; `sendDefaultPii: true` enables these. "The full request URL and Referer of outgoing HTTP requests is always sent." Source: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
- Developer (free) plan: one user, 5k errors, 5M spans, 50 replays, 30-day lookback. Source: https://sentry.io/pricing/
- New Architecture fixes appear in the 8.x changelog (8.12.0, 8.17.0–8.17.2, 8.25.0, 8.27.0). Latest at time of research: 8.31.0. Source: https://raw.githubusercontent.com/getsentry/sentry-react-native/main/CHANGELOG.md

**Google Play**
- Android vitals tracks user-perceived crash rate (bad-behaviour threshold 1.09% overall, 8% per phone model) and ANR rate (0.47% overall, 8% per phone model). Its data "includes events not seen by SDKs, such as: Crashes before SDK initialization; ANRs before Android 12". It only counts certified devices and Play installs. Source: https://developer.android.com/topic/performance/vitals
- Play Console shows crash stack traces. For NDK frames you must upload a native debug symbols file. Source: https://developer.android.com/topic/performance/vitals/crash
- Data safety: **Crash logs** ("number of times your app has crashed, stack traces…") and **Diagnostics** ("battery life, loading time, latency, framerate…") sit under "App info and performance". Transfers to a service provider processing data on your behalf are not "sharing". Source: https://support.google.com/googleplay/android-developer/answer/10787469

**Does vitals make a separate native crash tool unnecessary?** Partly. Vitals already gives native crash and ANR counts and stack traces, and it is the only source for pre-init crashes and pre-Android-12 ANRs. It cannot show Hermes JS stacks: a fatal JS error surfaces as a crash in the RN runtime, with no JS source location. FLO's bugs will mostly be JS (Supabase calls, screens), so the added tool must at least cover JS errors. Sentry's native coverage is a convenience, not the reason to choose it. `expo-observe` cannot fill the JS-error role on SDK 54 at all.

## Open risks

- **Native coverage duplication is not a cost but adds noise.** Sentry and vitals will both report native crashes. Treat vitals as the Play-threshold truth and Sentry as the debugging tool.
- **Sentry 7.2.0 vs 8.x.** `npx expo install` will pick 7.2.0 for SDK 54. The 8.x line has New-Arch build fixes, but going past Expo's pinned version is untested by Expo. Stay on the pinned version unless a build breaks, and verify with a `lite-preview` EAS build plus a forced JS error and `Sentry.nativeCrash()` on the Medium Phone API 29 emulator.
- **R8 interaction.** If the audit's P1 size item enables `enableMinifyInReleaseBuilds`, Java frames in both Sentry and vitals need the mapping file. Confirm that the Sentry config plugin uploads the mapping (unverified). Play needs `mapping.txt` uploaded separately.
- **EAS env not yet set up.** The audit's P0 notes `eas.json` has no `environment`, and Supabase env vars may be missing on EAS. `SENTRY_AUTH_TOKEN` must be added as a *sensitive/secret* EAS env var for the `production`/`preview` environments. Without it the build still succeeds but uploads no source maps (unreadable stacks).
- **EAS Update.** FLO does not use `expo-updates` today. If OTA is adopted, every `eas update` must be followed by `npx sentry-expo-upload-sourcemaps dist`, or OTA errors will be unsymbolicated.
- **Data safety and privacy policy.** Declare Crash logs + Diagnostics (collected, not shared, App functionality/Analytics) and name Sentry as a processor in the privacy policy (audit P0). Keep `sendDefaultPii` off, skip Session Replay (it would screen-capture financial data), and use `beforeSend` to strip transaction amounts/notes from breadcrumbs. Note that outgoing request URLs (Supabase REST paths with query filters) are always sent.
- **Sentry free plan has one seat and 5k errors/month.** A crash loop in a closed test can exhaust it quickly. Set `sampleRate`/rate limits or spike protection in Sentry project settings.
- **Data residency (not verified here).** Neither tool's India data-residency options were checked. If DPDP guidance later requires India-resident data, research this before launch.
- **`expo-observe` is moving fast** (SDK 55 → 58 in about a year). Its error reporting and pricing may change. Re-evaluate after FLO's SDK upgrade, for performance metrics only.
