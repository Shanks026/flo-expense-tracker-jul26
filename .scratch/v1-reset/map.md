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

- [Mascot: rough vector cat prototype](issues/16-mascot-vector-prototype.md): ginger tabby, flat 2D, standing two-legged, with tube limbs merged into a pear body; approved face and expression set; a movement library plus prop poses; code-based (react-native-svg + Reanimated). Outline or editorial treatment is left to ticket 04.
- [Onboarding target flow: 4-screen Google-first, anonymous-first?](issues/03-onboarding-target-flow.md): Google-first (email under Other options); opener → Google → first expense in the real Add sheet (skippable) → reminder ask → Home; tour becomes coach marks; cut screens deleted; anonymous-first goes post-launch.
- [Gamification scope: streak-only vs keep some economy](issues/02-gamification-scope.md): streak only, with auto-earned and auto-spent freezes (max 2) and milestones at 7/30/100/365; the economy is flagged off at build time in both builds, with no data touched; one moment queue (1 takeover per session).
- [Analytics: PostHog vs a Supabase events table under DPDP](issues/10-analytics-posthog-vs-events-table.md): first-party Supabase `events` table (user direction, no PostHog); opt-in, no amounts or merchants, behind a `lib/analytics.js` wrapper.
- [Supabase anonymous auth and Google identity linking](issues/11-anonymous-auth-google-linking.md): feasible, same user id; native Google ID token → `linkIdentity`; PKCE via expo-crypto polyfill; no merge if the Google account already exists.
- [Custom SMTP options for forgot-password](issues/12-custom-smtp-forgot-password.md): Resend on a cheap registered domain; reset by a 6-digit OTP code typed in-app, no deep link.
- [Crash reporting: Sentry vs expo-observe](issues/13-crash-reporting-sentry-vs-expo-observe.md): no third-party SDK (user direction); Play Android vitals for native crashes/ANRs plus an in-house root error boundary.

## Not yet specified

- **Add-sheet speed design:** smart default category, the top-8 grid, the pinned Save, and how the first expense in onboarding uses the real sheet. Waits on [Gamification scope](issues/02-gamification-scope.md) and [Design language direction](issues/04-design-language-direction.md).
- **Play Console content:** the Data safety answers, the demo account for reviewers, the financial-features declaration label, content rating. Waits on [Privacy policy + account-deletion pages](issues/15-privacy-and-deletion-pages.md).
- **Closed-test recruitment and run:** how to find 15–20 testers, the Google Group, what testers are asked to do, and the fix-build cadence. Waits on [Safe closed-test build](issues/01-safe-closed-test-build.md).
- **Post-launch backlog boundary:** what is explicitly v1.1 (RevenueCat, re-enabling Plans/invites, anonymous-first sign-up, widget, EAS Update, SDK upgrade). Waits on [v1 scope for Plans, splits, multi-currency](issues/07-v1-scope-plans-splits-currency.md) and [Monetisation timing](issues/08-monetisation-timing.md).

## Out of scope

- **P0 safety fixes are handled outside this map** in their own session ("Fix split RLS holes and store-build default"):
  - lock the `split_members` UPDATE policy and add ownership checks on INSERT/UPDATE policies;
  - restrict `split_entry_shares` writes;
  - make auto-detect opt-in (`FLO_VARIANT === 'personal'`), make `production` the lite build, and remove `submit.full`;
  - delete the still-ACTIVE `ai-interpret` / `ai-report-summary` Edge Functions and their keys.

  They are already decided (audit §3, §8 items 1–2).
- **The production rollout and post-launch work:** the staged rollout, RevenueCat/Play Billing, iOS. These come after this map's destination.
