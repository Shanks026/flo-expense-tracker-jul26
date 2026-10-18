# Post-launch backlog boundary (what is explicitly v1.1+)

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 

## Question

What is the ordered post-launch backlog, and what triggers each item? The items so far:
- **The seasonal card-skin Store and admin portal:** the first feature after launch ([05](05-home-ia-and-tabs.md)).
- **Going global:** multi-currency, GDPR, per-country prices ([08](08-monetisation-timing.md)).
- **Anonymous-first sign-up** ([03](03-onboarding-target-flow.md)).
- **Re-enabling Plans** as Goals, and **split invites** ([07](07-v1-scope-plans-splits-currency.md)).
- **Android home-screen widget**, **EAS Update**, **the SDK 57+ upgrade**, and **iOS** (audit §6 P2/P3).

For each item, settle:
- **the trigger:** a metric from [17](17-analytics-event-plan-and-consent.md), a date, or simply "next";
- **the order;**
- **what v1 must leave in place** so it isn't blocked (for example the hero's skin slot).

## Answer

Recorded with the user on 2026-10-18. **The list is recorded, but its order and its split into pre-launch and post-launch are not decided.** The user said "we might do some pre launch. i will choose what to act on after we finish the current observation changes". That means once the v1 reset from the audit is built. The proposed order below is the agent's suggestion only.

| Proposed # | Item | Candidate trigger | What v1 must leave in place |
|---|---|---|---|
| 1 | **EAS Update (OTA)** + `expo-dev-client` | With the first release after the v1 reset | — |
| 2 | **Seasonal card-skin Store + admin portal** ([05](05-home-ia-and-tabs.md)) | The user's "next" feature, once production is stable | The hero's skin slot rendered from data; billing that handles one-time products ([19](19-play-billing-research.md)) |
| 3 | **Android home-screen widget** (+ Log, today's spend) | Once there's a D7 baseline | — |
| 4 | **Anonymous-first sign-up** ([03](03-onboarding-target-flow.md), [11](11-anonymous-auth-google-linking.md)) | More than 30% of opener viewers never finish Google sign-in ([17](17-analytics-event-plan-and-consent.md)) | Keep `lib/AuthContext.js` simple |
| 5 | **Split invites** ([07](07-v1-scope-plans-splits-currency.md)) | 20%+ of weekly active loggers have a split, **and** the activity log and settlement confirmation are built | Invite code flagged off, not deleted |
| 6 | **Plans → Goals** ([07](07-v1-scope-plans-splits-currency.md)) | Budget usage suggests demand for savings goals | Plans data untouched |
| 7 | **Going global** ([08](08-monetisation-timing.md)) | The user's decision | The currency model kept |
| 8 | **SDK 57+ upgrade** | Before Play's yearly target-API deadline (August) | — |
| 9 | **iOS** | Android traction | — |

**Follow-up:** after the v1 reset is built, ask the user which of these to act on, and whether any should come before launch.
