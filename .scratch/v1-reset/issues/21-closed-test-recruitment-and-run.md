# Closed-test recruitment and run

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 

## Question

How do we recruit and run Play's closed test, which needs 12+ testers opted in for 14 consecutive days?

Grill:
- **Recruiting:** where 15–20 testers come from (friends, family, colleagues, communities), and a buffer for drop-outs.
- **Opt-in:** a Google Group or an email list.
- **Instructions:** what testers are asked to do (use it daily, log real expenses, try share-import, later test purchases as license testers), and how they report bugs.
- **Fix-build cadence:** weekly fix builds during the test, carrying the reset and billing ([01](01-safe-closed-test-build.md), [08](08-monetisation-timing.md)).
- **Production access:** what we'll answer in Play's production-access questionnaire, and the go/no-go bar.

## Answer

Grilled with the user on 2026-10-18.

**1. Account type: a Personal Play Console developer account,** not created yet. The user will create it later; it's tracked in [22](22-play-console-account.md).
- Personal accounts **must** run the 12-tester × 14-day closed test.
- An organisation account would need a D-U-N-S number (a registered business), which is slower than the test itself.
- If listing anonymity matters later: register a business and transfer the app to an organisation account.

**2. Testers:** **20**, for a buffer over 12. Friends and people the user knows, on Android in India, using real expenses. They opt in through **a Google Group** and then the Play opt-in link.

**3. What testers are asked to do:**
- open FLO daily for 14 days;
- log real expenses;
- share a bank SMS to FLO;
- later, make a test purchase of Pro as license testers.

Feedback goes through Play's private feedback plus one shared chat group, with no extra tools.

**4. Fix-build cadence:** **weekly** builds, each with a short "what's new". The reset ships in pieces. **The billing build lands at least 7 days before applying for production.**

**5. Google sign-in:** move the Google OAuth consent screen to **"In production"** before the test, so unlisted testers can sign in. FLO only uses basic profile and email; confirm no Google verification is needed when doing it.

**6. When to apply for production:** all of these must be true:
- 14 days with 12 or more testers opted in;
- the reset and billing builds have shipped;
- 3 or more license testers have completed a test purchase;
- Play vitals shows a crash rate below 1% and no unresolved ANR cluster.
