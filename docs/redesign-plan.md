# FLO redesign plan: "Quiet Ledger"

**Status:** proposal, 2026-11-09; revised 2026-11-10 after the first Home preview on the emulator. This document is the source of truth for the redesign: where it disagrees with older specs (37, 38) or `theme/tokens.js`, this document wins. Next step: `/to-spec` for Phases 1 and 2, then `/to-tickets` (§8 has the handoff). Phases are in §7.

**What exists in code (uncommitted on `feat/spec44-ai-quick-add-voice`, dev only):** `theme/ledger.js` (tokens), `components/ledger/` (`AmountText`, `Button`, `HeaderIconButton`, `ListRow`, `QuickActions`, `SectionHeader`, `AccountCardCarousel`, `WeekLine`), `lib/dayScenes.js` and `app/dev/home-preview.js` (Settings → Developer → Home preview). Inter is installed and loaded in `app/_layout.js` alongside Manrope. The real screens are untouched.

**Sources:**
- 21 reference screens in `design-inspirations/` (Kit, Wealthsimple, Wise);
- the emulator screenshots of the current app taken on 9 Nov (Home, Add sheet, Insights, More, Budgets, Bills, Splits, Accounts, Categories, Settings, Personalize, Streak, Ask FLO, celebrations, onboarding);
- the earlier codebase scans: spec 37 tokens, `Card`, `Button`, `EmptyState`, Koban, and the sheet providers.

**Rule:** every feature stays. Screens may merge or split, and each change is called out below. Feature flags (`economy`, `plans`, `billing`, `splitInvites`, `currencyPicker`) keep working as they do; flagged-off features get the same restyle so turning one back on doesn't look out of place.

---

## 1. What's wrong today (from the screenshots)

1. **Card soup.** Almost everything is a rounded card on a grey background: the hero, the chart, the list and every Settings group. With no hierarchy, every screen reads at the same volume.
2. **The accent is everywhere.** Lime (or the chosen accent) fills buttons, chips, tabs, bars, the + button, dots and the selected category. Nothing stands out because everything does.
3. **Heavy, toy-like shapes.** Extra-bold type on everything, chunky 56 dp pill buttons, filled square icon tiles and emoji. Together these read as a game, not a ledger.
4. **Inconsistent chrome.** Some screens have a boxed back button and others a native arrow. Titles are sometimes large and sometimes in the header. Some sheets have an X and some don't.
5. **Numbers lack authority.** Amounts change size and weight from screen to screen, paise appear in some places and not others, and there are no tabular figures, so columns don't line up.
6. **Placeholder art.** The cartoon cat appears on everyday screens (empty states, Home, the streak hero), while celebrations use confetti and emoji. The two styles don't belong together.
7. **Data screens are busy.** Charts show full axes and gridlines, Insights stacks KPIs, a chart, chips and a list with no clear first read, and transaction rows repeat the category twice.

## 2. Design language

**One sentence:** a clean white ledger where the money is the loudest thing on screen. It's neutral black and white throughout, with colour only where it means something, flat lists in place of card stacks, one tactile object for each emotional moment, and the **themed account card (seasonal skins included) as the one signature piece of colour and art**.

**Decided 2026-11-09 (person):**
- the primary is neutral black and white;
- the background is pure white (dark mode is near-black);
- card themes stay and are the app's stand-out feature;
- the accent picker is flagged off;
- the streak stays in a quieter form;
- Koban is flagged off (superseded 2026-11-10: deleted, see §2.6).

### 2.1 Principles
1. **Money first.** On every screen the main figure is the largest type, set in tabular figures. Everything else steps down.
2. **Flat by default, cards by exception.** Lists sit on the canvas with hairline dividers, as in Wise and Kit. A card is used only for something you can act on or swipe (the account card, a proposal, a callout).
3. **Neutral by default, colour for meaning.** Primary buttons, selected states, tabs and the + button are ink (black in light, white in dark), as in Wealthsimple and Kit. Colour appears only for a reason:
   - money in, over budget and overdue (§2.2);
   - category tints in pickers and Insights;
   - one accent blue on charts, progress and selection marks;
   - the themed card;
   - illustrations.
4. **The card is the signature.** The themed account card is the one place FLO is decorative: ~50 designs plus seasonal animated skins (Christmas first). Everything around it stays quiet so the card stands out, which no other finance app does.
5. **One object per moment.** Onboarding, empty states, celebrations and the AI entry each get a single tactile 3D illustration (coins, a FLO token, a whistle for reminders), as in Wealthsimple. Everyday screens have no illustration.
6. **Say less.** One title, one line of body, one primary action. Secondary actions are outlined or text buttons.
7. **Same chrome everywhere.** One header, one back button, one sheet handle, one pinned-CTA footer.

