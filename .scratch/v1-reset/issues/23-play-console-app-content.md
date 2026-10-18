# Play Console App content declarations

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 

## Question

What does FLO declare in Play Console → App content, for the first closed-test build and then for the billing/production build?

Grill:
- **Data safety:** each data type collected (email, name, financial info entered by the user, app interactions from opt-in analytics [17](17-analytics-event-plan-and-consent.md), crash logs from Play vitals [13](13-crash-reporting-sentry-vs-expo-observe.md), purchase history from billing [08](08-monetisation-timing.md)); whether each is collected or shared, required or optional, and encrypted in transit; plus the account-deletion URL ([15](15-privacy-and-deletion-pages.md)).
- **Financial features declaration:** which label fits a personal expense tracker with no banking or lending.
- **App access:** the demo reviewer account. A dedicated user, already onboarded, with seeded data (accounts, transactions, a budget, a bill, a split). How Supabase email confirmation affects it.
- **Content rating (IARC), target audience (18+), ads (none), government/news (no).**
- **What changes** between the first closed-test build (no in-app purchases) and the billing build.

## Answer

Grilled with the user on 2026-10-18.

**1. Data safety, first closed-test build:**
- **Collected:**
  - **Personal info:** name, email, user IDs.
  - **Other people's names and phone numbers:** optional, from split contacts.
  - **Photos:** optional, the avatar.
  - **Financial info:** "Other financial info" (user-entered transactions, balances, budgets, bills).
  - **App activity:** app interactions and user-generated content (notes, split entries, streak).
  - **Device ID:** the push token.
- **Purposes:** app functionality and account management.
- **Shared:** none. Supabase, Expo and FCM are service providers.
- **Encrypted in transit:** yes.
- **Deletion:** in-app plus the web URL ([15](15-privacy-and-deletion-pages.md)).
- **Not declared:**
  - crash logs: Play vitals is Google's own collection;
  - location: the timezone isn't location;
  - SMS and notifications: the lite build only receives text the user shares.

**2. Reset builds add:** app interactions for **Analytics**, marked **optional** (opt-in, [17](17-analytics-event-plan-and-consent.md)) and not shared.

**3. The billing build adds:**
- **financial info: purchase history** (app functionality);
- the **IARC rating re-answered** with "in-app purchases: yes".

Until then: **"no simulated gambling"**. The safe build's spin wheel uses earned-only coins with buying hidden, and the reset removes it.

**4. Financial features declaration:** **personal finance: budgeting / expense tracking.** Not loans, credit, payments, banking or crypto.

**5. Target audience 18+.** Ads, news, government and health: all no.

**6. App access, the demo reviewer account:**
- a dedicated user created in the Supabase dashboard (confirmed automatically), email and password sign-in;
- `onboarded_at` set;
- seeded data: 2 accounts, about 30 transactions, a budget, a bill and a split;
- **a Pro entitlement row**, so reviewers see Pro;
- credentials **only in Play Console** (App access and pre-launch report), never in the repo;
- never the personal account or `flotest`.
