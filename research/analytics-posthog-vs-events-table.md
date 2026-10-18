# Analytics for v1: PostHog vs a first-party Supabase `events` table

Research for wayfinder ticket `.scratch/v1-reset/issues/10-analytics-posthog-vs-events-table.md`.
Context: `docs/flo-pre-launch-audit-2026-10.md` §1 "Instrument the funnel before (and while) cutting anything" and §5 "Add product analytics before changing anything else".
Researched 2026-10-18. Sources were read directly: the DPDP Act and Rules gazette PDFs, the PostHog docs, the npm tarball of `posthog-react-native@4.81.2`, and the Play Console Help pages.

## Question

Which analytics approach should FLO v1 use: PostHog (Cloud US, Cloud EU or self-hosted, through `posthog-react-native` on Expo SDK 54), or a first-party Supabase `events` table written by a `track()` helper in `lib/`? The options are compared on:

- DPDP Act 2023 and DPDP Rules 2025 obligations and consent
- the Google Play Data safety declaration
- funnel and retention querying out of the box
- cost at under 10k MAU
- SDK size and New Architecture / Expo compatibility
- offline batching
- implementation effort

## Recommendation

**Use PostHog Cloud EU through `posthog-react-native`, configured minimally, behind an explicit analytics opt-in.**

Under the DPDP Act, both options are personal-data processing that needs the same notice and consent. The Act does not care whose server holds the rows. A Supabase table therefore saves no compliance work. It only moves the funnel, retention, offline-queue and dashboard work onto us, and those are exactly the things the audit needs on day one: activation within 10 minutes, D1/D7/D30 retention on "logged ≥1", and median seconds-to-save.

The PostHog setup should be:

- **SDK.** The SDK is pure JS. It has no native code of its own, already supports SDK 54's new `expo-file-system` `File`/`Paths` API, and keeps a persistent offline queue.
- **Cost.** PostHog's free tier is 1M events a month. That covers FLO's event budget at under 10k MAU if autocapture is trimmed. A self-serve DPA is available on the free plan, which satisfies Act s.8(2) ("only under a valid contract").
- **Region.** Pick EU (Frankfurt) over US because new EU projects have IP capture off by default. Self-hosting is out: PostHog calls it "officially unsupported" and it needs a 4 vCPU / 16 GB VM.
- **Configuration.**
  - `defaultOptIn: false`, then call `optIn()` after an affirmative onboarding toggle. `optOut()` goes in Settings.
  - `captureScreens: false`, no `captureTouches`, no session replay.
  - Turn IP capture off.
  - Use the Supabase user UUID as the `distinct_id`.
  - Never put amounts, notes, merchant names or category names in event properties.
  - Wire account deletion to PostHog's person-delete API with `delete_events=true`.
- **Server-side events.** Emit `reminder_sent` / `reminder_opened` from `send-push` to the PostHog capture endpoint. This is not an AI function, so it does not conflict with the standing rule.
- **Fallback.** Keep the `events` table as the fallback if the cross-border transfer or the consent-gated data gap ever becomes unacceptable (see Open risks). Put a `lib/analytics.js` `track()` wrapper in front of PostHog so the backend can be swapped without touching call sites.

## Comparison table

