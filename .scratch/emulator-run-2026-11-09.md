<!-- Paused 2026-11-09 at the person's request. Resume from 'Not yet run' at the bottom. -->
# Emulator check results (Pixel_API_36, 2026-11-09, test account flotest.53a49944)

## home-insights-more/03 five tabs + More
- PASS tabs in order Home, Transactions, + (Add a transaction), Insights, More; each tab 72x48 dp, + 58x58 dp, all labelled
- PASS More reaches Ask FLO, Budgets, Bills, Splits, Accounts, Categories, Settings; no Pro row (billing off); every row >= 48 dp
- PASS no Menu tab or Menu sheet
- PASS feature_opened rows for budgets, bills, splits, insights landed (MCP)

## home-insights-more/07 Insights
- PASS one period control Week | Month | Custom; Custom opens From/To with no upsell (billing off); All accounts plus each account listed
- PASS CSV export opens the share sheet with flo-insights-2026-11-03_2026-11-09.csv (the selected period)
- PASS tapping Home's week chart (outside the bars) opens Insights on Week (9 Nov – 15 Nov); tapping a bar selects that day instead
- PASS flo:///report lands on Insights; no Report screen

## deep links (streak-only/04, themes-back-unlocked/01, home-insights-more/01, 02)
- PASS flo:///shop, /trophies, /plans, /join/abc123 land on Home
- PASS flo:///personalize opens Personalize (FLAGS.themes on)

## themes-back-unlocked/01 + 02
- PASS Personalize lists every accent (Lime, Ocean, Violet, Amber, Teal, Pink…) and the card designs as a grid (Ink, Lime Flood, Christmas, Blueprint, Receipt, Dusk, Ember, Graphite, Mint Ledger, Titanium, Carbon Fiber, Mercury, Marble, Rose Gold, Copper, Denim, Lava, Borealis…), no lock, price or Shop link
- PASS equipping Dusk + Ocean: Home's card is Dusk, the chart, + button and dots are Ocean; both survive a force-stop and relaunch; profiles.theme_accent='ocean', equipped_card_theme='dusk' (MCP)
- FAIL (34-04 too) Personalize's preview mock header still shows coin / freeze / trophy counts (3,463 · 3 · 38) with the economy off

## home-insights-more/05 Accounts + transfers
- PASS More → Accounts lists Personal, SBI, Axis, Savings with in-hand balances, Edit, Transfer, New account
- PASS Transfer from Personal: ₹10 to Savings, Save above the keypad; MCP shows transfer_out (Personal) + transfer_in (Savings), same transfer_id; Personal 46,340 → 46,330
- PASS the Add sheet toggle is Expense | Income only; tapping the transfer in Transactions opens "Edit Transfer" (₹10, Personal → Savings)
- NOTE while loading, Accounts shows "₹0 in hand" for every account for a moment (no skeleton)
- NOTE the Transfer sheet's From/To account names are green, not the accent
- OPEN "with 1 account there's no Transfer action": needs a 1-account user (onboarding batch)

## design-system-and-koban/03 dark pass (Appearance = Dark)
- PASS Home, Transactions, Insights, More, Budgets, Bills, Splits (empty state + Koban), Accounts, Manage Categories, Settings, the Transfer sheet: dark surfaces, no white cards, no dark-on-dark text or icons

## home-insights-more/09 Settings
- PASS order: profile, Account, Appearance (+ Personalize), Notifications, Preferences (summary period, voice language), Transaction detection (personal build), Data & export (CSV, consent, Delete account), About (version), Developer (dev build only), Log out last
- PASS no currency picker, no report settings; privacy link hidden until PRIVACY_POLICY_URL is set (by design)
- PASS native header with "Navigate up"
- PASS edit profile (name saved, shown in Settings, profiles.full_name); Notifications → OS prompt → Allow, then Daily Reminders on (profiles.reminders_enabled true, push token saved); summary period Quarterly/Monthly switch; Export all → share sheet flo-transactions-2026-11-09.csv; Delete Account shows a clear confirm, Cancel closes it
- NOTE after saving Edit Profile the keyboard stays up over Settings
- PASS checked in light and dark

## design-system-and-koban/01 Appearance
- PASS System follows the phone live (light → dark) with no restart
- PASS forcing Dark overrides a light phone and survives a cold start; profiles.theme_mode = 'dark' (MCP)
- SUPERSEDED "no accent picker, Personalize or card-skin UI" (spec 43 brought them back on purpose)

