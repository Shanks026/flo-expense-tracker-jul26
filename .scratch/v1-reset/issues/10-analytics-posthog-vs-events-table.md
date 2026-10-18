# Analytics: PostHog vs a Supabase events table under DPDP

Map: [../map.md](../map.md)
Type: research
Labels: wayfinder:research
Status: resolved
Blocked by: 

## Question

Which analytics approach should v1 use?
- PostHog: cloud or EU/self-host, React Native SDK on Expo SDK 54.
- A first-party Supabase `events` table.

Compare them on:
- DPDP Act (India) obligations and consent;
- impact on the Play Data safety declaration;
- funnel and retention querying out of the box;
- cost at early scale;
- SDK size and New Architecture compatibility;
- offline batching;
- effort.

Recommend one.

Refs: audit §1 P0 instrument, §5 P0 analytics.

## Answer

**PostHog Cloud EU via `posthog-react-native`, kept minimal and opt-in.**
- **Same compliance either way.** DPDP notice and consent apply equally to a first-party `events` table. That option saves no compliance work, but it means hand-building funnels, retention, the offline queue and dashboards: about 3–5 days vs 0.5–1 day.
- **Fits SDK 54.** The SDK is pure JS, works with SDK 54's `expo-file-system`, and keeps a file-backed offline queue.
- **Cost:** free up to 1M events a month, which covers fewer than 10k MAU with autocapture trimmed.
- **DPA:** a self-serve data processing agreement is available on the free plan.

**Setup rules:**
- Off until the user opts in, with an opt-out in Settings.
- No autocapture of screens or touches, no session replay.
- The Supabase user id is the distinct id.
- Never send amounts, notes, merchant names or category names.
- Account deletion calls PostHog's delete API.
- Reminder events are sent from `send-push`.
- All tracking goes through a `lib/analytics.js` wrapper, so the vendor can be swapped later.

**Play Data safety:** declare "App interactions" as collected (optional if consent-gated). Sending to a service provider isn't "sharing".

**DPDP Rules timing:** notified 2025-11-14. Most obligations take effect around May 2027, and Rule 8(3) requires keeping logs at least a year. PostHog's free plan keeps data for exactly one year.

**Open risks:**
- Opt-in hides the early funnel unless consent is asked on the first screen.
- Whether an anonymous install id counts as personal data needs counsel.
- No India-hosted region; a future transfer restriction could block the EU.
- Events could go past 1M a month near 10k MAU.
- The optional Expo modules (`expo-application`, `expo-device`, `expo-localization`) need a rebuild.

Findings: branch `research/analytics-posthog-vs-events-table`, `research/analytics-posthog-vs-events-table.md` (commit aa48906).

## Answer (revised 2026-10-18, user direction)

**Superseded. v1 uses a first-party Supabase `events` table, not PostHog.** The user ruled out external SDKs: "no PostHog either."

What carries over from the research:
- **Compliance:** the DPDP notice and consent burden is the same either way.
- **Data safety:** the declaration is the same ("App interactions" collected).
- **Privacy rules still apply:**
  - opt-in, with an opt-out in Settings;
  - no amounts, notes, merchant names or category names;
  - rows deleted with the account (cascade FK);
  - at least a year's retention.
- **Wrapper:** all tracking goes through a `lib/analytics.js` wrapper.

**What it costs:** the research estimate is about 3–5 days. We have to build it ourselves:
- an offline queue that batches inserts;
- `user_id DEFAULT auth.uid()` with insert-only RLS;
- funnel and retention SQL views (`security_invoker`);
- a way to read the numbers (SQL in the Supabase dashboard is enough for v1).