### 2.2 Colour
| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#FFFFFF` (pure white, as in Kit and Wise) | `#0B0B0B` | screen background |
| `surface` | `#FFFFFF` with a `hairline` border | `#171717` | sheets, the few cards, inputs |
| `surfaceSunk` | `#F4F4F2` | `#1F1F1F` | segmented-control track, search field, detail header band, quick-action tiles |
| `ink` | `#121211` | `#F3F2EE` | text, primary button fill |
| `inkOnInk` | `#FFFFFF` | `#121211` | text on primary buttons |
| `muted` | `#6E6C66` (≥4.5:1 on canvas) | `#A3A19B` | secondary text |
| `hairline` | `#E4E1DA` | `#2B2B28` | dividers, input borders |
| `positive` | `#1E7A46` | `#5FD394` | money in, "paid" |
| `negative` | `ink` | `ink` | money out stays ink with a "−" sign; red is kept for warnings |
| `danger` / `dangerSoft` | `#B42318` / `#FDECEA` | `#F97066` / `#3A1715` | over budget, overdue, destructive (a pale-red pill, as in Wise) |
| `warnSoft` | `#FFF6DB` | `#3A3115` | callouts (Kit's yellow box) |
| `accent` (code: `chart`, `highlight`) | `#3B5BDB` | `#8EA6FF` | the week line and its fill, budget progress, the selected chart point, small selection marks. Static, never tied to the card or the time of day. **Lime is gone (2026-11-10).** |
| `streak` | `#FF6B2C` | same | the lit flame and logged days on the streak calendar only (the orange convention from `theme/tokens.js` stays) |
| `warn` / `warnSoft` | `#B54708` / `#FFF6DB` | `#FDB022` / `#3A3115` | almost out, due soon |
| category tints | each category's own colour at 14 % | 22 % | the circle behind **every** category icon, lists included; the glyph is the same colour darkened 30 % (light) or lightened 35 % (dark). `toneColors()` in `components/ledger/ListRow.js` |

- **The accent picker is flagged off** (a new `FLAGS.accents`, off; the code and the stored `theme_accent` stay, per "cut ≠ delete"). A neutral primary leaves the accent too little to do, and two personal choices compete with the card. Turning the flag back on would let it repaint `accent` only.
- **Contrast:** `accent` blue passes 4.5:1 on white, so it may be used for small text such as a selected chip label, but never for body copy.

### 2.3 Type (Inter, decided 2026-11-09; scale revised 2026-11-10)
- **Typeface:** **Inter** for everything (`@expo-google-fonts/inter`, installed, loaded with `expo-font`). It replaces Manrope, whose rounded shapes at extra-bold weights were a big part of the toy feel. Weights 400, 500, 600 and 700 are loaded; nothing heavier exists. `inter` in `theme/ledger.js` maps the family names.
- **No separate display cut:** big numbers use Inter 700 with negative tracking.
- **Weights:** 400 body and captions · 500 row titles, labels and date groups · 600 section headers, titles and buttons · 700 **only** for money heroes.
- **Figures:** `fontVariant: ['tabular-nums']` on every amount. Paise follow one rule app-wide: shown only when non-zero, everywhere, the card included.
- **Size:** the first pass (44 display, 16 rows) read large on a 411 dp phone. The scale is now two steps down, with rows at 14, as in Wise and Kit. **Do not size up without a device check.**
- **Case:** sentence case everywhere. **No uppercase captions** (section headers, date groups, settings groups); they read faint and shouty at once.
- **Still to check:** ₹ and en-IN grouping (₹1,00,000), Tamil falling back to the system font (voice language, notes), Android line heights, and the largest system font size.

| Role (`ledgerType`) | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 32 / 38 | 700 | −0.8 | Home balance, detail hero |
| `title` | 20 / 26 | 600 | −0.3 | screen title, dialog title |
| greeting | 18 / 24 | 600 | −0.1 | Home's "Good evening" |
| `section` | 16 / 22 | 600, **ink** | −0.1 | section headers ("Upcoming bills", "This week") |
| `body` | 14 / 20 | 400 | 0 | |
| `rowTitle` | 14 / 20 | 500 | 0 | list row titles |
| row amount | 14 / 20 | 600, tabular | 0 | |
| `caption` | 12 / 16 | 400, muted | 0 | row subs, the in/out line |
| `group` | 12 / 16 | 500, muted | 0 | date groups ("Today", "Sat 7 Nov") |
| `button` | 14 / 18 | 600 | 0 | 52 dp buttons; compact (34 dp) uses 13 |
| quick-action label | 12 / 16 | 500 | 0 | |
| "See all" | 13 | 600, muted, no underline | 0 | |

- **Brand moments** (onboarding headline, celebration number): Inter 700 at 32–36, tracking −0.8.

### 2.4 Shape, space, elevation
- **Spacing:** a 4-pt grid. Screen gutter 20 (nothing may cross it, chart labels included), **block gap 24** (was 28; gappy at the smaller type), 12 between a block and something that belongs to it (quick actions → Today prompt), 16 from the Home header to the card, row height 64 (two lines) or 52 (one line).
- **Radius:** 12 for inputs and small cards, 20 for sheets and the account card, full for buttons, chips and icon circles.
- **Elevation:** none on the canvas. Sheets get one soft shadow in light mode and a `hairline` top edge in dark mode.
- **Hit targets:** 48 dp minimum everywhere, including chart points (one tap column per day), "See all" and chips. Compact buttons are 34 dp with `hitSlop` to reach it.

### 2.5 Components (the kit to build first)
| Component | Replaces | Shape |
|---|---|---|
| `ScreenHeader` | boxed back buttons, mixed native headers | a 40 dp circle back button (Wise), an optional left-aligned large title that collapses on scroll, and up to two circle icon actions on the right |
| `Button` | the 56 dp extra-bold pills | `primary` (ink fill), `secondary` (outlined ink), `quiet` (text), `danger` (dangerSoft fill, danger text). 52 dp high, 600 weight |
| `PinnedFooter` | each screen's own footer | a full-width primary (plus an optional secondary side by side, as in Wealthsimple's Skip / Next), with the safe-area inset and keyboard-aware |
| `ListRow` | transaction rows, settings rows, bill rows | a 40 dp **tinted circle icon** on the left (`tone` = the category's colour; no tone = a `surfaceSunk` circle with an ink glyph), title and sub, right value and sub, a chevron or switch. **Built.** |
| `SectionHeader` | the various group titles | a sentence-case 16/600 title in ink plus an optional right action ("See all", muted, no underline) or a right node. **Built.** |
| `AmountText` | the various money texts | sizes `display` / `title` / `row`, tabular, a sign rule (+ in positive green, − in ink), and the paise rule |
| `Segmented` | the Insights period switch, Expense/Income | a sunk track with a white thumb (Wise "Updates / Details") |
| `Chip` | filter and category chips | outlined pills; selected = an ink fill with white text |
| `Callout` | ad-hoc info cards | `info` (sunk), `warn` (warnSoft), `danger` (dangerSoft), with an icon and one line |
| `ProgressBar` | budget bars | a 4 dp bar in `accent` on a `surfaceSunk` track; warn and danger colours past 80 % and 100 % |
| `WeekLine` | the Home week bars | a line plus soft area fill in `accent`, a dotted daily-average line, today's dot, tap a day for its total, an empty-week note. **Built.** |
| `AccountCardCarousel` | `AccountHeroCarousel` | the themed card (2:1) with the account name, optional `•••• last4` (spec 45), swipe between accounts, dots. **Built.** |
| `Timeline` | new | a vertical step list (Wise transfer status), for bill history, split settle-ups and an AI proposal's status |
| `Illustration` | Koban on everyday screens, the 3D coin art | one component with named objects: `coins`, `token`, `whistle`, `calendar`, `receipt`, `spark`, `trophy`. PNG/WebP assets, no SDK |
| `EmptyState` | the current Koban empty state | an `Illustration` (small), a title, one line, an optional secondary button |
| `Sheet` | the current sheets | one handle, a title row with a circle X, and a `PinnedFooter` |

### 2.6 Iconography and illustration
- **Icons:** keep lucide, at a 1.75 stroke, inside **tinted circles** (the category's colour washed behind, a deeper shade for the glyph). Drop the filled square tiles. No emoji in the UI.
- **Bill (and plan) icons, Phase 4:** most bill rows show the same generic icon. Pick an icon from the bill's name: a local keyword map first (Netflix → film, electricity → zap, rent → home, Jio → smartphone, LIC → shield, SIP → trending-up, EMI → landmark…), and for names it doesn't know, one `ai-assistant` call **at save time** that may only return a key from FLO's icon set. The result is stored in a new `icon` column and the person can change it in the sheet (spec 44 rule: the model proposes, the person decides). No brand logos (trademarks).
- **Illustration:** a small set of rendered 3D objects in FLO's palette (warm metal, matte paper, one blue accent), used on onboarding, empty states, celebrations, the notification ask and the Ask FLO intro. **Never on working screens.**
- **Koban: deleted (decided 2026-11-10).** First planned as flagged off; the person then chose to delete him outright, because he won't be used again. His drawing code, poses, faces and dev gallery are gone, and there is no `FLAGS.mascot`. He was placeholder art and made the app read as a toy. His places go to the 3D objects (`Illustration`), or to nothing where the plan says the screen has no art. The streak copy helpers in `lib/koban.js` are text, not art, and stay.
- **Card art is the exception to "no art on working screens":** the themed card on Home and in Personalize. Seasonal skins (spec 43 Phase 1b) become a recurring drop, for example Diwali, Christmas, New Year and Holi. Each one follows spec 43's skin rules (text in the left two-thirds, art in the right third) and animates once when Home gains focus.

### 2.7 Motion and feedback
- **Defaults:** 180–220 ms ease-out fades and short rises; sheets use their native spring.
- **No entrance animation on data:** lists, charts and numbers appear in place. The exception is a count-up on the Home balance, on the first load of the day only.
- **Celebrations:** one object animates in, with no confetti spray and no emoji.
- **Haptics:** light on save, medium on destructive confirm, success on a streak milestone.
- **Reduced motion:** everything still.

---

## 3. Navigation map (after)

```text
Tabs:  Home · Activity · ( + ) · Insights · You
         │        │                 │         └─ You (was More): Ask FLO, Budgets, Bills, Splits,
         │        │                 │            Accounts, Categories, Personalize, Settings
         │        │                 └─ Insights (Week | Month | Custom)
         │        └─ Activity (was Transactions) → Transaction detail (NEW)
         └─ Home → Account switcher sheet, Streak, Alerts, Ask FLO
( + ) long-press → Add sheet listening (spec 44)
```

**Renames** (labels only, routes unchanged): Transactions → **Activity** (Wise, Kit) and More → **You**. Both are optional; see §6.

## 4. Screen by screen

Each line gives what changes and why. ⇄ marks a merge or split.

### Onboarding (spec 35 flow kept: opener → sign-up/sign-in → first expense → reminder ask → Home)
- **Opener:**
  - becomes a **3-slide carousel** with page dots (Wealthsimple 1–2): "Every rupee, in one quiet place", "Log in 3 taps, or just say it", "See where it went";
  - one 3D object per slide;
  - pinned **Create account** (primary) and **I have an account** (secondary);
  - the analytics opt-in stays out of the opener (spec 33 revision).
- **Sign up and sign in:** Kit 4–6 and Wealthsimple 5.
  - left-aligned title and labelled inputs (email; password with show/hide);
  - **live password rules** with green ticks;
  - the terms line in small muted text above the pinned CTA;
  - the CTA stays disabled (grey) until the form is valid;
  - Google stays parked, with its button slot kept.
- **Set-up questions (NEW, decided 2026-11-09)** ⇄ brings back a short question step that spec 35 removed. The difference: **every answer sets up something the app already has**. Nothing is asked just to profile you (the old answers in `profiles.onboarding_answers` were never used).
  - **Pattern:** the Wealthsimple 13–15 layout. A thin progress bar at the top ("1 of 4"), a left-aligned question, the answer control, and a pinned **Skip for now** (secondary) with **Next** (primary). The last question adds "You can change these in Settings".

  | # | Question | Control | What it writes |
  |---|---|---|---|
  | 1 | **Where does your money live?** | multi-select chips (Cash, SBI, HDFC, ICICI, Axis, Kotak, UPI wallet, + Add with a name field) | one `accounts` row per pick; the first becomes active. Skip leaves the default "Personal" account. Turns on the account switcher, transfers, and account names for quick add and Ask FLO ("paid 200 from HDFC") |
  | 2 | **When does your month start?** | `Segmented` "1st of the month" \| "My salary day", with a day-of-month picker for the second | `profiles.reset_period` (`monthly`, or `custom` with `reset_custom_start`), the same values Settings writes |
  | 3 | **Want a monthly spending limit?** | a large amount field with ₹, and an optional "Suggest from my spending later" note | one overall `budgets` row (`calendar_month`, `category_id` null) through the same insert as the Add Budget sheet. Skip creates none |
  | 4 | **Pick your card** | a 2-column grid of card designs, with seasonal skins first and a live preview on top | `profiles.equipped_card_theme`: the signature, shown early |

  - **Not asked, on purpose:**
    - goals, income, "why FLO" (nothing uses them);
    - category picking (the defaults plus the smart default already work);
    - voice language (asked the first time the mic is used);
    - analytics consent (stays a later moment, per spec 33).
  - **Flow and cost:** after sign-up and before the first expense. It goes from 4 to about 8 screens, roughly 45–60 s. That's acceptable for a personal-first app, because the answers save more taps later. Every question can be skipped, and Back keeps earlier answers.
  - **Writes:** each answer is saved when Next is tapped, through the existing `lib/` mutations, so quitting halfway keeps what's done. `OnboardingGate` still owns routing, and `onboarded_at` is set at the end, as now.
  - **Analytics:** `onboarding_step_viewed` gains the steps `accounts`, `month_start`, `budget` and `card` (consent permitting).
- **First expense:**
  - the Add sheet over an empty Home, as now, with the new accounts and card already showing;
  - a title strip reads "Log your first expense: type it or hold to say it", which shows off quick add and voice;
  - **Not now** is a quiet button.
- **Reminder ask:**
  - the "Stay in the know" pattern (Wealthsimple 16): a whistle object, two lines of copy, **with the reminder time picker built in** (default 9 pm), then **Allow notifications** (primary) and **Maybe later** (secondary);
  - the OS prompt comes only after Allow.
- **Order:** opener carousel → sign up → accounts → month start → budget → card → first expense → reminders → Home.
- **Coach marks:** keep only the + mark. The streak-chip mark is dropped (see Streak).

### Home (preview built: `app/dev/home-preview.js`)
Kit 96 crossed with Wise. Order and spacing as built and checked on the emulator on 2026-11-10.
1. **Header:** a greeting for the time of day ("Good evening", 18/600 ink) over a muted date ("Tuesday, 10 November"). On the right are three 40 dp circle icons: the streak (flame plus count, the flame filled `streak` orange only when today counts), Ask FLO (sparkle) and the bell (with a dot).
2. **Account card, the signature** (card themes, spec 43, kept and promoted):
   - **Decided 2026-11-10: the hero stays a card.** A full-bleed, Headspace-style scene was considered and dropped: a card reads as an object you own and swipe (one per account), a banner doesn't; full-bleed art competes with the equipped theme; and it costs the space money needs;
   - **the Day theme:** the free default (today's Ink) becomes four landscapes by local time: morning 5–12, afternoon 12–17, evening 17–20, night 20–5 (`lib/dayScenes.js`, static SVG, 360×180, plain sky top-left for the name). An equipped theme or seasonal skin replaces it. To do in the spec: add Day to the `lib/cardThemes.js` catalog as the free theme (Ink stays selectable) and to Personalize;
   - the card shows its art plus the account name and a chevron, and an optional **"•••• 4821"** bottom-left (spec 45, `accounts.last4`). Never a full card number, expiry, name on card or CVV;
   - the balance sits **off the card on the white canvas below it**: an "In hand" caption, a display amount, then "₹50,100 in · ₹1,985 out this month" in muted text (Kit's "Card available $3.00");
   - swipe between accounts, with dots under the card; the account switcher is a sheet from the chevron;
   - a seasonal skin that's live but not equipped gets a one-time, dismissible "New: Diwali card" row under the card, linking to Personalize.
3. **Quick actions row** (Kit's Manage / Lock / Transfer): **Add** · **Transfer** (only with 2+ accounts) · **Ask FLO**. Three equal 64 dp tiles in `surfaceSunk`, an 18 dp icon over a 12/500 label.
4. **Today prompt:** while nothing is logged today, one bordered `ListRow` reads "Nothing logged today", with a compact **No spend** button. 12 below the quick actions. It replaces `NothingLoggedCard` with Koban (the feature is kept).
5. **This week (`WeekLine`):** a line with a soft area fill in `accent` blue, a dotted daily-average line, no axis or gridlines, today's dot, day initials under each point, the week's total top-right. Tapping a day shows its total in the header without navigating; tapping the header opens Insights → Week. An empty week says "No spending logged this week". **Decided 2026-11-10:** a line, not bars, and a static blue rather than a colour that follows the card or the time of day (an orange evening chart would read as a warning).
6. **Upcoming bills:** shown only when something is due within the window, as at most 2 `ListRow`s and "See all". An overdue bill's circle and caption use `danger`.
7. **Recent activity:** date-grouped flat rows ("Today", "Yesterday", "Sat 7 Nov", sentence case). Each row has a tinted category circle, the note or merchant as the title, the category as the sub (not repeated when there's no note), and the amount right. "See all" opens Activity.
- **Removed from Home:** Koban; the card's skeleton gets the card's own shape.
- **Not checked yet:** dark mode, the chart with real data, the largest font size.

### Add sheet (spec 36 + spec 44, every feature kept)
- **Order:**
  - the quick-add line (with mic) at the top, in a `surfaceSunk` field;
  - the `Segmented` Expense | Income;
  - a **centred display amount** with a blinking caret and the ₹ in muted text;
  - categories as a swipeable row of **circle chips** (the selected one is an ink circle with a white icon; unselected ones show the category tint);
  - Today · Yesterday · Pick a date chips;
  - the Note row;
  - the Account row (only with 2+ accounts);
  - the split row (only with open splits);
  - Save in the `PinnedFooter`.
- **The save toast:** "Logged ₹120 · Food" with **Undo** stays. The toast enters without a slide, so a fast Undo tap always lands (it missed once in the 9 Nov check).

### Activity (was Transactions)
- **Header:** title, then a **search field**, then **filter chips**: Type, Category, Account, Date range (Wise 309). They replace today's month arrows plus the All / Expense / Income pills.
- **Summary strip:** "Spent ₹X · Received ₹Y" for the current filter, in one line instead of two cards.
- **List:** date-grouped flat rows, with transfers shown as ⇄ in one row (not two legs).
- **Empty:** `EmptyState` with the `receipt` object.

### Transaction detail (NEW) ⇄ split from the edit sheet
Today a tap opens the edit sheet directly. Wise 180 shows a calmer pattern: **read first, then edit**.
- **Top band** (`surfaceSunk`): a circle category icon, a **display amount** (+ green for income), the title (note or category), then the date and account.
- **Segmented control:** **Details** (category, account, date, note, split link, source: manual / voice / quick add / AI / share / auto-detect) and **History** (a `Timeline` of created, edited, split entry, undo).
- **Footer:** **Edit** (primary, opens the existing sheet) and **Delete** (a `danger` pill, with a confirm).
- **Transfers:** the same layout as "From Personal → To Savings".
- **Why:** it stops accidental edits, gives auto-detected and AI entries a place to show where they came from, and gives splits a link back.

### Insights
- **Top:** `Segmented` Week | Month | Custom, with the period arrows inline (‹ November 2026 ›), and the account filter as a chip ("All accounts ▾") that opens a sheet instead of a long chip row.
- **Headline:** "You spent **₹1,984.50**", with a muted comparison line under it ("₹430 less than October").
- **Chart:** the same `WeekLine` style (line plus area in `accent`) for Week, Month and Custom, with the axis labels reduced to the first and last day for Month and Custom.
- **Where it went:** `ListRow`s with a thin bar in the category tint under each, plus a percentage. A tap filters Activity to that category.
- **Received / Net saved / Savings rate:** three small stats in one row, with no cards.
- **Export CSV:** an icon in the header, as now.

### Budgets ⇄ list and detail kept
- **List:** each budget is a `ListRow` with a `ProgressBar` under the title and "₹5,910 left" right. The status words "Almost out" and "Over" are a coloured caption, not a pill-in-card. A bottom `PinnedFooter` has **New budget**.
- **Detail:** a top band with "₹2,104.50 of ₹2,000" (display), a `ProgressBar`, a pace `Callout` ("Spending too fast to last the period"), then the period's transactions, date-grouped. The edit icon is in the header.
- **Sheet:** the same `Sheet` pattern, with the period as a `Segmented` control; the free-plan gate is unchanged.

### Bills
- **List:** grouped under **Overdue** (danger caption), **This week** and **Later**. Each row shows a circle icon, the name, "Monthly · Due 12 Nov" and the amount, plus a small **Mark paid** quiet button. They replace the dark pills on every row.
- **Bill detail (NEW, light)** ⇄ split from the edit sheet: the amount, the cadence, the next due date, and a **`Timeline` of payments** (Wise 180), with Mark paid in the footer and Edit in the header.
- **The bills-due moment:** a bottom sheet, not a full-screen modal: "2 bills need you", rows, then **Mark paid** / **Later**. It's still queued through the moment queue.

### Splits
- **List:** rows with stacked member avatars (circles with initials), the name, and "You're owed ₹600" or "You owe ₹200" right (green or ink).
- **Detail:** the balance band at the top, a member list with net amounts, entries date-grouped, **Settle up** as a pinned primary, and export in the header. Invites stay flagged off but use the same `Sheet`.

### Accounts
- **List:** `ListRow`s with the account's colour dot, the name and the in-hand balance (with a skeleton, never ₹0, while loading), and a check on the active one. **Transfer** and **Edit** are in a row overflow (⋯) instead of two text buttons on every row.
- **New account:** a `PinnedFooter`. The free-plan gate is unchanged.

### Categories
- Two sections (Expense, Income), each a list of `ListRow`s with a circle icon. Delete is a swipe or the edit sheet's danger button, not a red bin on every row. **+** sits in each section header.

### Ask FLO (spec 44)
- **Empty:** the `spark` object, "Ask about your money", and the four starter chips as outlined `Chip`s.
- **Chat:**
  - the person's bubbles are `ink` with `inkOnInk` text, instead of the accent;
  - answers stay bubble-less;
  - breakdown tables use `ListRow` styling;
  - proposal cards are the one `surface` card on the screen, with Review (primary) and Dismiss (quiet), and "Saved ✓" as a positive caption.
- **Past chats:** date-grouped rows.

### Streak (kept, quieter)
**What it's for:** it's the one daily-habit loop left after the economy cut. It gives "No spend today" its purpose and feeds spec 39's nudge copy. The game machinery goes.
- **Kept:**
  - the header chip;
  - the No spend button (Home's Today prompt);
  - automatic freezes (invisible until one saves you, then one line in the toast);
  - milestone celebrations at 7, 30, 100 and 365 days.
- **Dropped from the UI:**
  - the day-one celebration;
  - the streak coach mark (and the streak-chip `Callout` in Onboarding above);
  - Koban on this screen.
- **Hero:** a display count with a flame in `streak` orange, and the copy line.
- **Freezes and next milestone:** two stats in one row, with no cards.
- **Calendar:** the fixed 7-column grid, with logged = a `streak` dot, no-spend = a ring, frozen = a snowflake glyph, and a legend underneath.

### Celebrations and moments
- **Milestones only (7 / 30 / 100 / 365):** a full screen on `canvas` with the `trophy` or `token` object, the number in brand display type, one line of copy, and **Continue**. The 7-day row of states stays, newest first. The streak-start (day one) moment is removed.
- **The share-usage ask:** a bottom sheet in the "Stay in the know" pattern.
- **Alerts sheet:** grouped `ListRow`s (Overdue, Budgets, Due soon), each opening its screen.

### Settings and the You tab
- **You (was More):**
  - a profile header (circle initial, name, email) with Personalize as the first row;
  - then grouped `ListRow`s under sentence-case `SectionHeader`s: Ask FLO; **Money** (Budgets, Bills, Splits); **Set up** (Accounts, Categories); then Settings;
  - all flat on the canvas, with no card groups.
- **Settings:**
  - the same flat grouped rows, with switches right-aligned;
  - Appearance as a `Segmented` control;
  - the battery advice as a `Callout` (warn) instead of a paragraph row;
  - Delete account as a `danger` quiet row at the bottom above Log out;
  - Developer only in dev builds.
- **Personalize (becomes "Cards"):**
  - a large live preview of the selected card at the top, animating if it's a seasonal skin; the old phone mock with its economy counters goes, which fixes the 9 Nov bug;
  - a **Seasonal** row first (live and upcoming skins, with "Coming for Diwali" placeholders);
  - then every design as a 2-column grid;
  - **Equip** pinned;
  - no accent swatches while `FLAGS.accents` is off;
  - it's the first row on the You tab.

### Pro and upsell (flagged off by `FLAGS.billing`)
- **Kept:** it's restyled to a Wealthsimple 13-style benefits list (a check list in a `surface` card) with plan options as selectable rows (Kit 15) and the CTA pinned. It's only visible when billing is on.

### Auto-detect, share-to-FLO, notifications, voice
- No new screens. Their entry points use the same `Sheet`, `Callout` and `ListRow` patterns, and the restricted-settings help becomes a `Callout` with steps.

## 5. Feature checklist (nothing removed)

| Feature | Where it lives after |
|---|---|
| Add expense / income, quick add, voice, long-press + | Add sheet |
| Transfers | Home quick action, Accounts ⋯, Add sheet edit for existing |
| Undo after save | the Add sheet toast |
| Transaction edit / delete | Transaction detail → Edit sheet / Delete |
| Search and filters | Activity (search new; filters replace pills) |
| Insights (week, month, custom, accounts, CSV) | Insights |
| Budgets (list, detail, create, edit, gate) | Budgets |
| Bills (list, mark paid, create, edit, due moment, reminders) | Bills + bill detail + moment sheet |
| Splits (create, entries, settle, export; invites flagged) | Splits |
| Accounts (list, switch, add, edit, transfer) | Accounts + Home card switcher |
| Categories (add, edit, delete) | Categories |
| Streak, no-spend, freezes, milestones | Home header chip, Today prompt, Streak screen, milestone celebrations (day-one moment and streak coach mark dropped) |
| Ask FLO chat, past chats, proposals | Ask FLO |
| Card themes and seasonal skins (the signature) | Home card, Cards (was Personalize) |
| Accent colours | flagged off (`FLAGS.accents`); code and stored choice kept |
| Appearance (System / Light / Dark) | Settings |
| Notifications, summary period, voice language, detection, consent, export all, delete account, log out | Settings |
| Onboarding, reminder ask, first expense, coach mark, set-up questions (accounts, month start, budget, card) | Onboarding |
| Koban mascot and gallery | deleted (2026-11-10); his places use `Illustration` objects |
| Economy, Plans, Pro (flagged off) | unchanged routes, restyled with the same kit |
| Alerts | the bell's sheet |

## 6. Decisions
**Settled (2026-11-09):**
- the primary is neutral black and white;
- the background is pure white;
- card themes stay as the signature, with seasonal skins as a recurring drop;
- the accent picker is flagged off;
- the streak stays, quieter;
- Koban is flagged off (superseded 2026-11-10: deleted);
- the typeface is Inter (§2.3).

**Settled (2026-11-10, after the first Home preview):**
- type is two steps smaller (display 32, rows 14, captions 12) and every header is sentence case (§2.3);
- lime is dropped: `accent` blue for charts and progress, `streak` orange for the flame (§2.2);
- block spacing is 24 (§2.4);
- the hero stays a card (account identity, swipe, dots); a full-bleed hero was considered and dropped. The free default card becomes **Day**: morning, afternoon, evening and night landscapes by local time (`lib/dayScenes.js`). An equipped theme or seasonal skin replaces it;
- Home's week chart is a line with a soft area fill in one static blue (`chart` token), not bars, and not a colour that changes with the card or the time of day;
- list icons sit in a circle washed in the category colour, with the icon in a deeper shade of it (no outlined ring).

**Still open:**
1. **Seasonal skins:** which ones and when (Diwali, Christmas, New Year, Holi…), and whether they ever become Pro (spec 43 Phase 2 says Pro unlocks everything once billing ships).
2. **3D objects:** commission them, render them with a 3D tool, or use AI-generated assets that are hand-picked and kept as static files. Leaning (2026-11-10): Remotion with `@remotion/three` for objects built from simple shapes (coins, token, trophy, calendar, receipt), rendered at build time to transparent WebP (animated WebP for celebrations) with one shared light and camera; modelled files for organic ones (whistle). HyperFrames and Remotion are build-time tools only, nothing ships in the app. Card scenes stay SVG; use those tools for motion design and store clips, not in-app video.
3. **Tab names:** Activity and You, or keep Transactions and More.
4. **Transaction detail:** add it as planned (recommended), or keep tap-to-edit.

## 7. Phases
1. **Foundations:** tokens (§2.2–2.4), the components in §2.5 and the paise rule. Rebuild the Ask FLO proposal card and Settings on them as a proving ground.
2. **Core loop:** Home, the Add sheet, Activity, Transaction detail.
3. **Onboarding:** the carousel, sign-up/sign-in, the reminder ask and the coach mark.
4. **Money screens:** Insights, Budgets, Bills (+ bill detail), Splits, Accounts, Categories.
5. **Moments and the rest:** celebrations, the bills-due sheet, Alerts, Streak, Ask FLO, Personalize, You, Pro.
6. **Polish:**
   - a light and dark pass;
   - TalkBack and the largest font size;
   - 48 dp targets;
   - reduced motion;
   - the phone check on the vivo I2220.

Each phase is one spec ticket group. The emulator check follows the per-ticket Tracer rules, and features carry over unchanged unless a ticket says otherwise.

## 8. Handoff for the spec session
Start a new chat and run `/mattpocock-skills:to-spec` for **Phases 1 and 2 only** (Foundations + Core loop), then `/mattpocock-skills:to-tickets`. Phases 3–6 stay here until they're reached. What that session needs to know:
- **Read first:** this document (all of it), `theme/ledger.js`, `components/ledger/`, `lib/dayScenes.js`, `app/dev/home-preview.js`, then `.claude/features/00-index.md` and specs 37, 38, 43 and 44 for what the current screens do.
- **Approach:** the ledger tokens and components live **beside** `theme/tokens.js` and the old components. Each screen moves over in its own ticket; nothing global is restyled in one go, so the app keeps working between tickets. When the last screen has moved, Manrope and the old tokens go in a cleanup ticket.
- **Every component and screen changes.** The spec must list each one from §2.5 and §4 with: what it replaces, which old file(s) it retires, and the feature flags it respects (`economy`, `plans`, `billing`, `splitInvites`, `currencyPicker`, plus new `accents`, off; `mascot` was dropped when Koban was deleted).
- **Built already (adopt, don't redo):** tokens, Inter, `AmountText`, `Button`, `HeaderIconButton`, `ListRow` (with `toneColors`), `QuickActions`, `SectionHeader`, `AccountCardCarousel`, `WeekLine`, the Day scenes and the Home preview. `WeekBars` was replaced by `WeekLine` and deleted.
- **Not built:** `ScreenHeader`, `PinnedFooter`, `Segmented`, `Chip`, `Callout`, `ProgressBar`, `Timeline`, `Illustration`, `EmptyState`, `Sheet`; Day as a catalog theme; `FLAGS.accents`; the paise rule app-wide.
- **Related specs:** 45 (account last 4, planned, one phase, not part of this spec; its card slot is already in `AccountCardCarousel`). Bill icons are §2.6, Phase 4.
- **Verification:** each ticket ends with a Tracer checklist; "Verified" means a check on the Pixel_API_36 emulator in light and dark mode, not a build.