| Criterion | PostHog (Cloud EU, `posthog-react-native`) | Supabase `events` table + `track()` |
|---|---|---|
| **DPDP: is it personal data?** | Yes. It is keyed to a user / device ID (Act s.2(t)). | Yes, for the same reason. |
| **DPDP: consent and notice** | Needs the same itemised notice (Rule 3) and affirmative consent (s.6(1)). Withdrawal must be as easy as giving consent (Rule 3(c)(i)) → `optIn()` / `optOut()`. | Identical obligations. You must build the opt-in flag and gate yourself. |
| **DPDP: processor and contract** | PostHog is a Data Processor. A contract is required (s.8(2)), and the self-serve DPA is on all plans including free. FLO stays liable for PostHog's processing (s.8(1)). | Supabase is already FLO's processor, so this adds no new processor. |
| **DPDP: security, logs, retention** | PostHog holds the data. FLO must contract for safeguards (Rule 6(1)(f)). Free-plan retention is 1 year, which meets Rule 6(1)(e) / 8(3) logs ≥ 1 year. Erasure on withdrawal uses the person-delete API with `delete_events=true` (s.8(7)(b)). | All of it is under FLO's control, using existing RLS and backups. Erasure is `ON DELETE CASCADE` from `auth.users`. Retention is yours to set. |
| **DPDP: cross-border** | Data goes to Frankfurt (EU) or the US. Allowed unless the government restricts that country (Act s.16(1), Rule 15). No restriction is notified today. | Data stays in the existing Supabase project region, so no new transfer. |
| **Play Data safety** | Declare "App activity → App interactions" (plus "Device or other IDs" if the anonymous ID is kept) as **collected**. Disclose it even if processed ephemerally. A transfer to a service provider is **not "sharing"**. Mark it **optional** if it is consent-gated. | The same declaration. Play counts any data sent off the device as collected, whoever receives it. |
| **Funnels / retention out of the box** | Yes. Funnels (time-to-convert, breakdowns) and retention (start/return event, day/week cohorts, "on" vs "on or after"), plus paths and lifecycle. Funnel *correlation analysis* is paid-only. | No. Hand-written SQL views for each metric, no UI. You would need Metabase or Supabase SQL editor saved queries to see charts. |
| **Cost at < 10k MAU** | $0 up to 1M events/month. Above that, $0.00005/event from 1–2M. Estimate: about 3k DAU × 30 × 8 events ≈ 0.7M/month, so free. At 15 events it is about 1.35M ≈ $18/month. | $0 extra on the Free plan (500 MB DB). But Free projects **pause after 1 week of inactivity** and have no automatic backups. A launched app needs Pro ($25/mo, 8 GB) anyway. About 1M rows/month at ~200 B ≈ 0.2 GB/month. |
| **SDK size** | `posthog-react-native` is 1.36 MB unpacked, plus `@posthog/core` at 2.34 MB unpacked (sources, maps and types; the Metro bundle delta is much smaller). No native code of its own. | 0 new dependencies. It reuses `@supabase/supabase-js` and the `@react-native-async-storage/async-storage` 2.2.0 already in `package.json`. |
| **Expo SDK 54 / New Architecture** | Compatible. It is pure JS, and `native-deps.js` uses the new `expo-file-system` `File`/`Paths` API, falling back to `expo-file-system/legacy` and then AsyncStorage. The optional peers `expo-application`, `expo-device` and `expo-localization` (not currently installed) are Expo modules, which need a dev-client rebuild. Session replay needs the separate native plugin, so skip it. | Nothing native to check. |
| **Offline batching** | Built in. Events are queued to file storage (`persistence: 'file'`) and survive app restarts. `flushAt` is 20 and `flushInterval` is 10 s. The queue only flushes online, and `maxQueueSize` is 1000 (oldest dropped). | You must build it: an AsyncStorage queue, batch insert, a retry on reconnect, and dedupe (client UUID primary key). Otherwise events logged offline are lost, and offline use is common for an expense logger in India. |
| **Implementation effort** | About 0.5–1 day: provider, `lib/analytics.js` wrapper, consent toggle, ~10 `track()` calls, `send-push` server capture, deletion hook, dashboards built in the UI. | About 3–5 days: migration + RLS (insert-own only), `track()` + offline queue, server events in `send-push`, SQL for activation, D1/D7/D30, logs per active day, seconds-to-save and push→log, and some way to view them. |

## Key facts with source links

### DPDP Act 2023

Source: [MeitY gazette PDF](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf).

- **s.2(t), definition of personal data.** "Personal data" is any data about an individual "who is identifiable by or in relation to such data". Events keyed to a user or device ID qualify, wherever they are stored.
- **s.6(1), consent.** Consent must be "free, specific, informed, unconditional and unambiguous with a clear affirmative action". It is limited to data necessary for the specified purpose. The s.6(1) illustration (a contact list not being necessary for a telemedicine app) shows that bundling analytics into core-service consent is risky.
- **s.6(4), withdrawal.** The right to withdraw consent at any time.
- **s.7(a), legitimate use.** Covers only data the user "voluntarily provided" for a specified purpose. Product analytics does not cleanly fit, so plan for consent.
- **s.8, Data Processors.**
  - s.8(1): the Data Fiduciary is responsible for processing done "on its behalf by a Data Processor".
  - s.8(2): a processor may be used "only under a valid contract".
  - s.8(5): reasonable security safeguards.
  - s.8(6): breach intimation.
  - s.8(7)(b): the fiduciary must "cause its Data Processor to erase" data.
