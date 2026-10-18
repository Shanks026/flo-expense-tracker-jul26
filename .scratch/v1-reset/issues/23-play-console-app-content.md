# Play Console App content declarations

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: open
Blocked by: 

## Question

What does FLO declare in Play Console → App content, for the first closed-test build and then for the billing/production build?

Grill:
- **Data safety:** each data type collected (email, name, financial info entered by the user, app interactions from opt-in analytics [17](17-analytics-event-plan-and-consent.md), crash logs from Play vitals [13](13-crash-reporting-sentry-vs-expo-observe.md), purchase history from billing [08](08-monetisation-timing.md)); whether each is collected or shared, required or optional, and encrypted in transit; plus the account-deletion URL ([15](15-privacy-and-deletion-pages.md)).
- **Financial features declaration:** which label fits a personal expense tracker with no banking or lending.
- **App access:** the demo reviewer account. A dedicated user, already onboarded, with seeded data (accounts, transactions, a budget, a bill, a split). How Supabase email confirmation affects it.
- **Content rating (IARC), target audience (18+), ads (none), government/news (no).**
- **What changes** between the first closed-test build (no in-app purchases) and the billing build.