## add-sheet-3-tap (spec 36, as revised on the phone and by spec 44)
- SUPERSEDED "opening focuses the amount": with FLAGS.ai the ⊕ opens focused on the quick-add line (spec 44); tapping the amount gives the decimal keypad (inputType 0x6002)
- SUPERSEDED 4x2 grid / More / Details row: the sheet is Expense|Income, amount, one swipeable category row, Today/Yesterday/Pick a date, Note, Account, Save
- PASS Save sits above the keypad and is dimmed/disabled at ₹0; 12.50 saves as 12.50 ("Logged ₹12.50 · Transport")
- PASS Income re-ranks and re-defaults (Salary, Freelance, Other; Salary selected)
- PASS no Plan control, no split control (no open splits), Transfer not in the type toggle
- PASS editing a transfer opens Edit Transfer; a parsable shared text fills the amount (₹120), an unparsable one fills the note (by design: _layout.js ShareIntentHandler)
- PASS Save closes the sheet with "Logged ₹X · Category" and Undo; Undo deleted a saved ₹8 (expense_logged row exists, transaction gone)
- NOTE one Undo tap about 1 s after Save (toast still sliding in) did nothing; the ₹7 entry stayed
- PASS expense_logged: source manual, category_was_prefilled true (default kept) / false (Groceries tapped), seconds_to_save, no amount; a share save records source share; income save and an edit record nothing
- NOTE Home card shows Expenses ₹1,985 while the chart and Insights say ₹1,984.50 (card rounds paise; In Hand shows them)
- OPEN first-open keyboard quirk after a cold start (known, predates spec 44); 1-account checks and day-one celebration need a fresh account

## home-insights-more/08 Home body (as revised: NothingLoggedCard replaced the Today strip)
- PASS a transaction with a note is titled by the note with "Category · date" underneath ("edit test", "Groceries · 9 Nov")
- PASS Upcoming Bills shows with Electricity due 12 Nov in the window

## home-insights-more/04 budget warnings in the bell
- PASS saves that crossed the ₹2,000 overall budget showed only "Logged …", no budget toast
- PASS the bell lists "Overall budget, Over by ₹104.50" (plus Lunch over, Netflix overdue, Electricity due) and tapping it opens the Monthly spending budget

## streak-only (seeded on the test account: 3 and 8 Nov logged via backdated created_at, 7 Nov no_spend mark, 6 Nov legacy reward_events no_spend, 5 Nov freeze_used mark, 4 Nov legacy freeze_used)
- PASS 01 the streak reads 7, counting marks and legacy rows; the calendar shows each day's state
- PASS 03 the 7-day run wrote one freeze_earned mark (9 Nov); Freezes shows 0/2 = earned 1 − used 2, floored at 0
- PASS 04 no new reward_events rows from the app (only the 2 seeded ones); /shop and /trophies land on Home
- FAIL 04 Personalize's preview mock still shows coin / freeze / trophy counts (3,463 · 3 · 38)
- PASS 05 the daily cap: the queue held bills-due and the milestone because 2 takeovers had already shown that day (day.count 2); after resetting the count, bills showed first
- PASS 06 bills modal this session ("Bill Due Today", Netflix ₹649, Mark Paid / Later), day-7 celebration next session; streak_milestone {days: 7} event; no spin wheel after "Let's go"
- NOTE the celebration's 7-day row is newest-first on purpose (StreakDays comment)
- PASS 07 next milestone 30, "23 days to go"; legend Logged / No spend / Frozen; no badge grid, trophy link or freeze button; native header
- FIXED 07 the month calendar wrapped at 6 cells (100/7 % widths rounded past the row on Android), putting every date under the wrong weekday; it now renders one row of 7 flex cells per week (app/streak.js), checked: 1 Nov under Sunday, 3 Nov Tuesday, 8 Nov Sunday
- PASS 37-07 lucide flame, check and snowflake states, distinguishable in dark

## Not yet run (resume here)
- Fresh-account batch: spec 35 onboarding 02–07, spec 33 tickets 02–03 (opener opt-in, offline queue, consent off while queued), spec 36 first-open/day-one celebration and 1-account checks, spec 38-05 "1 account, no Transfer", 38-06 header with 1 vs 2+ accounts, 38-08 NothingLoggedCard and No spend tap, empty states, spec 43-02 sign-out/sign-in keeps the accent and a second account gets its own
- Light-mode pass of the same screens (dark is done)
- Spec 37: 02 contrast ratios, 04 TalkBack / largest font / 48 dp on Settings, 05 TalkBack back button, 06 calm feedback + destructive haptic, 08–11 Koban gallery and placements, reduced motion
- Flag flips (approved: flip, check, revert, never commit): FLAGS.plans on (38-01), FLAGS.economy on (34-04), FLAGS.themes off (43-02), FLAGS.billing on (38-07 gating)
- Spec 38-02 splits: create, add entries, settle up, export; a seeded non-INR account
- Spec 32: 03 and 04 need a release build on the emulator (an x86_64 release APK), 06 profile photo without CAMERA
- Spec 34-02 No spend tap (writes a no_spend mark + no_spend_marked event)

## Not testable here
- Not built: spec 39 (all 7 tickets), spec 38 ticket 10
- Launch-only / the person's steps: spec 32 tickets 05, 07, 08; Google sign-in (parked)
- Phone only: spec 44 07 (chat ≤ 4 s), 08 (spoken question), 09 and 11 phone checks
