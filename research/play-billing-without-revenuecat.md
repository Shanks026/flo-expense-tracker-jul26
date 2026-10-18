# Play Billing for FLO Pro without RevenueCat

Researched 2026-10-18. Sources are primary (Google Play / Android / Google Cloud docs, Play Console Help, Supabase docs, the library's own repo/npm/docs) unless marked otherwise.

## Question

How do we sell FLO Pro on Google Play (India only) using Google Play Billing directly, with no third-party SDK or service? The products are a monthly subscription at ₹99, an annual subscription at ₹399 with a 7-day free trial, and a one-time lifetime purchase at ₹999. The same plumbing must later sell one-time "Store" items such as card skins and bundles. The constraints are Expo SDK 54, RN 0.81 (New Architecture, Hermes), Supabase with Deno Edge Functions, and the standing rules (no AI, no external services such as RevenueCat, Adapty or Qonversion).

## Recommendation

Use **`expo-iap`**, pinned to an exact version. It is an Expo Module, so it needs no Nitro dependency. It ships a config plugin and wraps Google Play Billing Library 9.1.0 through OpenIAP's `openiap-google`. It is the IAP library Expo's own guide lists next to RevenueCat. It needs a native build, but not the `expo-dev-client` package: `expo run:android` and EAS builds already qualify. Do **not** set the plugin's `iapkitApiKey`. That option is OpenIAP's hosted verification service (IAPKit), which is a third-party service.

Do all verification server-side, in two new Supabase Edge Functions:

- `play-verify` is called by the app with the user's JWT. It calls the Google Play Developer API (`subscriptionsv2.get` / `productsv2` or `products.get`), writes the result, then acknowledges on the server.
- `play-rtdn` receives Real-time Developer Notifications through a Cloud Pub/Sub **push** subscription. It runs with `verify_jwt = false` and checks Google's OIDC token itself.

Both functions authenticate to Google with a service-account JWT signed in Deno with WebCrypto. The only Google surfaces involved are Play itself plus a Cloud project for Pub/Sub and the API. A new `play_purchases` table, keyed on the globally unique `purchaseToken`, is the ledger. `entitlements` stays the single row the client reads: it keeps `is_pro` and gains source, product, state and expiry columns. Only the service role writes either table.

## Architecture

1. **Play Console**
   - Create subscription `flo_pro` with base plans `monthly` (₹99, P1M) and `annual` (₹399, P1Y).
   - Add a free-trial offer `annual-trial-7d` on `annual`, with eligibility "New customer acquisition".
   - Create one-time product `flo_pro_lifetime` (₹999, non-consumable).
   - Later, Store items go in as further one-time products, e.g. `skin_*` and `bundle_*`.
   - Turn on RTDN and point it at a Pub/Sub topic. Invite the service account with the financial/orders permissions.
2. **App start / foreground.** `initConnection()`, then `getAvailablePurchases()`. Send any purchase the server hasn't seen to `play-verify`. This covers purchases that completed while the app was closed and purchases made on another device. It is also the "Restore purchases" button.
3. **Paywall** (`app/pro.js`)
   - Load prices with `fetchProducts({ skus, type: 'subs' | 'in-app' })` and show Play's localised `formattedPrice` rather than the hard-coded strings in `lib/pro.js`.
   - Show the trial only if the user's `subscriptionOffers` include the trial offer token.
4. **Buy.** Register `purchaseUpdatedListener` first, then call `requestPurchase` with `offerToken` for subscriptions. Set `obfuscatedAccountIdAndroid` to a hash of the Supabase `user.id`.
5. **On a purchase update** with state PURCHASED (never PENDING), POST `{ purchaseToken, productId, type }` to the **`play-verify`** Edge Function, carrying the user JWT.
6. **`play-verify`** does the following:
   - (a) Resolves the user from the JWT.
   - (b) Mints a Google access token: an RS256 JWT for scope `https://www.googleapis.com/auth/androidpublisher`, exchanged at `oauth2.googleapis.com/token` and cached for about 55 minutes.
   - (c) Calls `purchases.subscriptionsv2.get` for subscriptions, or `purchases.productsv2.getproductpurchasev2` / `purchases.products.get` for one-time products.
   - (d) Checks `packageName`, the product ID, state PURCHASED/ACTIVE, and that `obfuscatedExternalAccountId` matches the caller.
   - (e) Upserts `play_purchases` by `purchase_token` and recomputes `entitlements` for that user. If `linkedPurchaseToken` is set, it supersedes the old token's row.
   - (f) **Acknowledges on the server**: `purchases.subscriptions.acknowledge` or `purchases.products.acknowledge`. It never *consumes* Pro or skins, because they are non-consumable.
   - (g) Returns the entitlement.
7. **Client** calls `finishTransaction({ purchase, isConsumable: false })` after `play-verify` succeeds. This is a harmless second acknowledgement; the server ack already did the job. Then `notifyChanged()`, and `useEntitlement()` refetches.
8. **Lifecycle.** Google publishes RTDNs to Pub/Sub, and a push subscription POSTs them to **`play-rtdn`**. That function:
   - verifies the `Authorization: Bearer` OIDC JWT (issuer, audience, and the push service-account `email`)
   - base64-decodes `message.data` and dedupes on `messageId`
   - **re-fetches** the purchase from the Developer API, because the notification carries only a type and a token
   - updates `play_purchases` and `entitlements`, then returns 200/204

   It handles renewals, grace period, account hold, cancellation, expiry, revocation, voided purchases and refunds.
9. **Safety net.** A daily pg_cron job, the same pattern as `send-push`, flips `is_pro` false where `expires_at < now()` for non-lifetime rows and polls `voidedpurchases.list`. This covers missed RTDNs.
10. **Manage / cancel.** Settings opens `https://play.google.com/store/account/subscriptions?sku=flo_pro&package=<pkg>` through `deepLinkToSubscriptions()`.

## Key facts with sources

### 1. Library: `expo-iap` vs `react-native-iap`

**Maintenance and versions**
- Both are maintained, but both GitHub repos are **archived** and development moved to the `hyodotdev/openiap` monorepo. The repo READMEs say each library "is actively maintained — development simply moved home". The `react-native-iap` repo was archived 2026-08-04. Sources: https://github.com/hyochan/expo-iap, https://github.com/hyochan/react-native-iap, https://github.com/hyodotdev/openiap
- From `npm view` on 2026-10-18: `expo-iap` latest is **6.1.1** (published 2026-10-18; 6.0.0 on 2026-10-09; 5.0.0 on 2026-07-30). `react-native-iap` latest is **17.1.0** and has a peer dependency `react-native-nitro-modules >=0.36.5`. Releases ship almost daily.

**How they differ**
- `react-native-iap` 14+ is Nitro-based: you must install `react-native-nitro-modules`, and it needs RN 0.79+ and Kotlin 2.0+.
- `expo-iap` is "an Expo Module with tighter integration and smoother compatibility in the Expo ecosystem".
- Both sit on the same `openiap-google` native layer. The `expo-iap` 6.1.1 tarball pins `openiap-versions.json` → `google: 4.0.3`. Sources: https://github.com/hyochan/react-native-iap, https://github.com/hyochan/expo-iap

**Requirements**
- Billing Library and minimum Expo SDK, from the setup docs:
  - "expo-iap uses OpenIAP Android artifacts backed by Google Play Billing Library v9.1.0."
  - The minimum Expo SDK is "53+; SDK 57 / React Native 0.86 is the validated baseline".
  - SDK 52 is unsupported because it is stuck on Kotlin 1.9.
  - Do not use the standalone Kotlin 2.4.x compiler in Expo builds.

  Source: https://openiap.dev/docs/setup/expo
- Android SDK levels: the module's `android/build.gradle` defaults to `compileSdk` 36 and `minSdk` 23, both read from the root project.
- Install is `npx expo install expo-iap`, plus `"expo-iap"` in `plugins`, then prebuild. Expo Go is not supported: "In-app purchases require native modules that are not available in Expo Go." Source: https://openiap.dev/docs/setup/expo
- Expo's own IAP guide lists only `react-native-purchases` (RevenueCat) and `expo-iap`. It says expo-iap "works with development builds". Source: https://docs.expo.dev/guides/in-app-purchases/

**What this means for FLO's build setup**
- FLO doesn't need the `expo-dev-client` *package*. Any native build of the real package name works: `expo run:android`, or the EAS `preview`/`production` profiles. (This is an inference from the above, not a stated fact.)
- Note that `eas.json`'s `development` profile already sets `developmentClient: true` even though the package isn't installed.

**API surface** (from https://openiap.dev/llms.txt and the 6.1.1 build output)
- Calls: `initConnection`, `fetchProducts({skus,type})`, `requestPurchase({request:{google:{skus, offerToken…}}, type})`, `purchaseUpdatedListener`, `purchaseErrorListener`, `finishTransaction({purchase,isConsumable})`, `getAvailablePurchases`, `restorePurchases`, `deepLinkToSubscriptions`.
- Fields: `obfuscatedAccountIdAndroid`, `subscriptionOffers`, `offerToken`.
- `requestPurchase` is event-based, not promise-based.
- Since 6.0.2, Android should call `deepLinkToSubscriptions` rather than the iOS variant. Source: https://openiap.dev/docs/updates/releases

**Play Billing Library deadline**
- Google's getting-ready page shows Billing **9.1.0**, and says new apps and updates must use Billing Library **8+** from 2026-08-31, with an extension available to 2026-11-01. `expo-iap` (Billing 9.1.0) meets this. Source: https://developer.android.com/google/play/billing/getting-ready

### 2. Server verification in a Supabase Edge Function

**Developer API endpoints** (base `https://androidpublisher.googleapis.com`). Source: https://developers.google.com/android-publisher/api-ref/rest

| Method | Path |
|---|---|
| `GET` | `/androidpublisher/v3/applications/{pkg}/purchases/subscriptionsv2/tokens/{token}` |
| `GET` | `…/purchases/productsv2/tokens/{token}` (`getproductpurchasev2`) |
| `GET` | `…/purchases/products/{productId}/tokens/{token}` |
| `POST` | `…/purchases/subscriptions/{subId}/tokens/{token}:acknowledge` |
| `POST` | `…/purchases/products/{productId}/tokens/{token}:acknowledge` (and `:consume`) |
| `POST` | `…/purchases/subscriptionsv2/tokens/{token}:revoke` |
| `POST` | `…/orders/{orderId}:refund` |
| `GET` | `…/purchases/voidedpurchases` |

**Which call to use**
- `subscriptionsv2.get` is "considered the source of truth". The old `purchases.subscriptions.get` "shouldn't be used to obtain subscription states for new integrations". Source: https://developer.android.com/google/play/billing/lifecycle/subscriptions
- Verify with `products:get` or `subscriptionsv2:get`.

**Rules for handling a purchase.** Source: https://developer.android.com/google/play/billing/security
- Use `purchaseToken` as the dedupe key and primary key, because it is globally unique. Don't use `orderId`: not all purchases have one.
- Grant only on PURCHASED.
- Check the obfuscated account ID matches the user.
- Revoke the entitlement of any `linkedPurchaseToken`.
- Acknowledge right after granting.
- Revoke and refund fraud explicitly rather than letting it lapse.
- Use the Voided Purchases API.

**Acknowledgement**
- You must acknowledge within 3 days, or the purchase "is automatically refunded and entitlement revoked".
- With a secure backend, Google recommends acknowledging on the server: "we recommend using `Purchases.products:acknowledge`". Use `Purchases.subscriptions.acknowledge` for subscriptions.
- Renewals don't need acknowledging.
- The 3-day window starts when the purchase goes from PENDING to PURCHASED.
- Pending purchases must be enabled for one-time products. `expo-iap` handles that natively.

Source: https://developer.android.com/google/play/billing/integrate
- Non-consumables (Pro lifetime, skins) are acknowledged, **not** consumed, because consuming them would let the user buy them again. Same source.

**Service-account auth from Deno**
- There is a REST flow without a client library. It works with WebCrypto `crypto.subtle.importKey('pkcs8')` and `sign('RSASSA-PKCS1-v1_5', SHA-256)`:
  - Build an RS256 JWT with `iss` = service-account email, `scope`, `aud` = `https://oauth2.googleapis.com/token`, `iat`, and `exp` no more than 1 hour after `iat`.
  - POST it as `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=…`.
  - Use the returned `access_token` as Bearer until `expires_in`.

  Source: https://developers.google.com/identity/protocols/oauth2/service-account
- The scope is `https://www.googleapis.com/auth/androidpublisher`. (This scope name comes from the API's discovery doc; the getting-started page doesn't name it.)

**Play Console API access**
- Enable the Google Play Developer API in the Cloud project and create the service account. Then invite its email in Play Console under **Users & permissions** with "View financial data, orders, and cancellation survey responses" and "Manage orders and subscriptions". Source: https://developers.google.com/android-publisher/getting_started
- Store the key JSON as an Edge Function secret, never in the app.

**RTDN setup** (source: https://developer.android.com/google/play/billing/getting-ready)
- Create a Pub/Sub topic.
- Grant `google-play-developer-notifications@system.gserviceaccount.com` the **Pub/Sub Publisher** role on it.
- In Play Console, go to **Monetize > Monetization setup** and enter `projects/{id}/topics/{topic}`. Use "Send Test Message" to check it.
- Opt in to the one-time product events too, not just subscriptions and voided purchases.
- Google recommends push: it is "generally easier to implement".

**RTDN payload** (source: https://developer.android.com/google/play/billing/rtdn-reference)
- `message.data` is base64 JSON with `version`, `packageName`, `eventTimeMillis`, and exactly one of `subscriptionNotification`, `oneTimeProductNotification`, `voidedPurchaseNotification`, `pendingRefundReviewNotification` or `testNotification`.
- Subscription notification types include 1 RECOVERED, 2 RENEWED, 3 CANCELED, 4 PURCHASED, 5 ON_HOLD, 6 IN_GRACE_PERIOD, 7 RESTARTED, 10 PAUSED, 12 REVOKED, 13 EXPIRED and 20 PENDING_PURCHASE_CANCELED.
- One-time notification types are 1 PURCHASED and 2 CANCELED.
- Notifications "tell you only that the purchase state changed", so always re-query.
- Dedupe on `messageId`.

**Push delivery** (source: https://docs.cloud.google.com/pubsub/docs/push)
- Pub/Sub POSTs a JSON wrapper with `message.data`, `messageId`, `publishTime` and `subscription` to a publicly addressable HTTPS endpoint.
- Responses 102, 200, 201, 202 and 204 ack the message. Anything else, or a timeout, makes it retry with backoff.
- A public Supabase function URL (`https://<ref>.supabase.co/functions/v1/play-rtdn`) qualifies.

**Authenticating the push** (source: https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions)
- Configure the push subscription with an auth service account. Pub/Sub then sends an OIDC JWT as `Authorization: Bearer`.
- In the handler, verify the signature against Google's certs, the issuer (`https://accounts.google.com`), `email_verified`, and that `email` and `aud` match the subscription config.
- Tokens may be up to an hour old.
- The Pub/Sub service agent needs `roles/iam.serviceAccountTokenCreator`, and whoever creates the subscription needs `iam.serviceAccounts.actAs`.

**Supabase side** (source: https://supabase.com/docs/guides/functions/auth)
- Google can't send a Supabase JWT, so set `[functions.play-rtdn] verify_jwt = false`. The page warns the handler is then "fully responsible for authenticating the caller".
- That is the same pattern Supabase documents for Stripe and GitHub webhooks.
- A shared secret in the push URL query string is a simpler but weaker fallback. That's an inference, not a documented option.

### 3. Entitlement data model

**What exists today** (read from code only; the database was not queried)
- `hooks/useEntitlement.js` runs `supabase.from('entitlements').select('is_pro').eq('user_id', userId).maybeSingle()`, and a missing row means Free.
- `lib/pro.js` holds limits, pricing and benefits. Nothing in the client writes `entitlements`.

**Proposal: keep `entitlements` as the one row per user the client reads, and add a ledger next to it**

`entitlements` (one row per user; the client can SELECT only its own row; only the service role writes):

| column | type | notes |
|---|---|---|
| `user_id` | uuid PK → auth.users | existing |
| `is_pro` | boolean | existing. The server recomputes it, so the current hook and every gate keep working unchanged. |
| `source` | text | `'play' \| 'promo' \| 'manual'`, so a future grant or comp row doesn't need a new table |
| `product_id` | text | `flo_pro` or `flo_pro_lifetime` |
| `base_plan_id` | text | `monthly` / `annual` (null for lifetime) |
| `state` | text | `active \| in_trial \| grace \| on_hold \| paused \| canceled \| expired \| revoked \| lifetime` |
| `is_lifetime` | boolean | true wins over any subscription state |
| `expires_at` | timestamptz | `lineItems[].expiryTime`; null for lifetime |
| `auto_renewing` | boolean | `autoRenewingPlan.autoRenewEnabled`, used to show "renews on" or "ends on" |
| `purchase_token` | text | the token currently backing the entitlement, used for the manage link and re-sync |
| `updated_at` | timestamptz | |

`play_purchases` (the ledger, one row per purchase token; the service role only, or a SELECT-own policy for a purchase-history screen):
- Columns: `purchase_token` (PK), `user_id`, `product_id`, `product_type` (`subs`/`inapp`), `base_plan_id`, `offer_id`, `order_id` (nullable), `state`, `acknowledged`, `expires_at`, `linked_purchase_token`, `raw` jsonb (the last API response), `created_at`, `updated_at`.
- Later, Store items such as skins become `play_purchases` rows with `product_type = 'inapp'`. Ownership is a view or table, e.g. `owned_items(user_id, item_id)`, derived from non-revoked rows. No new billing code is needed.

**How the server maps state to `is_pro`** (following https://developer.android.com/google/play/billing/lifecycle/subscriptions)

| Play state | `is_pro` |
|---|---|
| ACTIVE (including trial) | true |
| IN_GRACE_PERIOD | true |
| CANCELED with `expiryTime` in the future | true |
| ON_HOLD | false |
| PAUSED | false |
| EXPIRED | false |
| REVOKED | false |
| A non-revoked lifetime purchase | true, whatever the subscription state |

`is_pro` is OR'd across all of the user's valid tokens.

**How the client reads it**
- `useEntitlement()` stays as it is but also selects `state, expires_at, is_lifetime, base_plan_id, auto_renewing`.
- Treat `is_pro && (is_lifetime || expires_at == null || expires_at > now())` as Pro. That way a missed RTDN can't leave someone Pro forever.
- The server stays authoritative. Client gates remain create-time only, per AGENTS.md.

### 4. Play Console setup, payments, fees, tax

**Before you can create products**
- You need a Google Payments profile linked to the developer account.
- You must "publish a version of your app that includes the Google Play Billing Library" to any track. The internal track is fine, but purchases there and in draft are spend-limited. Billing features in Play Console unlock only after that.

Source: https://developer.android.com/google/play/billing/getting-ready

**Subscriptions** (source: https://support.google.com/googleplay/android-developer/answer/12154973)
- A subscription contains base plans (auto-renewing or prepaid), each with a billing period and per-country prices. Offers apply to auto-renewing base plans only.
- A free-trial phase can be 3 days to 3 years.
- Offer eligibility can be **New customer acquisition**, Upgrade, or Developer determined.
- Account hold is on by default. Account hold plus grace period must add up to 30 days or more.
- So the plan is one subscription `flo_pro` with base plans `monthly` and `annual`, plus an offer on `annual` with a 7-day free-trial phase.

**Free trials** (source: https://developer.android.com/google/play/billing/subscriptions)
- Play checks for a valid payment method before starting a trial.
- If the user cancels during the trial, they keep access until the trial ends and are not charged.
- Users who resubscribe to the same product lose trial eligibility. The UI must reflect that, which is why the paywall gates on `subscriptionOffers`.

**Lifetime and Store items**
- These are one-time products, non-consumable, so they are acknowledged and not consumed (see area 2).

**Service fee** (source: https://support.google.com/googleplay/android-developer/answer/112622)
- India is not one of the markets on the new new-vs-existing-install fee schedule (EEA/UK/US from 2026-06-30, AU/JP from 2026-09-30). India stays on the current rates:
  - 15% for auto-renewing subscriptions
  - 15% on the first $1M/year of other revenue (lifetime, Store items) for developers **enrolled** in the 15% tier, 30% above that
- India's alternative billing system costs the standard fee minus 4%. That isn't relevant here because we use Play billing.
- Action: enrol in the 15% tier, otherwise the one-time products default to 30%.

**Tax** (sources: https://support.google.com/googleplay/android-developer/answer/138000 and https://support.google.com/paymentscenter/answer/7421525)
- India is a **tax-inclusive** pricing country: "The price … must include all taxes, including GST".
- For a developer *located in India*, Google does **not** remit GST on your sales. "App or game developers based in India must determine any tax obligation themselves and pay GST as applicable."
- Google withholds income tax and GST TCS from your proceeds.
- You must provide a GSTIN if GST law requires you to have one.

**Withholding** (source: https://support.google.com/googleplay/android-developer/answer/9384608)
- Withholding is **0.1%** with a PAN and 5% without one, on the price excluding GST.
- Add the PAN under Payments profile > Manage settings > India tax info.

**Payments profile for an individual in India**
- Primary sources confirm you need a payments profile with a PAN, and a GSTIN if registered.
- The Individual vs Business choice and the bank account (same country, test deposit) come only from secondary sources such as GoodBarber help, so confirm them in Play Console.

### 5. Testing

Source for all of this section: https://developer.android.com/google/play/billing/test

**License testers**
- License testers get test instruments: always approves, always declines, a slow approve and a slow decline (for PENDING), and approves-then-chargeback.
- They can sideload, "even for apps using debug builds with debug signatures". The package name must match the Play app and the account must be a license tester. So `expo run:android` builds are testable once the package exists in Play Console with Billing enabled.

**Accelerated timings**

| Real period | Test period |
|---|---|
| 1 month renewal | 5 min |
| 1 year renewal | 30 min |
| Free trial | 3 min |
| Grace period | 5 min |
| Account hold | 10 min |
| Acknowledgement window | 5 min |

Test subscriptions renew at most 6 times. An unacknowledged tester purchase is refunded after about 3 minutes, which is a quick way to catch a broken ack path.

**Tracks**
- Closed and internal testing tracks let testers install from Play. A new release can take a few hours to reach testers.
- License testers aren't strictly needed on the track, but a closed-test release is the realistic end-to-end check, including RTDN.

**Play Billing Lab**
- This Google app can replay trial eligibility, change Play country, and force grace or hold transitions. Its settings expire after 2 hours.

**FLO specifics**
- Use the Medium Phone API 29 emulator *with the Play Store image*, signed into a license-tester Google account.
- The RTDN "Send Test Message" exercises `play-rtdn` without a purchase.

### 6. Policy

**Subscriptions policy** (source: https://support.google.com/googleplay/android-developer/answer/9900533)
- Disclose the price, billing frequency and renewal terms clearly on the plan-selection screen, with no extra taps needed to see them.
- For trials, state when and how the trial converts to paid and how to cancel before it does.
- **Prohibited: "Annual subscriptions that most prominently display their pricing in terms of monthly cost."**
- Benefits that are one-off must be an in-app product, not a subscription.
- Apps must include "an easy-to-use, online method to cancel". A link to the Play Subscription Center in account settings satisfies this.

**Manage link** (source: https://developer.android.com/google/play/billing/subscriptions)
- Use `https://play.google.com/store/account/subscriptions?sku={productId}&package={pkg}`, or the URL without parameters for the general subscription centre. Users can cancel, resubscribe and pause there.

**Restore**
- Google's guidance is to call `queryPurchasesAsync()` on connect and on resume (`getAvailablePurchases()` in expo-iap). Source: https://developer.android.com/google/play/billing/integrate
- Add a visible "Restore purchases" action for users who reinstall or switch devices. That's conventional practice rather than a quoted Play requirement. Purchases are tied to the Google account, so the server must re-link a token to whichever FLO user restores it (obfuscated ID permitting).

**Data safety** (source: https://support.google.com/googleplay/android-developer/answer/10787469)
- Data the payment service collects (card numbers) is exempt when the app never accesses it.
- Because we store purchase records linked to a user on our server, declare **Financial info → Purchase history** as collected, for app functionality and account management. That's an inference from the "consider purchase history" guidance.

**Content rating (IARC)**
- The questionnaire asks about digital purchases, and you must resubmit it when a change affects your answers. Source: https://support.google.com/googleplay/android-developer/answer/188189
- So add IAP, then redo the questionnaire. Exactly which question drives the store's "In-app purchases" label wasn't confirmed from a primary source.

## Open risks

- **SDK 54 is inside expo-iap's supported range but is not its validated baseline (SDK 57 / RN 0.86).** The 6.x package is built against Expo 57. Before committing, pin an exact version and prove an `expo run:android` release build. If 6.x fails on SDK 54/RN 0.81 (Kotlin or AGP), fall back to the newest 5.x. Kotlin is managed through `expo-build-properties` if needed. The release cadence is about daily, so lock the version and read the release notes before every bump.
- **Prices in the ticket don't match the code.** `lib/pro.js` has annual **₹699** and lifetime **₹1,499**; this ticket says ₹399 and ₹999. Decide once, then render Play's `formattedPrice` so the code can't drift from the Console.
- **The paywall's monthly teaser may break policy.** `ProUpsellSheet` shows "Level up for ₹58/mo" (`PRO_MONTHLY_EQUIVALENT`), an annual plan expressed as a monthly cost. Policy prohibits leading with that. Lead with ₹399/year (or whatever price is chosen) and keep any per-month figure secondary.
- **The package name is permanent.** `app.json` has `com.anonymous.flo`, and products, the RTDN config and tester sideloading are all bound to it. Settle the real package ID before the first Billing upload.
- **The Lite/Full variants** (`eas.json`'s `FLO_VARIANT`). If they are different package names, each needs its own products and RTDN config ("configure RTDN for each app separately"). Confirm which variant sells Pro.
- **The Google Cloud dependency.** Pub/Sub and the Developer API need a Cloud project and a service-account key held as a Supabase secret. This is Google's own infrastructure, not a third-party SDK, but it is new operational surface that needs key rotation and IAM.
- **Rolling our own OIDC and JWT handling.** Our own OIDC verification in `play-rtdn` and our own JWT signing in Deno are security-sensitive. Google "strongly recommends" a client library. A vetted JWT library such as `npm:jose` reduces the risk while still adding no SDK to the app.
- **Account mapping edge cases.**
  - A user buys on Google account A while logged into FLO user X, then restores on FLO user Y. Decide whether a token can move between FLO users; the recommendation is no, for subscriptions.
  - Purchases made outside the app (Play Store promo codes) have no obfuscated ID.
- **Tax compliance.** Tax-inclusive ₹ prices mean Google's 15%, GST (if registered), and 0.1% withholding plus TCS all come out of the listed price. The ₹99 tier nets well under ₹84. Get a tax advisor's view on GST registration before launch; Google "can't provide tax advice".
- **Auto-detect and other standing rules aren't affected**, but the Store-items design (skins, bundles) still needs its own feature doc before any code.
