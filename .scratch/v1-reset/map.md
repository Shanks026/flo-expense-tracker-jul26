# Map: FLO v1 reset — lean, retention-first v1 through Play's closed test

Labels: wayfinder:map

Source: [docs/flo-pre-launch-audit-2026-10.md](../../docs/flo-pre-launch-audit-2026-10.md) · Run-book: [docs/matt-implement-flo.md](../../docs/matt-implement-flo.md) · Glossary: [GLOSSARY.md](../../GLOSSARY.md)

## Destination

Every v1 scope, UX and design decision in the audit is settled. Each area has a buildable spec ready for `/to-spec`. The launch-plumbing **decisions** are made (package id, analytics tool, SMTP provider, crash reporting, where the policy pages are hosted). The long-lead tasks the closed test waits on are done. The closed test starts on the first **safe closed-test build**, and the reset reaches testers as later builds. The production rollout itself is past this map.

## Notes

- **Skills to consult every session:** `grilling` + `domain-modeling` (update `GLOSSARY.md` inline), plus the Expo skills `expo-design-system`, `expo-animation` and `eas-app-stores` where relevant. Use `wizard` for console-only HITL steps (Play Console, Firebase, EAS).
- **Standing rules (do not re-litigate):**
  - **No AI features.**
  - Auto-detect is personal-use only and is never hardened or gated for the store.
  - **No external third-party apps/SDKs** (user direction, 2026-10-18: "no need for external applications like sentry"). Prefer Supabase, Play Console and Expo built-ins. Server-side config such as Resend as Supabase's SMTP is fine.
- **Cut ≠ delete:** v1 cuts are feature flags; keep the code and the data.
- **The audit is a proposal.** The "Where the auditors disagreed" table is input, not a decision. Every row gets grilled on its ticket.
- **Reference apps:** Duolingo, Tricount, Splitwise.
  - **Duolingo:** mascot-led warmth and streak.
  - **Tricount and Splitwise:** calm, ledger-first money UI.
  - The tension between them is ticket 04's central question.
- **Mascot:** the cat is the core idea. It can be any kind, shape or colour; start from the existing black-cat art in `assets/mascot/` and the app-icon head.
- **Verification** (for anything built off-map): Medium_Phone_API_29 emulator with `flotest@gmail.com`. There is no test or lint runner.
- **Schema truth:** the live Supabase project `uergtlcfpwajztqgncim` via MCP.

## Decisions so far

<!-- one line per closed ticket: [title](issues/NN-slug.md): gist -->

