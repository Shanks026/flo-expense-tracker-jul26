# Pro with Google Play Billing

Status: ready-for-agent
Source: v1-reset map — [Monetisation: Pro with Play Billing before production](../../.scratch/v1-reset/issues/08-monetisation-timing.md), [Play Billing without RevenueCat](../../.scratch/v1-reset/issues/19-play-billing-research.md) (findings on branch `research/play-billing-without-revenuecat`)

## Problem Statement

Pro has gates, a benefits list and prices, but **no billing**. "Upgrade" shows a "Payments aren't live yet" toast. The person running FLO wants Pro **purchasable at production launch**. That means Google Play Billing for a monthly and an annual subscription (with a free trial) and a one-time lifetime purchase, verified server-side so entitlements can't be faked. And it has to work without RevenueCat or any other external SDK. The same plumbing must later sell one-time Store skins. The current code also breaks Play's subscription policy: it shows the annual plan as "₹58/mo".

## Solution

Direct Play Billing via **`expo-iap`** (pinned):
- **Monthly ₹99**;
- **Annual ₹399** with a **7-day free trial**;
- **Lifetime ₹999**, one-time.

Purchases are verified and acknowledged by a **`play-verify` Supabase Edge Function**. Renewals, cancellations and refunds arrive through **Real-time Developer Notifications** at a **`play-rtdn`** function, and a daily reconcile backs that up. Everything lands in a **`play_purchases`** ledger feeding `entitlements`.

Pro is visible in More, at limit gates and on locked Insights features. **Never in onboarding.** The `billing` flag from spec 32 turns all of this on in the billing fix build during the closed test.

## User Stories

1. As a free user, I want to see what Pro gives me (unlimited accounts, budgets and splits, custom budget periods, full Insights and CSV), so that I can decide if it's worth it.
2. As a free user hitting a limit (a second account, third budget or second split), I want the Pro sheet to open, so that the wall comes with a way forward.
3. As a user, I want the Pro screen in More, so that I can upgrade without hitting a gate.
4. As a user, I want to choose monthly (₹99), annual (₹399, 7-day free trial) or lifetime (₹999), so that I pick what suits me.
5. As a user, I want each price shown as it's actually billed, so that I'm never misled.
6. As a user, I want the trial terms shown clearly before I start (free for 7 days, then ₹399/year unless cancelled), so that I'm not surprised.
7. As a user, I want to pay with Google Play's own purchase sheet, so that I trust the payment.
8. As a user who just paid, I want Pro unlocked within seconds, so that I can use it immediately.
9. As a user whose payment is pending, I want to see "pending" and get Pro when it clears, so that slow payment methods still work.
10. As a user on a new phone, I want "Restore purchases", so that my Pro follows my Google account.
11. As a user, I want "Manage subscription" to take me to Play's subscription page, so that I can cancel easily.
12. As a subscriber who cancels, I want Pro to last until the period I paid for ends, so that I get what I paid for.
13. As a subscriber whose payment fails, I want a grace period before losing Pro, so that a card hiccup doesn't lock me out.
14. As a lifetime buyer, I want Pro forever with no renewals, so that I pay once.
15. As a user who already created more than the free limits while Pro was off, I want to keep everything I made, so that billing never takes data away.
16. As a user, I want no paywall during onboarding or on app launch, so that FLO earns my trust first.
17. As a user refunded by Google, I want Pro removed, so that entitlements match payments.
18. As the person running FLO, I want every purchase verified server-side and acknowledged within Play's window, so that purchases aren't refunded automatically and can't be faked.
19. As the person running FLO, I want a purchase tied to the FLO user who made it, so that one Google purchase can't unlock another person's account.
20. As the person running FLO, I want missed notifications caught by a daily check, so that nobody stays Pro forever by accident.
21. As the person running FLO, I want `pro_sheet_viewed`, `purchase_started` and `purchase_completed` tracked, so that I can tune pricing and gates.
22. As a license tester in the closed test, I want test purchases with accelerated renewals, so that billing gets real testing before production.

## Implementation Decisions

**Products (Play Console):**
- subscription **`flo_pro`** with base plans **`monthly`** (₹99) and **`annual`** (₹399) and a **7-day free-trial offer** on annual;
- one-time product **`flo_pro_lifetime`** (₹999);
- INR base price, India-only availability;
- prices include tax. Because the developer is in India, GST is the developer's own responsibility.

**Client:**
- **`expo-iap`, pinned to an exact version.** **Never set its hosted-verification key**, which would enable OpenIAP's third-party service.
- Purchases carry an **obfuscated account id** (a hash of the FLO user id).
- After a purchase, the client calls `play-verify` with the purchase token and product. The UI waits for the verified entitlement.
- Restore re-sends owned purchases to `play-verify`.
- Manage subscription deep-links to Play's subscriptions page.

