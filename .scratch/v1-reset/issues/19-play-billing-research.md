# Play Billing on Expo SDK 54 without RevenueCat

Map: [../map.md](../map.md)
Type: research
Labels: wayfinder:research
Status: resolved
Blocked by: 08

## Question

How do we ship Google Play Billing for FLO Pro without RevenueCat? The plans are ₹99/month, ₹399/year with a 7-day trial, and a ₹999 lifetime purchase ([08](08-monetisation-timing.md)). The same plumbing must later sell one-time Store skins.

Facts needed:
- **Library:** `expo-iap` vs `react-native-iap` on Expo SDK 54 / RN 0.81 with the New Architecture. Which is maintained, what the Play Billing Library version is, the config plugin, and the dev-client requirement.
- **Server verification:** verifying purchases in a Supabase Edge Function (Deno) with the Google Play Developer API (`purchases.subscriptionsv2`, `purchases.products`). Service-account setup, acknowledgement within 3 days, and real-time developer notifications via Pub/Sub, including how a Supabase function receives them.
- **Data model:** how `entitlements` (`is_pro`, missing row = Free) should record source, expiry, grace period, account hold and lifetime.
- **Play Console setup:** creating a subscription with base plans and a free-trial offer, plus a one-time product. Payments profile and merchant requirements for an individual developer in India, and how GST works on Play sales in India.
- **Testing:** license testers, test cards, accelerated renewals, and how this works on the closed-test track.
- **Policy and declarations:** Data safety and IARC changes for in-app purchases, plus restore purchases and cancellation UX that Play requires.

Recommend a library and an architecture.

## Answer

**Use `expo-iap`, pinned to an exact version** (6.1.1 at the time of research). It wraps Play Billing Library 9.1.0, so it meets Google's "Billing 8+ by 2026-08-31" deadline.
- It needs a native build (`expo run:android` or EAS), but not the `expo-dev-client` package.
- **Never set `iapkitApiKey`.** That enables OpenIAP's hosted, third-party verification.
- `react-native-iap` 17 is not recommended, because it needs Nitro Modules.

**Architecture:**
1. **The client buys** through `expo-iap`, attaching a hashed FLO user id to the purchase.
2. **A `play-verify` Edge Function**, called with the user's JWT:
   - signs a service-account RS256 JWT with WebCrypto;
   - calls `subscriptionsv2.get` or `products.get`;
   - checks the hashed user id;
   - **acknowledges on the server.** Pro, lifetime and skins are never consumed.
3. **A `play-rtdn` Edge Function** handles lifecycle updates:
   - it receives Real-time Developer Notifications by Pub/Sub push, with `verify_jwt = false`;
   - it checks Google's token itself, dedupes on `messageId`, and always re-fetches the purchase.
4. **A daily pg_cron reconcile** catches expiries and voided purchases if a notification is missed.
5. **Data:**
   - a `play_purchases` ledger keyed on `purchase_token`;
   - `entitlements` gains `source`, `product_id`, `base_plan_id`, `state`, `is_lifetime`, `expires_at`, `auto_renewing` and `purchase_token`;
   - the server keeps `is_pro` current, so `useEntitlement()` keeps working, and the client also checks `expires_at`;
   - Store skins later become one-time ledger rows, with no new billing code.

**Fees and tax in India:**
- Google's fee is 15% on subscriptions. On one-time products it's 15% only after enrolling in the 15% tier, otherwise 30%.
- Prices must include tax.
- **For an India-based developer, Google does not pay the GST.** The developer pays it, if registration is required.
- Google withholds 0.1% income tax (5% without a PAN) plus GST TCS.

**Testing:**
- License testers can sideload builds once the package exists in Play Console.
- Test renewals are fast: monthly takes 5 minutes, annual 30 minutes, the trial 3 minutes.

**Fixes the build must include** (found in the code):
- `lib/pro.js` prices are still ₹699 and ₹1,499. They change to the ₹399 and ₹999 decided in [08](08-monetisation-timing.md).
- `ProUpsellSheet`'s "Level up for ₹58/mo" shows the annual plan as a monthly cost, which Play's subscription policy prohibits. Show the real billed price.
- **The package id can't change once billing is set up,** so [14](14-package-id-firebase.md) must be done before the first upload. It already is ordered first.
- The lite and personal variants may each need their own products and notification setup.

**Open risks:**
- SDK 54 is supported but untested by the library authors, and releases ship almost daily.
- The JWT signing and the push-token check are hand-rolled in Deno.
- A purchase made on one account could be restored to a different FLO user.
- The IARC citation and the Indian bank-account details come from secondary sources.

Findings: branch `research/play-billing-without-revenuecat`, `research/play-billing-without-revenuecat.md` (commit 1bafd3a).