- [Post-launch backlog boundary](issues/20-post-launch-backlog-boundary.md): 9 candidates recorded with triggers (EAS Update, skin Store, widget, anonymous-first, split invites, Goals, global, SDK 57+, iOS); the user picks what to act on, and whether any come before launch, after the v1 reset is built.
- [Add sheet speed design (3-tap logging)](issues/18-add-sheet-speed-design.md): time-of-day default category (merchant memory first); a top-8 4×2 grid plus More; decimal keypad with Save pinned; Expense|Income toggle plus a collapsed Details row; Undo toast after Save; `seconds_to_save` measured.
- [Analytics event plan and consent placement](issues/17-analytics-event-plan-and-consent.md): opt-in switch on the opener (events queued until sign-in); activation is the first expense within 24h; D1/D7/D30 and weekly active loggers; 15 content-free events; SQL views read in the Supabase dashboard; 13-month retention.
- [Share-to-FLO import v1 scope (SMS/UPI fast path)](issues/09-share-import-v1-scope.md): text shares from bank SMS and UPI apps; parse amount, direction, merchant and date; a merchant→category memory; opens the pre-filled Add sheet and never auto-saves; raw text never stored; a one-time coach mark; a duplicate warning.
- [Play Billing on Expo SDK 54 without RevenueCat](issues/19-play-billing-research.md): `expo-iap` (pinned) with `play-verify` and `play-rtdn` Edge Functions, plus a daily reconcile and a `play_purchases` ledger feeding `entitlements`; 15% fee on subscriptions; India developers pay GST themselves; the package id must be fixed before billing.
- [Monetisation: Pro with Play Billing before production](issues/08-monetisation-timing.md): Pro visible and purchasable at production; billing ships as a closed-test fix build; gates kept (plans removed); ₹99/mo, ₹399/yr with a 7-day trial, ₹999 lifetime; no paywall in onboarding; direct Play Billing with Supabase verification (no RevenueCat); India only.
- [Home information architecture and tab structure](issues/05-home-ia-and-tabs.md): tabs Home · Transactions · (+) · Insights · More; Home = hero, then the Today strip, the 7-day chart, the recap card, recent transactions and bills; Insights absorbs Reports; More holds the rest, with Settings regrouped; the hero gets a skin slot for post-launch seasonal skins.
- [v1 scope for Plans, split sharing and multi-currency](issues/07-v1-scope-plans-splits-currency.md): Plans and collecting mode flagged off; the solo Splits core kept, invites flagged off; the currency picker hidden (INR default); PDF deferred; other secondary features kept; a one-tap no-spend day counts toward the streak.
- [Notification cadence and weekly recap](issues/06-notifications-and-weekly-recap.md): server push only; one 21:00 nudge if nothing was logged, backing off at 3 and 7 ignored days; no morning push; a Monday 09:00 rule-based recap (push and Home card); bill reminders kept; 3 toggles in Settings; the report-ready stream removed.
- [Design language direction: Ledger, not game; accents; System/Light/Dark](issues/04-design-language-direction.md): money screens ledger-calm and Koban only in character moments; lime used as a fill only; System/Light/Dark with no picker; Koban style A plus an optional lime scarf; a hard accessibility baseline; native headers, flat lists, 3 radii, a 6-step type ramp, lucide icons only.
- [Mascot: rough vector cat prototype](issues/16-mascot-vector-prototype.md): ginger tabby, flat 2D, standing two-legged, with tube limbs merged into a pear body; approved face and expression set; a movement library plus prop poses; code-based (react-native-svg + Reanimated). Outline or editorial treatment is left to ticket 04.
- [Onboarding target flow: 4-screen Google-first, anonymous-first?](issues/03-onboarding-target-flow.md): Google-first (email under Other options); opener → Google → first expense in the real Add sheet (skippable) → reminder ask → Home; tour becomes coach marks; cut screens deleted; anonymous-first goes post-launch.
- [Gamification scope: streak-only vs keep some economy](issues/02-gamification-scope.md): streak only, with auto-earned and auto-spent freezes (max 2) and milestones at 7/30/100/365; the economy is flagged off at build time in both builds, with no data touched; one moment queue (1 takeover per session).
- [Analytics: PostHog vs a Supabase events table under DPDP](issues/10-analytics-posthog-vs-events-table.md): first-party Supabase `events` table (user direction, no PostHog); opt-in, no amounts or merchants, behind a `lib/analytics.js` wrapper.
- [Supabase anonymous auth and Google identity linking](issues/11-anonymous-auth-google-linking.md): feasible, same user id; native Google ID token → `linkIdentity`; PKCE via expo-crypto polyfill; no merge if the Google account already exists.
- [Custom SMTP options for forgot-password](issues/12-custom-smtp-forgot-password.md): Resend on a cheap registered domain; reset by a 6-digit OTP code typed in-app, no deep link.
- [Crash reporting: Sentry vs expo-observe](issues/13-crash-reporting-sentry-vs-expo-observe.md): no third-party SDK (user direction); Play Android vitals for native crashes/ANRs plus an in-house root error boundary.

## Not yet specified

- **Play Console content:** the Data safety answers, the demo account for reviewers, the financial-features declaration label, content rating. Waits on [Privacy policy + account-deletion pages](issues/15-privacy-and-deletion-pages.md).
- **Closed-test recruitment and run:** how to find 15–20 testers, the Google Group, what testers are asked to do, and the fix-build cadence. Waits on [Safe closed-test build](issues/01-safe-closed-test-build.md).

## Out of scope

- **P0 safety fixes are handled outside this map** in their own session ("Fix split RLS holes and store-build default"):
  - lock the `split_members` UPDATE policy and add ownership checks on INSERT/UPDATE policies;
  - restrict `split_entry_shares` writes;
  - make auto-detect opt-in (`FLO_VARIANT === 'personal'`), make `production` the lite build, and remove `submit.full`;
  - delete the still-ACTIVE `ai-interpret` / `ai-report-summary` Edge Functions and their keys.

  They are already decided (audit §3, §8 items 1–2).
- **The seasonal card-skin Store and its admin portal:** the first feature after launch (decided in [Home IA](issues/05-home-ia-and-tabs.md)). v1 only builds the hero's skin slot.
- **The production rollout and post-launch work:** the staged rollout, iOS. These come after this map's destination.
