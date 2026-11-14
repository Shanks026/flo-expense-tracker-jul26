# Implementing the pre-launch audit with Matt Pocock's skills

**Purpose:** a run-book for a fresh Claude Code session. It turns `docs/flo-pre-launch-audit-2026-10.md` into shipped changes using the `mattpocock-skills` plugin (v1.3.1, installed at project scope in this repo), in the order the plugin's own `ask-matt` router prescribes.

**For the agent reading this:** confirm the plan with the user first (see "Start of session"). Then drive the flow yourself, step by step. Stop only at the confirmation points marked ⛔.

---

## Where things stand (updated 2026-11-03)

Read this before anything else. The ticket files are the source of truth: each has a `## Comments` log of what was checked and what's open.

### Working preferences the person set
- **Testing is on a physical phone now** (2026-10-27): a vivo I2220, Android 16, 3-button nav, over USB. The person checks screens themselves and reports what's wrong. The agent drives the phone with `adb` (screenshots, taps) only to reproduce or confirm what the person reported. Setup is under "Environment notes" below.
- **Emulator checks are still paused.** Don't drive the emulator unless the person asks. Verify through the Supabase MCP and code review instead, list any open emulator checks in the ticket, and leave `Verified` unticked.
- **Don't wait for the green signal.** Tick `Code implementation` (and `Verified` when true) yourself, tell the person in one line that a ticket is ready for green, and move on to the next ticket. The tracer mod refuses any Claude edit that ticks `Green signal` or sets `Status: resolved`. Don't bypass that guard.
- Still ask before every commit, push and Supabase migration (Step 6). Exception: when the person runs `/implement`, that skill's own instruction is to commit to the current branch, and the person accepted that for spec 38. Pushes and migrations still need a yes.

### Spec 32: safe closed-test build (`.scratch/safe-closed-test-build/`)
| Ticket | State | What's left |
|---|---|---|
| 01 billing flag, open Pro gates | Code ✓ Verified ✓ | Green signal (person) |
| 02 hide purchase surfaces | Code ✓ Verified ✓ | Green signal (person) |
| 03 remove dead ends / dev UI | Code ✓ | Google sign-in not exercised; release-build Settings rows (checked in 08) |
| 04 root error boundary | Code ✓ | Release build hides the error message (checked in 08) |
| 05 package id `app.floexpense.tracker` | Not started | Blocked on human console steps: both Firebase Android apps registered (combined `google-services.json`) and the FCM V1 key uploaded to EAS for both ids |
| 06 manifest and deps cleanup | Code ✓ | Profile-photo picking still works without CAMERA (emulator) |
| 07 EAS cloud builds that boot | Code ✓ | EAS env vars for preview and production, a cloud `lite-preview` build that boots and signs in, increasing version codes |
| 08 release-candidate check | Not started | Blocked by 01–07: lite AAB manifest check plus a full emulator walk on a release build |

### Spec 33: product analytics (`.scratch/product-analytics/`)
| Ticket | State | What's left |
|---|---|---|
| 01 consent-gated pipeline + `app_open` | Code ✓ Verified ✓ (`4a888c1`, `e3adf68`) | Green signal (person) |
| 04 dashboard views + 13-month retention | Code ✓ Verified ✓ via MCP (`e59b948`) | Green signal (person) |
| 02 offline queue | Code ✓ (`54065cb`) | Emulator: consent-off-while-queued, background-only flush, 500 limit, offline cold start using the cached consent |
| 03 opener opt-in + pre-sign-in queue | Code ✓ (`bd40923`), **revised `857fb27`** | The opt-in left the opener (see below); emulator check |

**Revised on the phone (2026-10-27, `857fb27`):** the opener's "Share anonymous usage" switch felt like a hurdle before sign-up. It's now asked once, as a moment on the queue (`components/ShareUsageAsk.js`), after the account's 3rd expense. Settings → Data & export keeps the switch. **Cost:** consent is off during onboarding, so `analytics.onboarding_funnel` and the pre-sign-in queue get almost no rows. Not yet seen on the phone: the popup after the 3rd expense.

### Spec 35: onboarding v3 (`.scratch/onboarding-v3/`)
| Ticket | State | What's left |
|---|---|---|
| 01 sign-up defaults | Code ✓ Verified ✓ (`0de90ee`) | Green signal (person) |
| 02 reminder ask finishes onboarding | Code ✓ (`88df5ad`) | Emulator check |
| 03 opener + Google-first sign-up | Code ✓ (`7dd0da4`) | Emulator check |
| 04 delete old onboarding | Code ✓ (`a647699`) | Emulator check |
| 05 first expense in the Add sheet | Code ✓ (`0392ea2`) | Emulator check |
| 06 coach marks | Code ✓ (`4791cc1`) | Emulator check |
| 07 funnel events | Code ✓ (`09ff619`) | Emulator check; mostly empty now that consent is asked later (spec 33 revision) |

**Revised on the phone (2026-10-27, `521d525`):** Google sign-in is parked, so sign-up is email only. The Google buttons are commented out on the opener and the sign-in screen; `signInWithGoogle` stays in AuthContext. The opener's main button is now "Create account". The person walked the onboarding screens on the phone.