- **s.16(1), cross-border transfer.** Transfer abroad is restricted only to countries the government notifies (a negative list).
- **Schedule, penalties.** Up to ₹250 crore for failing security safeguards (s.8(5)). Up to ₹200 crore for breach-notice failures. Up to ₹50 crore for any other breach.

### DPDP Rules 2025

Source: [MeitY PDF, G.S.R. 846(E)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf). Notified 14 Nov 2025 per the [PIB backgrounder](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf).

- **Rule 1, commencement.**
  - Rules 1, 2 and 17–21 take effect on publication.
  - Rule 4 (Consent Managers) takes effect after 1 year.
  - Rules 3 and 5–16, which are the substantive notice, security, breach, retention, children and transfer rules, take effect **18 months after publication, about mid-May 2027**.
- **Rule 3, notice.** The notice must be understandable independently of anything else. It must give "an itemised description of such personal data" and the specified purpose. It must let users withdraw consent "with the ease of doing so being comparable to that with which such consent was given".
- **Rule 6, minimum safeguards.**
  - Encryption, obfuscation or masking.
  - Access control.
  - Access logs.
  - Backups.
  - Logs retained for one year.
  - Rule 6(1)(f): "appropriate provision in the contract" with the Data Processor.
- **Rule 7, breach.** Affected users must be told without delay. The Board gets a detailed report "within seventy-two hours".
- **Rule 8(3), retention minimum.** Personal data, traffic data and processing logs must be kept for at least one year, including by the processor.
- **Rule 10, children.** Verifiable parental consent is needed before processing a child's data. FLO's age picker starts at "18 – 24" (`app/onboarding/intro/age.js`), so FLO does not knowingly onboard minors.
- **Rule 15, transfer abroad.** Allowed, subject to requirements the government may set about making data available to foreign states.
- **Rights requests.** Access, correction and erasure requests must be answered within 90 days ([PIB backgrounder](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf)).

### Google Play Data safety

