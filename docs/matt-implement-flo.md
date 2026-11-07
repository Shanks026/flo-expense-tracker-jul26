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

### Next step
Implement spec 39 in a new session; the person asked for it to be done there. First ask whether they want to finish the open phone checks:
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
- **Metro:**
  - Watch mode fails to start (file-watcher timeout), so run `CI=1 npx expo start --dev-client --port 8082` and restart it after every code change.
  - Port 8081 belongs to McAfee.
- **Bundle downloads:**
  - Over `10.0.2.2:8082` the download breaks intermittently (`ProtocolException: Expected leading [0-9a-fA-F] character`).
  - Fix: `adb reverse tcp:8082 tcp:8082` with `debug_http_host` set to `localhost:8082` in the app's shared prefs. This is already set on the emulator, and the tunnel survives the emulator's wifi being off.
- **adb:** calls can hang for minutes. Run long emulator sequences in the background and wait on a marker line.
- **Test account:** the emulator is signed in as `testtwo@gmail.com`, consent on, with one offline `app_open` still queued.
- **Agent shell quirks:**
  - The Bash tool fails on a heredoc whose body contains an apostrophe ("unexpected EOF while looking for matching `''"). Write such files with the Write tool instead.
  - There's no `python` on this machine; use `node` for scripted edits.
- **Cheap checks without the emulator:** `npx expo export --platform android --output-dir <scratch dir>` bundles the whole app and catches unresolved imports and syntax errors in about a minute. It is not a substitute for the emulator check.

---

## Start of session (agent)

1. Read this file, `AGENTS.md`, `.claude/features/00-index.md` (its standing rules) and §0 + §8 of the audit doc. Read nothing else up front.
2. Check `git status`. If the tree isn't clean, show the user what's dirty and ask whether to commit or discard it before starting ⛔.
   - At the time of writing, two files were dirty:
     - `.claude/features/17-server-push-notifications.md`: two Phase 4 boxes ticked after the emulator test;
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

- **Verification:** there is no test or lint runner. Verify on the **Medium_Phone_API_29** emulator with the test account `flotest@gmail.com`; the user signs in, and the agent never handles passwords. Drive the emulator with `adb` from PowerShell. The installed APK predates these changes, so rebuild (`npx expo run:android`, or a `lite-preview` build) before verifying client changes.
- **Schema truth** is the live Supabase project `uergtlcfpwajztqgncim` via the Supabase MCP. Follow the 00-index standing rules: `user_id DEFAULT auth.uid()`, cascade FKs, `security_invoker` on views.
- **Cut ≠ delete.** For v1, feature-flag gamification, Plans and split invites off and keep the code and data. Delete only after analytics confirm.
- **Docs:** each finished spec updates its `.claude/features` doc and the `00-index.md` row.

## Kickoff prompt for the new session

> Read `docs/matt-implement-flo.md` and follow it. Confirm with me before starting, then drive the flow yourself.