### Spec 36: Add sheet 3-tap (`.scratch/add-sheet-3-tap/`)
| Ticket | State | What's left |
|---|---|---|
| 01 smart default category + 4×2 grid | Code ✓ (`21bd07c`) | Emulator check |
| 02 slim layout | Code ✓ (`f5413f3`) | Emulator check |
| 03 quiet save with Undo | Code ✓ (`1dffcc5`) | Emulator check; needs a rebuild for `expo-haptics` |
| 04 full `expense_logged` event | Code ✓ (`c5dcc91`) | Emulator check |

**Revised on the phone (2026-10-27, `b448848`):** the sheet went back to its earlier shape: Expense \| Income, then amount, then one swipeable category row, with date and Note always visible and no Details row. It now sizes to its content. Keyboard and edge-to-edge fixes: `adjustPan`, `topInset`, and nav-bar padding only while the keyboard is down. The smart default, decimal keypad and quiet save with Undo stay. Spec 36's "Revised after the first phone check" has the details. Not yet tried on the phone: saving an entry through the new sheet and the Undo toast.

### Spec 34: streak only (`.scratch/streak-only/`)
| Ticket | State | What's left |
|---|---|---|
| 01 `streak_marks` + reader, milestones 7/30/100/365 | Code ✓ (`49ed576`), table checked via MCP | Emulator check |
| 02 no-spend writes a mark | Code ✓ (`c207d54`) | Emulator check |
| 03 automatic freezes | Code ✓ (`b2c9729`) | Emulator check; confirm frozen days count toward earning |
| 07 simpler streak screen | Code ✓ (`22ab98f`) | Emulator check |
| 04 economy flagged off | Code ✓ (`41ea0d7`) | Emulator check. Accents and card themes are reachable again through spec 43 |
| 05 moment queue + bills-due | Code ✓ (`3f52991`) | Emulator check |
| 06 streak moments on the queue | Code ✓ (`ba9c4f0`) | Emulator check |

The person plans to wipe every Supabase user (including chrisaustin2001) and start fresh; they'll run `delete from auth.users;` themselves. The test accounts go with it, so the next emulator check needs a fresh one.

### Spec 37: design system and Koban (`.scratch/design-system-and-koban/`)
| Ticket | State | What's left |
|---|---|---|
| 01 Appearance System/Light/Dark | Code ✓ (`e2404b2`), migration applied | Native rebuild, then emulator check |
| 02 accessible colour tokens | Code ✓ (`509b490`) | Emulator check; follow-up for danger/warn/streak text contrast |
| 03 no static light colours (onboarding follows the theme too) | Code ✓ (`6f55d1d`) | Dark-mode emulator pass |
| 04 shared components + Settings | Code ✓ (`07b5668`) | TalkBack / large font / 48 dp check |
| 05 native headers | Code ✓ (`67f80a5`) | Emulator check |
| 06 calm feedback | Code ✓ (`95e8502`) | Emulator check |
| 07 retire 3D art | Code ✓ (`421584a`) | Emulator check |
| 08 Koban component | Code ✓ (`cf0faf9`) | Gallery on the device |
| 09 Koban moods | Code ✓ (`573b27b`) | Gallery on the device |
| 10 Koban poses | Code ✓ (`59fda09`) | Gallery on the device |
| 11 Koban placements | Code ✓ (`9f2387c`) | Each placement on the device |

Koban's art is a placeholder; the person will replace `components/koban/{art,faces,poses}.js` with animated illustrations.

**Cards are borderless (2026-10-27, `0281740`):** `Card`'s default variant has no border; the danger, warn and completed outlines stay. Four hand-built cards lost the same border.

### Spec 43: themes back, unlocked (`.scratch/themes-back-unlocked/`)
Built on 2026-10-27 after the person's friends liked the card themes. It partly reverses spec 37.

| Ticket | State | What's left |
|---|---|---|
| 01 card themes back, all unlocked | Code ✓ (`6e57964`) | Phone: equip a design, see it on Home, relaunch |
| 02 accent colours back | Code ✓ (`6e57964`) | Phone: equip an accent, relaunch, sign out and in |
| Phase 1b Christmas card | Code ✓, checked on the phone (`081a084`) | Nothing |

- **Flags:** `FLAGS.themes` (on) brings back Personalize, all ~50 card designs and every accent, apart from the economy. `FLAGS.themeGating` (off) makes every theme owned. Coins, the Shop and trophies stay off.
- **Appearance:** Settings keeps System/Light/Dark; Personalize no longer has a mode toggle.
- **Christmas card:** the first illustrated, animated skin.
  - It's built from SVG layers in `lib/cardScenes.js`, generated from `.scratch/skin-samples/christmas-card.svg` by `gen-card-scenes.js`.
  - `components/AnimatedCardScene.js` animates it with Reanimated. Each play is about 5 seconds and replays whenever Home regains focus; nothing moves with Reduce motion.
  - Themes can set `negativeColor` (Christmas uses `#FF8F8F`).
  - Rules for any new skin: text stays in the left two-thirds, and the art and anything bright go in the right third.