Source: [Play Console Help 10787469](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

- **Collection.** "Collect" means transmitting data off the device, and this includes data sent by SDKs. Developers "must reflect data collection or sharing carried out by such third-party code".
- **Sharing.** A transfer to a service provider that "processes user data on behalf of the developer" is not "sharing".
- **Ephemeral processing.** Data processed ephemerally must still be declared as collected. It is just not shown publicly.
- **Optional collection.** Collection counts as "optional" when users can opt in or out. A consent-gated analytics flag qualifies.
- **Data types.** The relevant types are "App interactions" ("how a user interacts with the app") and "Device or other IDs".

### PostHog

**React Native SDK** ([docs](https://posthog.com/docs/libraries/react-native)):

- Expo install: `npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization`.
- Defaults: `flushAt` 20, `flushInterval` 10000 ms, `maxQueueSize` 1000, `persistence: 'file'` (survives restarts).
- `defaultOptIn` (default `true`), plus `optIn()` / `optOut()`.
- `host` defaults to `https://us.i.posthog.com`. EU is `https://eu.i.posthog.com`.
- `captureAppLifecycleEvents` defaults to `true`.
- Screen capture is on by default (`captureScreens: false` to disable). The docs say React Navigation v7 users should disable it and call `posthog.screen()` manually.
- `enableSessionReplay` defaults to `false`.

**Package inspection** (`npm pack posthog-react-native@4.81.2`, published 2026-10-14):

- Unpacked size is 1,355,493 B. Its dependency `@posthog/core` is 2,341,096 B unpacked.
- The tarball has no `android/` or `ios/` directories, so it is JS only.
- `dist/native-deps.js` prefers `expo-file-system`'s `File` / `Paths` (the SDK 54 API). It falls back to `expo-file-system/legacy`, then AsyncStorage.

**Pricing:**

- [Product analytics pricing](https://posthog.com/docs/product-analytics/pricing): 1,000,000 events a month free, then $0.00005/event for 1–2M.
- [Pricing](https://posthog.com/pricing.md): free plan retention is 1 year (7 years on paid), with 1 project. Identified-event person profiles are a separate add-on with its own 1M free.

**Features:**

- [Funnels](https://posthog.com/docs/product-analytics/funnels): time-to-convert and breakdowns. Correlation analysis is Paid/Enterprise only.
- [Retention](https://posthog.com/docs/product-analytics/retention): start/return events, hour/day/week/month cohorts, and "on" vs "on or after".

**Privacy and hosting:**

- [DPA](https://posthog.com/docs/privacy.md): "All PostHog Cloud customers can get a DPA, on any plan. This includes the free plan." It is self-serve and pre-countersigned.
- [Data storage](https://posthog.com/docs/privacy/data-storage) and the [GDPR guide](https://posthog.com/docs/privacy/gdpr-compliance): Cloud EU is hosted in Frankfurt. IP capture is off by default for new EU projects and configurable per organisation or project. No India region is offered.
- [Data deletion](https://posthog.com/docs/privacy/data-deletion): the persons DELETE API with `delete_events=true`. Event deletion runs asynchronously in off-peak hours (weekends on Cloud).
- [Self-host](https://posthog.com/docs/self-host): the hobby deploy is MIT licensed but "officially unsupported". It needs about 4 vCPU / 16 GB RAM / 30 GB+, and PostHog suggests Cloud above about 300k events.

### Supabase

Source: [pricing](https://supabase.com/pricing).

- Free plan: 500 MB DB, 5 GB egress, 50k MAU. "Free projects are paused after 1 week of inactivity". No automatic backups.
- Pro plan: from $25/month, with 8 GB disk per project.

## Open risks

1. **Consent-gated analytics undercounts the funnel.** With `defaultOptIn: false`, onboarding steps viewed *before* the consent toggle are not captured. If the toggle sits late in onboarding, `onboarding_step_viewed` drop-off data is lost exactly where the audit needs it. Mitigation: ask for consent on the first onboarding screen.
   - A legal call is still needed on whether aggregate, non-identifying step counts can be sent without consent. The Act only governs *personal* data (s.2(t)). Nothing above settles whether an anonymous random install ID is "personal data". This is not legal advice; confirm with counsel.
2. **The DPDP timing cliff.** The substantive Rules (3, 5–16) bite around May 2027, not today. Building the notice, consent, deletion and processor contract now avoids a retrofit. Rule 8(3) also forces a minimum one-year log retention, and PostHog's free 1-year retention only just meets it.
3. **Cross-border transfer.** EU and US hosting is lawful today because no country is restricted under s.16 or Rule 15. A future notification could change that. The `track()` wrapper keeps the Supabase-table fallback cheap. Check which region the existing Supabase project `uergtlcfpwajztqgncim` is in: if it is already outside India, PostHog adds no new category of risk.
4. **Event budget.** Lifecycle autocapture (`captureAppLifecycleEvents`, on by default) and screen events can push volume past 1M/month near 10k MAU. Decide which autocapture to keep, and watch usage in the first month.
5. **The `send-push` server events need the PostHog project API key in an Edge Function secret.** This is a second secret alongside the Vault cron secret. It is low risk, because the project key is write-only by design.
6. **The optional Expo peers mean a dev-client rebuild.** These are `expo-application`, `expo-device` and `expo-localization`, and they need `npx expo prebuild` + `expo run:android`. The SDK works without them but loses app version and device metadata. App version is needed to segment releases.
7. **Play declaration drift.** The Data safety form must be updated in the same release that adds analytics. Declare "App interactions" as collected, optional and encrypted in transit, plus "Device or other IDs" if the anonymous ID is kept.
8. **No India-hosted PostHog region exists.** If a future B2B or enterprise customer demands Indian residency, only self-hosting or the `events` table would satisfy it.
