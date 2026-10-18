# Monetisation: Pro with Play Billing before production (was: hide Pro in v1, RevenueCat later)

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 

## Question

What does v1 do about Pro?

The audit proposes:
- hide every price and Buy button in v1.0;
- cut coin packs permanently;
- add RevenueCat and Play Billing after launch.

Grill:
- Are FREE_LIMITS still enforced in v1 when there's no way to upgrade? Or is everyone effectively Pro?
- Is the Pro screen hidden, or shown as "coming soon"?
- Do coin packs go permanently?
- When does billing land: v1.1, or during the closed test?

Refs: audit §2 P0 Pro has no billing, §4 P0 coin packs, §6 P0 payments stubbed, P2 RevenueCat.

## Context added 2026-10-18 (from [05](05-home-ia-and-tabs.md))

The first post-launch feature is a **Store** that sells seasonal card skins and bundles for real money via Play Billing (no coins), managed through a later admin portal. Billing therefore has to support one-time purchases as well as Pro. Weigh that when deciding when billing lands.

## Answer

Grilled with the user on 2026-10-18. The audit's "hide Pro in v1, RevenueCat later" is **rejected**: "it should be present… we need this pre launch."

**1. Pro is visible in v1 and purchasable at production launch.** It shows in More and at every limit gate, with real prices.

**2. How billing reaches the closed test:**
- The [safe closed-test build](01-safe-closed-test-build.md) starts the 14-day clock **without** billing, with Pro surfaces hidden.
- Billing ships as a **fix build during the closed test**, and testers try real purchases as license testers.
- Production launches with the billing build.

**3. Free limits stay as create-time gates:** `{ accounts: 1, budgets: 2, splits: 1 }`. Each gate opens the Pro sheet.
- **"plans" is removed** from `FREE_LIMITS` and `PRO_BENEFITS`, since Plans are flagged off ([07](07-v1-scope-plans-splits-currency.md)).
- The "Full reports" benefit means Insights' custom ranges, all-accounts view and CSV export.

**4. Plans and prices,** in INR as the Play base currency:

| Plan | Price | Type |
|---|---|---|
| Monthly | **₹99/month** | subscription |
| Annual | **₹399/year**, "Save 66%", with a **7-day free trial** | subscription |
| Lifetime | **₹999** | one-time |

`PRO_MONTHLY_EQUIVALENT` becomes about ₹33.

**5. Where the paywall shows:**
- **never in onboarding**;
- at a limit gate (the Pro sheet);
- from the Pro row in More;
- from locked Insights features.

There's no nag screen on launch.

**6. How billing is built:**
- **Direct Play Billing** (`expo-iap` or `react-native-iap`). **No RevenueCat,** per the no-external-SDKs rule.
- A Supabase Edge Function verifies purchases with the Google Play Developer API and writes to `entitlements`.
- Real-time developer notifications handle renewals and cancellations.
- The same plumbing later serves one-time Store skins ([05](05-home-ia-and-tabs.md)).
- The open facts are in [19](19-play-billing-research.md).

**7. Play declarations:** the first closed-test build declares no in-app purchases. The billing build updates the Play listing, Data safety and the IARC rating ("in-app purchases") before production.

**8. India only** for the closed test and the v1 production launch. **Going global is post-launch:**
- multi-currency switched back on, with locale defaults;
- a GDPR-ready privacy policy;
- per-country price checks;
- Play's EU trader disclosure.

Coin packs are cut for good: real money only ever buys Pro or Store items.