- **Gating (Phase 2, not scheduled):** streak-milestone unlocks first, then Pro unlocks everything once Play Billing ships, then paid seasonal skins. No coins.
- **Known contrast risk:** spec 37 found 13 accents fail 3:1, and that's accepted for now.

### Spec 38: Home, Insights and More (`.scratch/home-insights-more/`)
Built in one session with `/to-tickets` then `/implement`. That skill commits to the current branch, so these commits went to `master` without a per-commit ask. All are local, none pushed. The spec's "As built" section has the details.

| Ticket | State | What's left |
|---|---|---|
| 01 Plans flagged off | Code ✓ (`1fbd606`) | Emulator check; flag-on restores Plans |
| 02 split invites + currency picker flagged off | Code ✓ (`1fbd606`) | Emulator: feature 31's settling checklist; a new account is INR (MCP) |
| 04 budget warnings in the bell | Code ✓ (`1fbd606`) | Emulator check |
| 03 five tabs + More | Code ✓ (`96980a5`) | Emulator check; `feature_opened` rows land (MCP, consent on) |
| 05 Accounts screen + transfers | Code ✓ (`e057ebd`) | Emulator: 1 vs 2 accounts; both transfer legs (MCP) |
| 06 Home header + hero skin slot | Code ✓ (`eb800ba`), **revised `31b99ae`, `175ae2b`** | The old account card is back (see below); phone: 2 accounts, light mode |
| 07 Insights with Reports folded in | Code ✓ (`42b2a0b`, fix `607b8b4`) | Emulator: three modes, Week from Home, export |
| 08 Home body | Code ✓ (`87cf227`, fix `607b8b4`), **revised `31b99ae`, `175ae2b`** | Today strip replaced by `NothingLoggedCard` (see below); phone: a day with nothing logged, the No spend tap (MCP: the `streak_marks` row) |
| 09 Settings regrouped | Code ✓ (`4d4a768`) | Emulator: section order, release build hides Developer, export |
| 10 recap card + summary | Not started | Blocked by spec 39's recap data |

**Code review:** run over `feb4454..HEAD`. Three bugs were fixed in `607b8b4`. Five cleanups were skipped; they're listed in the spec's "As built" section.

**Open decisions for the person:**
- **The report push.** `send-push` still sends "Your weekly report is ready" to every profile with reports on (new sign-ups default to weekly), and Settings no longer has a control to stop it. `/report` redirects to Insights. Replace it with spec 39's recap push, or switch it off sooner.
- **The privacy policy URL.** The About row is hidden until `lib/about.js` → `PRIVACY_POLICY_URL` is set.

### First phone check (2026-10-27)
The person ran the app on their own phone for the first time, changed some Home and Add sheet decisions, and found layout bugs. Commits `64965d3`..`175ae2b` are on `master`, not pushed. Specs 36 and 38 each have a "Revised after the first phone check" section with the details.