**Pro surfaces:**
- `lib/pro.js` prices become ₹99 / ₹399 / ₹999.
- **The annual card shows "₹399/year"**, with any per-month figure only as a secondary, clearly derived note. The "Level up for ₹58/mo" copy goes.
- `plans` is removed from the limits and benefits.
- "Full reports" means Insights' custom ranges, all-accounts view and CSV.
- The Pro sheet and screen show the trial terms and a restore link.
- **Placements:** limit gates, the Pro row in More, locked Insights features. **Never onboarding or launch.**

**Gates:**
- create-time only (standing rule), `{ accounts: 1, budgets: 2, splits: 1 }`, active when `billing` is on;
- **anything created while billing was off is kept** (gates never retroactively remove or lock).

**Server (two new Edge Functions plus one cron):**
- **`play-verify`** (user JWT):
  - signs a service-account RS256 JWT with WebCrypto for the `androidpublisher` scope;
  - calls `purchases.subscriptionsv2.get` or the one-time products API;
  - checks the obfuscated account id matches the caller;
  - **acknowledges server-side** (never consumes);
  - upserts `play_purchases` and recomputes `entitlements`.
- **`play-rtdn`** (`verify_jwt = false`):
  - receives Pub/Sub push and checks Google's OIDC token;
  - dedupes on `messageId`;
  - always **re-fetches** the purchase from the API, then upserts and recomputes.
- **Daily reconcile (pg_cron):** re-checks purchases near expiry or in grace or hold, plus voided purchases.

**Schema:**
- **new `play_purchases` ledger:** `purchase_token` (PK), `user_id` (cascade), `product_id`, `base_plan_id`, `kind` (subscription | one_time), `state`, `expires_at`, `auto_renewing`, `acknowledged`, `raw` (API response), timestamps. Owner-select RLS; writes are service-role only.
- **`entitlements` gains:** `source`, `product_id`, `base_plan_id`, `state` (active | grace | on_hold | cancelled | expired), `is_lifetime`, `expires_at`, `auto_renewing`, `purchase_token`.
- The server keeps `is_pro` current, so `useEntitlement()` keeps working. **The client also treats `expires_at` in the past as not Pro.**
- Missing row still means Free.

**Store-ready:** future Store skins become `one_time` ledger rows through the same `play-verify`. No new billing code.

**Variants:** only the store package `app.floexpense.tracker` sells Pro. The personal build doesn't register products.

**Declarations:** the billing build updates Data safety (purchase history) and the IARC rating (in-app purchases) before production (App content ticket).

**Analytics:** `pro_sheet_viewed {trigger}`, `purchase_started {product}`, `purchase_completed {product}` (spec 33).

## Testing Decisions

- **A good test** buys, cancels, restores and refunds as a license tester and checks what the user can do afterwards, plus the server's ledger. Not library internals.
- **Seam 1, the emulator or a phone, as a license tester** on the closed-test track:
  - buy monthly, then annual with the trial, then lifetime: Pro unlocks within seconds;
  - restore on a fresh install;
  - cancel: Pro remains until expiry (accelerated: monthly 5 min, annual 30 min, trial 3 min), then is removed;
  - a declined test card leads to grace, then hold;
  - limit gates open the sheet; items created before billing are kept;
  - no paywall in onboarding or on launch;
  - prices show as billed.
- **Seam 2, Supabase via MCP:**
  - `play_purchases` rows per test purchase, acknowledged = true;
  - `entitlements` states follow each RTDN;
  - the reconcile cron is scheduled and flips an expired row;
  - a token replayed by another user is rejected.
- **Prior art:** the `send-push` Edge Function's service-role and cron pattern (feature 17); the existing entitlement read hook.

## Out of Scope

- **RevenueCat or any third-party billing or verification service.**
- **The seasonal skin Store and admin portal** (post-launch). The ledger is ready for it.
- **Countries other than India,** and per-country prices.
- **iOS / App Store.**
- **Promo codes and introductory price experiments.**

## Further Notes

- **The package id must be final before billing is set up** (spec 32 and the package-id task). Products are tied to it.
- Do `play-verify` and `play-rtdn` carefully: the JWT signing and the OIDC check are hand-rolled in Deno, so test them against Google's documented samples.
- The billing build ships as a closed-test fix build **at least 7 days before applying for production**, with 3 or more license testers completing a test purchase (closed-test go/no-go).
- The research also flagged edge cases where a purchase is restored to a different FLO user. The obfuscated-id check covers the common case. Document the rest in the build's notes.