- **Home (spec 38, person's call):**
  - The old `AccountHeroCarousel` is back (In Hand, Income, Expenses; swipes between accounts) in place of `HomeHero`.
    - It uses `colors.emphasisBg`, so in dark mode it matches the other cards.
    - A negative balance is fully red.
    - The dots sit evenly, and the loading skeleton matches the card's height.
  - The header shows the full date ("October 27, 2026").
  - The Today strip and its + Log are gone. `NothingLoggedCard` shows only while today is open. Its one action is No spend today (with a confirm), and Koban stands on its bottom edge.
  - **The hero skin slot went with `HomeHero`.** When the seasonal Store is built, put skins through `CardThemeSurface` and add the fixed-contrast plate there.
- **Add sheet (spec 36, person's call):** the earlier shape, keeping 3-tap logging; see the spec 36 note above.
- **Empty states:** `components/EmptyState.js` (Koban in a pose, a title, one line) is used on:
  - Home recent
  - Transactions
  - Insights' "Where it went"
  - Bills
  - Budgets
  - Splits
  - the alerts sheet

  Use it for any new whole-list empty state.
- **Android edge-to-edge bugs fixed:**
  - The Add sheet's Save sat under the nav bar.
  - The coach mark ring sat one status bar above the + button. It now measures with `measure`, not `measureInWindow`.
  - The keyboard covered the sheet.
  - The category row didn't swipe. It now uses Gesture Handler's `ScrollView` inside sheets.

  **Watch for the same patterns elsewhere:**
  - any `measureInWindow`
  - any bottom-sheet footer without `insets.bottom`
  - any `android_keyboardInputMode="adjustResize"`
  - any plain RN `ScrollView` nested in a sheet
- **Build fix:** `modules/flo-notification-listener/android/build.gradle` uses the `expo-module-gradle-plugin` form. The legacy `apply from` fails on Gradle 8.14 (same as the `expo-share-intent` patch).
- **Still to check on the phone:**
  - saving through the new Add sheet, and its Undo toast
  - `NothingLoggedCard` on a day with nothing logged, and the No spend tap
  - the Home, Transactions and Insights empty states, which need an account with no transactions
  - light mode
  - 2+ accounts (the account switcher on the card)
- **Accent colours** are back through Personalize (spec 43), which settles the earlier open decision.

### Spec 39: nudge and weekly recap (`.scratch/nudge-and-weekly-recap/`)
Ticketed on 2026-11-03 with `/to-tickets`. Nothing is built yet. The person will implement it in a new session.

| Ticket | Blocked by | What it delivers |
|---|---|---|
| 01 one evening nudge | — | No morning or report-ready push; no nudge after a no-spend mark; a nudge tap opens the Add sheet; leftover local notifications cleared; `nudge_opened` |
| 02 Settings: three toggles | — | Daily nudge (with a time), Weekly recap, Bill reminders; new `profiles.weekly_recap_enabled` (migration); bills default to 1 day before |
| 03 nudge back-off | 01 | Every other day after 3 ignored nudges, none after 7, daily again after a log or no-spend mark |
| 04 streak in the nudge copy | 01 | Server-side streak count; the copy names it from 2 days up; milestone tier 7/30/100/365 |
| 05 recap data + recap screen | — | A pure week/month recap module; a recap route with Koban's `report` pose; a temporary Insights entry; `recap_viewed` |
| 06 weekly recap push | 02, 04, 05 | `weekly_recap` on Monday 09:00 local, claimed once per ISO week; a tap opens the recap screen |
| 07 on-device check | 01–06 | The spec's device checks plus feature 17's 14 open ones; builds nothing |

- **Ready to start:** 01, 02 and 05.
- **Settles:** ticket 01 removes the report push (an open decision under spec 38).
- **Spec 38 ticket 10** (the Home recap card and the Insights summary) waits on spec 39 ticket 05. Its "Blocked by" line still says "spec 39's recap data".
- **Needs a yes first:** the migration in 02 and every `send-push` deploy (01, 03, 04, 06).

### Direction change (2026-11-08): personal use first, AI is the priority
The person reversed the "no AI" rule. FLO is now **a personal-use app first**, built for quick, accurate results and a much better UX for the author; **the store launch comes later**. The rule changes are recorded in `00-index.md` (standing rule "AI is back") and `AGENTS.md`, and `CLAUDE.md` allows OpenRouter as the one third-party service.

**Roadmap (2026-11-08).** Spec 44 is written: `.claude/features/archive/44-ai-assistant.md`. Work top to bottom.

**Stage 0: chores to clear before any AI code** (✋ = the person does it, or must say yes first)
1. ✋ **Commit what's uncommitted:** these docs, `CLAUDE.md`, `AGENTS.md`, spec 44, and the `flo-ticket-tracker/` mod at the repo root. Decide whether the mod belongs in the repo or in `.gitignore`.
2. ✅ **Supabase MCP permission (done 2026-11-08).** The sign-in had expired, and the first re-sign-in approved the wrong organization ("Austin's Org"). It now works for FLO. If it fails again, sign in through `/mcp` and pick FLO's organization.
3. ◐ **Old AI leftovers.** ✅ `ai-interpret` and `ai-report-summary` were deleted with the CLI on 2026-11-08; only `send-push` remains. ✅ The person removed the `GEMINI_API_KEY` secret (confirmed gone from `secrets list`). Still to do, by the person:
   - revoke the old Gemini key at Google AI Studio and the old OpenRouter key (the `OPENROUTER_API_KEY` secret from 2026-08-06; setting the new key under the same name replaces the secret).

   Original list:
   - the `ai-interpret` and `ai-report-summary` Edge Functions are still deployed (Dashboard → Edge Functions → delete, or `supabase functions delete <slug>`);
   - delete their secrets, and revoke the old provider (Gemini) keys at the provider.
4. ✅ **Data wipe (done 2026-11-08).** The person ran `delete from auth.users where email <> 'chrisaustin2001@gmail.com'` in the SQL editor; the MCP's own confirmation auto-declined it twice. 7 accounts went: abishek230102, chrisaustin11109, sachinsachi7395, sachin, flotest, testtwo and testoncemore. Every user table, `storage.objects` and `auth.identities`/`sessions` were checked: 0 rows from other users remain. What's left is the person's real account: 358 transactions, 3 accounts, 3 budgets, 1 split. **There's no test account now**; make a fresh one for emulator checks (CLAUDE.md: random email, skip the email link).

   Original note: The plan was to run `delete from auth.users;`. FLO is now personal-use, so either wipe **once, now** and keep your real account from here on, or cancel the wipe. Test accounts stay separate either way.
5. ✋ **Set up OpenRouter:**
   - buy credits (UPI);
   - create a key with a **credit limit** for FLO;
   - turn off prompt logging and training in the account's privacy settings;
   - then `supabase secrets set OPENROUTER_API_KEY=… AI_MODEL_QUICK=anthropic/claude-haiku-5.5 AI_MODEL_CHAT=anthropic/claude-haiku-5.5 AI_MODEL_FALLBACK=google/gemini-3.1-flash-lite`.

   The agent never handles the key. The `wizard` skill can generate a step-by-step walkthrough for this.

**Stage 0b: cleanup found on 2026-11-08 (before any AI code)**
- ✅ `node_modules` was missing entirely; reinstalled with `npm ci` (832 packages, expo 54.0.37). `expo export --platform android` bundles all 4,185 modules cleanly.
- ✅ No AI leftovers in the code (grep for ai-interpret, aiReportSummary, receipt_*, ai_usage, GEMINI, openrouter: nothing).
- ✅ `supabase/.temp/` (the CLI's linked-project cache) added to `.gitignore`.
- ✅ The security advisor shows only the accepted WARNs (`pg_net` in public; 5 intentional SECURITY DEFINER RPCs; leaked-password protection off).
- ✅ **RLS holes fixed (2026-11-08)** by `rls_hardening_ownership_and_splits` (see the `00-index.md` migrations row). It was applied through the CLI because the MCP auto-declines writes. 12 rolled-back checks pass. Original finding:
  - the `split_members` UPDATE policy lets a member edit their own row (role, `split_id`);
  - the INSERT/UPDATE policies on `transactions`, `budgets`, `plans` and `bills` check `user_id` but not that `account_id`/`category_id`/`plan_id` are the user's own;
  - the `split_entry_shares` INSERT only checks that *some* entry exists.

  There's zero exposure with one user, but `ai-assistant` runs as the user and leans on RLS, so fix it in one migration first (SQL in audit §3; show it and get a yes).
- ✋ **The "weekly report ready" push** still goes out (`send-push`), and nothing in Settings stops it. Either switch it off for the profile now or do spec 39 ticket 01 first.
- **Tools:** the Supabase MCP and the CLI are both signed in to FLO's org. Use the MCP for SQL and advisors; use the CLI (`npx supabase … --project-ref uergtlcfpwajztqgncim`, `db query --read-only`) for functions and secrets. Writes need the person's yes, and the CLI needs `--yes` after it.

**Stage 1: checks to clear first, because AI fills the Add sheet**
6. ✋ **Boot the emulator** (`Pixel_API_36`, never booted yet), install a fresh dev build, set `debug_http_host` / `adb reverse`, and make a test account. It's on hold until the person says go.
7. **Add sheet checks** on the phone or emulator: saving through the sheet, the Undo toast, a prefilled open (share-to-FLO text), and the keyboard not covering Save. Spec 44 phase 1 builds on exactly this path, so it has to be solid first.
   - The other open phone checks can be batched later; they don't block AI: `NothingLoggedCard`, empty states, light mode, 2+ accounts, card theme and accent relaunch, and the share-usage popup.

**Stage 2: build spec 44** (`/to-tickets` on the spec, then `/implement` per ticket)
8. **Phase 1, typed quick add:** the `ai_usage` migration (yes first), the `ai-assistant` function deploy (yes first), `lib/quickParse.js`, `QuickAddField`, and the `app/dev/ai-eval.js` test set. **Gate:** ≥ 90% correct, p50 ≤ 1.5 s, at least half the phrases answered by the local parser. If it fails, stop and decide before phase 2.
9. **Phase 2, voice:** a new native dependency (`expo-speech-recognition`; name it to the person first), then prebuild and a native rebuild.
10. **Phase 3, chat (read only):** the `ai_conversations` / `ai_messages` migration (yes first) and six server-side tools. Every number is checked against Insights.
11. **Phase 4, chat proposals:** transaction, budget and bill cards that open pre-filled sheets. The model never writes.

**Stage 3: after or alongside spec 44**
12. **Spec 39** (one evening nudge + weekly recap). It can start once spec 44 phase 1 is green; its tickets are unchanged. Spec 38 ticket 10 still waits on spec 39 ticket 05.
13. **Spec 40** (share-to-FLO import). Its merchant memory can feed `quickParse`'s synonyms.

**Parked until launch planning:**
- spec 44 phase 5 (consent, privacy, Pro, caps);
- spec 32's remaining store-build tickets (05, 07, 08);
- the 12-tester closed test;
- the privacy policy URL;
- spec 41 (Play Billing);
- spec 42 (forgot password).

Auto-detect stays in the personal build as it is.

**Earlier draft of this list (superseded by the roadmap above):**
1. **Spec 44: AI assistant (OpenRouter).** Not written yet; next free number. Write it with `/to-spec` (or the flo-feature skill), then `/to-tickets`. Scope:
   - typed and voice quick add ("40 rupees for lunch today" → a pre-filled Add sheet; on-device speech-to-text, en-IN + Hindi);
   - a chat that answers questions about transactions, accounts and budgets, with numbers from server-side SQL tools;
   - write actions (a transaction, a budget, a bill) as confirm cards that call the existing `lib/*.js` mutations.

   The flow:
   - one Edge Function, `ai-assistant`, holds the key as a secret;
   - new tables `ai_conversations`, `ai_messages` and `ai_usage`;
   - the model name is a secret, so it can change without a release;
   - starting models: a Gemini Flash-class model, with Claude Haiku 5.5 as the fallback for chat tool use. Check current OpenRouter model ids and prices when writing the spec.

   **Phases:**
   - 0: spec;
   - 1: function + typed quick add, gated by a test set of about 40 real phrasings (≥90% correct, p50 under ~1.5 s);
   - 2: voice (new dev build);
   - 3: chat, read only;
   - 4: chat write actions;
   - 5: privacy, consent and Pro (only at launch planning).
2. **Spec 39** (one evening nudge + weekly recap) after or alongside spec 44 phase 1; its tickets are unchanged. Spec 38 ticket 10 still waits on spec 39 ticket 05.
3. **Parked until launch planning:**
   - spec 32's remaining store-build tickets (05 package id, 07 EAS envs, 08 release candidate);
   - the 12-tester closed test;
   - the privacy policy URL;
   - spec 41 (Play Billing);
   - spec 42 (forgot password).

   Spec 40 (share-to-FLO import) stays useful for personal use, and spec 44's quick-add parser can share its merchant memory.
4. **Auto-detect** (notification listener) stays in the personal build as it is. It's still never store-hardened.

**Earlier next step (before the direction change):** implement spec 39 in a new session; the person asked for it to be done there. First ask whether they want to finish the open phone checks:
- the ones under "First phone check" above;
- the share-usage popup after the 3rd expense (spec 33);
- equipping a card theme and an accent, then relaunching (spec 43).

Then work spec 39's tickets in order, starting with the frontier (01, 02, 05):

```
/mattpocock-skills:implement .scratch/nudge-and-weekly-recap/issues/01-one-evening-nudge.md
```

Once spec 39 ticket 05 is done, build spec 38 ticket 10. After that come spec 40 (share-to-FLO import with merchant memory, which also gives Home rows merchant titles), 41 (Pro with Play Billing) and 42 (forgot password, blocked on a domain).

Live Supabase now has:
- `events` (insert-only RLS, consent-gated);
- `profiles.analytics_consent` and `analytics_consent_changed_at`;
- a private `analytics` schema with 10 views;
- the pg_cron job `events-retention`.

Details are in `00-index.md` (schema and migrations) and the spec's "As built" notes.

### Environment notes (this machine)
- **Physical phone (vivo I2220, serial `10BDC910EA00059`):**
  - **USB debugging:** on, with "USB debugging (Security settings)" and "Install via USB" also on in Developer options. If Windows lists only an "MTP USB Device", debugging isn't on or wasn't accepted.
  - **Metro:** `CI=1 npx expo start --dev-client --port 8084` (add `-c` to clear its cache).
  - **Tunnel:** `adb -s 10BDC910EA00059 reverse tcp:8084 tcp:8084`.
  - **Dev server address:** the app's `debug_http_host` is set to `localhost:8084` in `shared_prefs/com.anonymous.flo_preferences.xml` (via `run-as`). Without it the app tries 8081, which belongs to McAfee.
  - **Reloading:** restart Metro after every code change, since CI mode has no watch. Then `am force-stop com.anonymous.flo` and relaunch.
  - **Native rebuild:** `npx expo run:android --device I2220 --no-bundler`. `--device` takes the model name, not the serial, and `--port` can't be combined with `--no-bundler`. A full build takes about 20 minutes.
  - **Prebuild:** `android/` was regenerated with prebuild on 2026-10-27 and includes `expo-haptics`. Stop Metro before `expo prebuild --clean`, because a running Metro locks `android/`.
  - **Signed-in account:** the account on the phone has one ₹3,500 Food expense logged on 2026-10-27.
  - **Coach marks:** the "seen" flags live in the app's `databases/RKStorage` (`flo.coachMark.<id>.<userId>`). To show one again, copy the file out with `run-as … cat`, delete the key with `node --experimental-sqlite`, and copy it back.
  - **The phone sleeps during long sequences.** Send `input keyevent 224` first. The dev-only "Unable to activate keep awake" toast after a sleep is harmless.
  - **Stopping a Metro task can leave its `node` process listening.** Free the port with `Get-NetTCPConnection -LocalPort 8084` → `Stop-Process`.
- **Emulator (recreated 2026-11-08):** the old Medium_Phone_API_29 AVD and its image were gone, so the emulator is now **`Pixel_API_36`**: Android 16 (`system-images/android-36/google_apis/x86_64`), Pixel profile, AVD files on `D:\Android\avd\Pixel_API_36.avd`.
  - **C: is nearly full** (it hit 0 GB during the first unpack). So the SDK's `system-images` and `.sdk` (the `android` CLI's download cache) are **directory junctions to `D:\Android\system-images` and `D:\Android\sdk-cache`**. Anything large for the SDK should go to D: the same way.
  - **`android sdk install` downloads through the junction but fails to unpack** ("Failed to extract package archive"). The Android 16 image was unpacked by hand: check the zip in `D:\Android\sdk-cache\arch\<sha1>` against Google's SHA-1 (the filename), then `unzip` it into `D:\Android\system-images\android-36\google_apis\`. The AVD was made with `avdmanager create avd -n Pixel_API_36 -k "system-images;android-36;google_apis;x86_64" -d pixel_7 -p D:\Android\avd\Pixel_API_36.avd`, and then `config.ini` was edited: the `disk.dataPartition.path=<temp>` line dropped, and GPU and keyboard set to yes.
  - **SDK tools:** `cmdline-tools\latest` was installed the same day. Its `sdkmanager.bat` now wraps the new `android` CLI; `cmd` splits `;` package names, so install with `android.exe sdk install system-images/android-36/google_apis/x86_64`. Set `JAVA_HOME` to `C:\Program Files\Android\Android Studio\jbr` first.
  - It is a fresh device: no FLO build, no `debug_http_host`, no `adb reverse`, and no signed-in account. Redo those, and the "Allow restricted settings" step, on its first use.
  - **RAM:** only ~1.3 GB was free at the last check; close apps before starting it.
- **Metro:**
  - Watch mode fails to start (file-watcher timeout), so run `CI=1 npx expo start --dev-client --port 8082` and restart it after every code change.
  - Port 8081 belongs to McAfee.
- **Bundle downloads:**
  - Over `10.0.2.2:8082` the download breaks intermittently (`ProtocolException: Expected leading [0-9a-fA-F] character`).
  - Fix: `adb reverse tcp:8082 tcp:8082` with `debug_http_host` set to `localhost:8082` in the app's shared prefs. This is already set on the emulator, and the tunnel survives the emulator's wifi being off.
- **adb:** calls can hang for minutes. Run long emulator sequences in the background and wait on a marker line.
- **Test account:** the old API 29 emulator was signed in as `testtwo@gmail.com`; that device is gone, so the new emulator needs a fresh test account.
- **Agent shell quirks:**
  - The Bash tool fails on a heredoc whose body contains an apostrophe ("unexpected EOF while looking for matching `''"). Write such files with the Write tool instead.
  - There's no `python` on this machine; use `node` for scripted edits.
- **Cheap checks without the emulator:** `npx expo export --platform android --output-dir <scratch dir>` bundles the whole app and catches unresolved imports and syntax errors in about a minute. It is not a substitute for the emulator check.

---

## Start of session (agent)

1. Read this file, `AGENTS.md`, `.claude/features/00-index.md` (its standing rules) and §0 + §8 of the audit doc. Read nothing else up front.
2. Check `git status`. If the tree isn't clean, show the user what's dirty and ask whether to commit or discard it before starting ⛔.
   - At the time of writing, two files were dirty:
     - `.claude/features/archive/17-server-push-notifications.md`: two Phase 4 boxes ticked after the emulator test;
     - `CLAUDE.md`: an edit by the user.
3. Show the user the step list below and the current step. Ask: **"Start at step N?"** ⛔ Continue only on a yes.

## Who presses what

Most flow skills in this plugin are **user-invoked only** (`disable-model-invocation: true`). The agent cannot start them with the Skill tool:

| User types it | Agent can invoke it itself |
|---|---|
| `/setup-matt-pocock-skills`, `/wayfinder`, `/to-spec`, `/to-tickets`, `/implement`, `/implement-spec`, `/retro`, `/grill-with-docs`, `/ask-matt` | `grilling`, `domain-modeling`, `research`, `prototype`, `tdd`, `code-review`, `codebase-design`, `diagnosing-bugs`, `pr`, `wizard` |

So "the agent carries out the flow" means:
- at each step, the agent tells the user the **exact command to type**, as one line in a code block;
- once the user types it, the agent drives everything inside that step, including every model-invocable skill it calls;
- the agent never asks the user to remember what comes next.

**Fallback:** if the user explicitly says "follow it yourself", the agent may read the skill's `SKILL.md` from `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/<area>/<name>/SKILL.md` and follow it exactly as written.

---

## The order

### Parallel track: P0 safety fixes (outside the map)

These are already decided and well-scoped. Run them **alongside** step 2, in their own session. Don't put them on the wayfinder map.

- Lock the `split_members` UPDATE policy: a member can make themselves organizer or move into another split.
- Add ownership checks to the INSERT/UPDATE policies on transactions, plans, budgets, bills and splits. Restrict `split_entry_shares` writes.
- Make auto-detect opt-in in `app.config.js` (`FLO_VARIANT === 'personal'`), make `production` the lite build, and remove `submit.full`.

Done when the migrations are applied (SQL shown to the user first ⛔), verified as two different users, advisors are clean, and the docs are updated. A session card titled "Fix split RLS holes and store-build default" was proposed for this. The SQL is in audit §3.

### Step 1: Setup (once)
`/setup-matt-pocock-skills`
- **Issue tracker:** recommend **GitHub Issues** (remote `Shanks026/flo-expense-tracker-jul26`). Wayfinder renders its frontier through native blocking links. Check that `gh auth status` works first; fall back to local markdown (`.scratch/`) if it doesn't.
- **Triage labels:** keep the defaults.
- **Domain docs:** single-context. `GLOSSARY.md` + `docs/adr/` at the repo root.
- **Reconcile with flo-feature:** when the skill writes its `## Agent skills` section into `AGENTS.md`, add one line: *"Specs produced by `/to-spec` are written as `.claude/features/NN-<slug>.md` in the flo-feature template; the flo-feature rule (planning doc before feature code) is satisfied by that file."* Show the edit before writing it ⛔.

Commit the setup output.

### Step 2: Chart the map (one session; resolves nothing)
`/wayfinder`, with the loose idea: *"Implement docs/flo-pre-launch-audit-2026-10.md: reset FLO to a lean, retention-first v1 and get it through Play's closed test into production."*

- **Destination (proposed; confirm in grilling):** "Every v1 scope, UX and design decision in the audit is settled. Each area has a buildable spec ready for `/to-spec`, and the launch-plumbing tasks are done or assigned."
- **Map Notes:**
  - Consult the `domain-modeling` and `grilling` skills, plus the Expo skills (expo-design-system, expo-animation, eas-app-stores).
  - Standing rules: **no AI features**; auto-detect is personal-use only and is never hardened.
  - The audit's "decisions" table is a *proposal*, not a decision: every row gets grilled.
- **Likely first tickets** (the agent proposes them; the user confirms):

  | Type | Ticket |
  |---|---|
  | grilling | Gamification scope (streak-only vs keep some economy) |
  | grilling | Onboarding target flow (4-screen Google-first; anonymous-first?) |
  | grilling | Design language direction ("Ledger, not game"; accents; System/Light/Dark) |
  | grilling | Home information architecture + tab structure (Insights, More) |
  | grilling | Notification cadence + weekly recap |
  | grilling | v1 scope for Plans and split sharing |
  | grilling | Monetisation timing (hide Pro in v1; RevenueCat later) |
  | research | PostHog vs a Supabase `events` table for analytics under DPDP |
  | research | Supabase anonymous auth + Google identity linking |
  | research | Custom SMTP options for forgot-password |
  | task | Permanent package id + Firebase re-registration |
  | task | Privacy policy + account-deletion pages |
  | task | Mascot vector model sheet (who draws it) |

- Fire the research tickets as subagents, as the skill says.
- ⛔ Stop at the end of charting and show the map.

### Step 3: Work the map (repeat; one ticket per session, research excepted)
`/wayfinder <map URL>`
- The agent takes the first frontier ticket, claims it, resolves it, records the resolution comment, and updates Decisions-so-far.
- Grilling tickets are **HITL**. The agent asks; the user decides. The agent never answers its own questions.
- Between tickets: `/clear` (or a new session). Repeat until the frontier is empty and Not-yet-specified is cleared.
- ⛔ Confirm with the user that the map is clear before step 4.

### Step 4: Spec (one unbroken session with step 5)
`/to-spec`. Point it at the closed map.
- Expect several specs, one per area: onboarding, Add sheet + Home, gamification removal, theming/design tokens, notifications/recap, analytics, share-import, mascot.
- Each spec is written as `.claude/features/NN-<slug>.md` (next free numbers after 31) and indexed in `00-index.md`.
- ⛔ The user approves each spec.

### Step 5: Tickets (same session as step 4)
`/to-tickets`. Run it per spec.
- Tracer-bullet tickets with blocking edges on the tracker.
- Order across specs:
  1. analytics (so the reset is measurable);
  2. onboarding + Add sheet;
  3. gamification flags off;
  4. theming/Home;
  5. notifications/recap;
  6. share-import;
  7. mascot.

### Step 6: Build
- Pick `/implement <ticket>` per ticket (with `/clear` between tickets) **or** `/implement-spec` per spec (parallel implementers on one integration branch). Recommend `/implement` for UI-heavy specs and `/implement-spec` for mechanical ones (gamification flags, tokens).
- Each ticket: `tdd` where logic is testable (FLO has no test runner, so the tracer-bullet check is running the app; see Verification), then `code-review`.
- ⛔ Ask the user before every commit and push, and before any Supabase migration or Edge Function deploy.

### Step 7: Close the loop
`/retro` at the end of each spec's build, in that session.

### Launch plumbing (alongside steps 3–6, from the audit's §6 launch sequence)
- The package id, EAS env vars, privacy and deletion pages, Sentry/expo-observe and the root error boundary.
- **Start the 12-tester × 14-day closed test as soon as a lite AAB exists.** It is the longest lead time.
- Use `wizard` for human-only console steps (Play Console, Firebase, EAS secrets).

---

## FLO-specific rules for every step

- **Verification:** there is no test or lint runner. Verify on the **Pixel_API_36** emulator (Android 16) with the test account; the user signs in, and the agent never handles passwords. Drive the emulator with `adb` from PowerShell. The installed APK predates these changes, so rebuild (`npx expo run:android`, or a `lite-preview` build) before verifying client changes.
- **Schema truth** is the live Supabase project `uergtlcfpwajztqgncim` via the Supabase MCP. Follow the 00-index standing rules: `user_id DEFAULT auth.uid()`, cascade FKs, `security_invoker` on views.
- **Cut ≠ delete.** For v1, feature-flag gamification, Plans and split invites off and keep the code and data. Delete only after analytics confirm.
- **Docs:** each finished spec updates its `.claude/features` doc and the `00-index.md` row.

## Kickoff prompt for the new session

> Read `docs/matt-implement-flo.md` and follow it. Confirm with me before starting, then drive the flow yourself.
