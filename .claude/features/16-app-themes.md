# Feature: App Themes (dynamic color themes + dark mode)

**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/16-app-themes.md`
**Status**: Phase 1 & 2 ✅ Complete — restructured into an accent x mode matrix 2026-07-18 (see §3)
**Last Updated**: 2026-07-18

---

## Context

FLO ships one visual identity today: brand lime (`#BBDC12`) on a light
background, defined once in `theme/tokens.js` and imported statically
everywhere. This feature lets a user pick from several color themes
(including a full dark mode) and have the whole app re-render in that
palette immediately, persisted across sessions and devices.

This is deliberately sequenced **ahead of** the gamification track
(`IDEAS-gamification.md`), not instead of it — that doc already specs a
paid/earned cosmetic economy for hero-card themes (rarity tiers, a day-100
chest-exclusive "Gold Card", dual-track IAP). That system needs a themeable
app to exist as plumbing before any of it can ship. Building the theme engine
now means gamification's card-theme layer gets built on top of working
infrastructure later, instead of needing its own foundational rewrite.

**The scope-defining finding** (from analysis before this doc): `theme/tokens.js`
is imported by **73 files**, and **67 of them call `StyleSheet.create()` at
module scope** — i.e. `const styles = StyleSheet.create({ backgroundColor:
colors.bg, ... })` sitting outside the component function, evaluated once at
import time. `StyleSheet.create` does not re-run when a value it referenced
changes later — this is a well-documented React Native limitation, not an
FLO-specific bug. So "click a theme and it applies" requires converting each
of those files' styling from a frozen module-level object to a value computed
from the active theme at render time. That conversion — not the palette
design — is the real cost of this feature, and it's mechanical but touches
most of the codebase. Phased accordingly below.

**Decisions locked in from planning conversation (2026-07-18)**:
- **5 initial themes, hand-authored, not generated.** Since the set is fixed
  and small, a Material-3-style generative color algorithm (seed color →
  seed HCT tonal ramp) is more machinery than this needs — 5 known palettes
  are simpler and more controllable as hand-tuned token objects. (Researched
  and rejected as overkill for this scope; see conversation.)
- **Semantic colors (income green / danger red / warn amber / streak orange
  / the alert-dot rose) stay identical across every theme.** They encode
  transaction *meaning*, not brand mood — nobody wants "over budget" to look
  different depending on which theme is active. Only identity/surface tokens
  vary per theme. Warm-hued accent choices are explicitly **not** avoided on
  principle (relaxed from an earlier stricter proposal) — pick what looks
  good per theme.
- **"Dark" is one of the five fixed theme slots**, not an independent
  light/dark toggle crossed with every accent. Simpler to build and simpler
  for a user to reason about; an accent × light/dark matrix is explicitly
  deferred (see Out of Scope).
- **Gating is entirely out of scope for this doc.** All themes ship free and
  ungated. Which (if any) become Pro-exclusive is a decision the user makes
  *after* seeing all of them live in the app — a separate follow-up once
  that's decided, mirroring how `14-subscription-pro.md` split "structure"
  (Phase 1) from "the gates" (Phase 2).

---

## Phase Overview

```
Phase 1 — The engine (Brand + Dark only)
  ThemeContext + useTheme() hook, AsyncStorage + profiles.theme persistence
  (mirrors AccountContext's dual-layer pattern), the theme picker in
  Settings, and converting every theme-dependent StyleSheet in the app to
  read from the active theme instead of a static import. Ships with exactly
  two themes — Brand (today's palette, unchanged) and Dark — because proving
  the switching mechanism correctly matters far more here than having a lot
  of palettes, and a partially-themed app (some screens react, some don't)
  would look broken, not "in progress". This is the expensive phase.

Phase 2 — The other four themes
  Ocean (blue), Violet (purple), Amber (gold/warm), Teal, and Pink — five
  candidate accent palettes total (the user asked to build more than the
  original three and prune after seeing them live). Pure palette-authoring:
  new token objects plus new entries in the theme picker's option list. Zero
  files need touching beyond that, because Phase 1 already made every
  screen read color through the theme hook. Ends with an on-device review
  where the user decides which of the 6 accent themes (5 new + keeping
  Violet) to keep, and separately, which (if any) to eventually gate to Pro.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — The engine (Brand + Dark)

### Goal

A user can open Settings, pick "Dark" from a Theme row, and the entire app —
every screen, every sheet, every chart — immediately re-renders in a
consistent dark palette. The choice persists across app restarts (instantly,
via a local cache) and across reinstalls/devices (via the profile). Existing
users see zero change until they actively pick something other than Brand
(which stays pixel-identical to today's palette).

### Before Starting — Confirm With Codebase

- **Enumerate which of the 67 `StyleSheet.create` call sites actually
  reference `colors.*`** (not just `spacing`/`radii`/`fontFamily`/`fontSize`,
  which aren't theme-variant and need no conversion). Some files may already
  be color-free and can be skipped — don't assume all 67 need touching.
- **Classify permanently-dark chrome vs. theme-reactive surfaces, file by
  file.** Not uniform: `ReportPeriodPicker`'s dialog card is light
  (`colors.surface`), while most bottom sheets (`MenuSheet`, `AddBudgetSheet`,
  `ProUpsellSheet`, etc.) hardcode `backgroundColor: colors.ink` as their own
  permanent chrome regardless of what the rest of the app looks like today.
  Decide, per file, whether it's (a) a light dialog/screen that should track
  the active theme, or (b) sheet chrome that's *already* unconditionally dark
  and should stay exactly as-is — converting it would be wasted work and a
  behavior change nobody asked for. `CurrencyPicker` already demonstrates a
  third case: a `dark` prop switching between both, deliberately.
- **Confirm the live `profiles` schema** via the Supabase MCP (`list_tables`)
  before writing the migration — last confirmed 2026-07-18 as `id`,
  `full_name`, `currency`, `created_at`, `avatar_url`, `onboarded_at`,
  `onboarding_answers`. No `theme` column yet.
- **Confirm `AccountContext`'s exact AsyncStorage-then-reconcile pattern**
  (`lib/AccountContext.js`) before building `ThemeContext` — this feature
  reuses that shape deliberately (instant local read on cold start, DB value
  reconciled once the profile loads), not a new pattern.
- **Confirm `useProfile().updateProfile`'s exact signature** (`hooks/useProfile.js`)
  — `15-currency-going-global.md`'s Settings currency picker already
  exercises this exact "write a profile column, refetch via `notifyChanged`"
  path; the theme picker follows the identical shape.

### 1.1 Database

```sql
-- 16-app-themes.md Phase 1
-- The cross-device/reinstall-durable theme preference. Mirrors
-- profiles.currency exactly (same default-and-degrade-gracefully shape).
alter table public.profiles
  add column if not exists theme text not null default 'brand';
```

No CHECK constraint — same reasoning as `currency`: the client only ever
writes a known key from the `THEMES` registry, and an unknown/stale value
degrades gracefully to the default via a `themeMeta`-style lookup, never a
crash. No RLS change (existing `profiles` policies already cover this
column). No view changes.

### 1.2 Data layer

- **`theme/themes.js`** (new) — the palette registry. `BRAND` re-exports
  `theme/tokens.js`'s existing `colors` object verbatim (guarantees the
  default theme is pixel-identical to today's app, by construction, not by
  careful re-typing of ~34 hex values). `DARK` is a new, fully-specified
  token object with the same key shape.
  ```js
  import { colors as BRAND_COLORS } from './tokens';

  // Keys that carry MEANING, not mood — identical across every theme.
  // Pulled from BRAND_COLORS once; every theme's color object spreads
  // these in last, so a theme definition can't accidentally drift on them.
  const SEMANTIC = {
    income: BRAND_COLORS.income,
    incomeBg: BRAND_COLORS.incomeBg,
    incomeAccent: BRAND_COLORS.incomeAccent,
    streak: BRAND_COLORS.streak,
    streakDeep: BRAND_COLORS.streakDeep,
    streakBg: BRAND_COLORS.streakBg,
    rose: BRAND_COLORS.rose,
    danger: BRAND_COLORS.danger,
    dangerStrong: BRAND_COLORS.dangerStrong,
    dangerBg: BRAND_COLORS.dangerBg,
    dangerBorder: BRAND_COLORS.dangerBorder,
    dangerTrack: BRAND_COLORS.dangerTrack,
    warn: BRAND_COLORS.warn,
    warnStrong: BRAND_COLORS.warnStrong,
    warnBg: BRAND_COLORS.warnBg,
    warnBorder: BRAND_COLORS.warnBorder,
  };

  export const THEMES = {
    brand: {
      id: 'brand',
      name: 'Brand',
      swatch: { bg: BRAND_COLORS.bg, accent: BRAND_COLORS.brand, ink: BRAND_COLORS.ink },
      colors: { ...BRAND_COLORS, ...SEMANTIC },
    },
    dark: {
      id: 'dark',
      name: 'Dark',
      swatch: { bg: '#101010', accent: BRAND_COLORS.brand, ink: '#F6F7F3' },
      colors: {
        ...BRAND_COLORS, // start from Brand, override only what must invert
        ...SEMANTIC,
        brand: BRAND_COLORS.brand, // same lime — already proven on dark
                                    // chrome throughout the app's own sheets
        bg: '#0B0B0B',
        surface: '#1B1B1B',
        ink: '#F6F7F3',            // primary text, now light-on-dark
        inkCard: '#242424',
        border: '#2A2A2A',
        borderSoft: '#232323',
        inputBg: '#1F1F1F',
        inputBorder: '#2A2A2A',
        chipBg: '#232323',
        iconTileBg: '#202020',
        muted: '#8f9389',
        mutedMid: '#9fa398',
        mutedLight: '#75786f',
        mutedDarker: '#c4c7bd',
        chevron: '#54564f',
        completedBg: '#1e1e1e',
        completedBorder: '#2a2a2a',
        completedTrack: '#2e2e2e',
      },
    },
  };

  export const DEFAULT_THEME_ID = 'brand';
  export const THEME_LIST = Object.values(THEMES);

  export function themeMeta(id) {
    return THEMES[id] ?? THEMES[DEFAULT_THEME_ID];
  }
  ```
  > **Design note on Dark's `muted*`/`chevron` values**: these are
  > *inverted*, not merely relabeled — a light-on-dark muted tone needs a
  > different lightness curve than a dark-on-light one for the same
  > perceived "quietness". Verify each against its actual usage (body text,
  > placeholder, disabled state) on-device before calling Phase 1 done; the
  > values above are a reasoned starting point, not gospel — see checklist.
  > **Dark chrome is intentionally NOT touched by this**: sheets/dialogs
  > already classified as "permanently dark" in the Before-Starting step
  > keep hardcoding `colors.ink`/`colors.surface` from `theme/tokens.js`
  > directly (today's literal values), not the active theme — they don't
  > change when the app theme changes, because they don't change *today*
  > either. Only files classified as theme-reactive read through `useTheme()`.

- **`theme/ThemeContext.js`** (new) — the provider + hook, structurally
  identical to `AccountContext`'s AsyncStorage-then-reconcile shape:
  ```js
  const STORAGE_KEY = 'flo.themeId';

  export function ThemeProvider({ children }) {
    const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
    const [hydrated, setHydrated] = useState(false);

    // Instant on cold start — same reasoning AccountContext's own
    // AsyncStorage read has: don't wait on a network profile fetch just to
    // paint the first frame in the right colors.
    useEffect(() => {
      AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
        if (stored && THEMES[stored]) setThemeId(stored);
        setHydrated(true);
      });
    }, []);

    const setTheme = useCallback((id) => {
      if (!THEMES[id]) return;
      setThemeId(id);
      AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
    }, []);

    const { colors } = themeMeta(themeId);

    return (
      <ThemeContext.Provider value={{ themeId, setTheme, colors, hydrated }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
  }
  ```
  Separately, once `useProfile()` resolves a signed-in user's `profile.theme`,
  a small sibling effect (same placement pattern as `RootNavigator`'s
  `introSeen` sync, or `OnboardingGate`) calls `setTheme(profile.theme)` to
  reconcile the DB value — this is what makes the choice follow the user
  across devices/reinstalls, not just this device's AsyncStorage cache.
- **Settings' theme picker writes `profiles.theme`** via
  `useProfile().updateProfile({ theme: id })`, the exact same call shape
  already proven by the Currency row in `15-currency-going-global.md`.

### 1.3 Components

```
theme/themes.js              NEW — palette registry (THEMES, themeMeta, THEME_LIST)
theme/ThemeContext.js        NEW — ThemeProvider, useTheme()
components/ThemePicker.js    NEW — Settings' theme row + dialog
```

- **`ThemePicker.js`** — modeled directly on `CurrencyPicker`'s `variant="dialog"`
  shape (`renderTrigger`, a centred `Modal`, the same overlay/card/header
  established by `ReportPeriodPicker`) — reused pattern, not a new dialog
  style. The one real difference: currency options are text rows; theme
  options need a **visual swatch** (a small circle/chip rendering that
  theme's `bg`/`accent`/`ink` trio) since color is the whole point of the
  choice — a text-only list would defeat the purpose. Tapping a theme calls
  `setTheme(id)` (instant local application) and `updateProfile({ theme: id })`
  (durable write) together, same `Promise.all` shape `onboarding/currency.js`
  already uses for its dual write.
- **The conversion**: every file identified in the Before-Starting step as
  theme-reactive changes from
  ```js
  const styles = StyleSheet.create({ card: { backgroundColor: colors.bg } });
  ```
  to
  ```js
  const makeStyles = (colors) => StyleSheet.create({ card: { backgroundColor: colors.bg } });
  // inside the component:
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  ```
  Mechanical, repeated per file. Do this in batches by directory
  (`components/` primitives first — `Card`, `Button`, `Pill`, `AmountText`,
  `IconTile`, `ProgressBar`, since most screens compose these — then
  `app/(tabs)/`, then the rest of `app/`, then remaining `components/`) so
  partial progress is at least reviewable in logical chunks, even though the
  phase doesn't ship until the full set is done (a half-converted app looks
  broken, not "in progress" — see Goal).

### 1.4 Navigation / integration

- **`app/_layout.js`** — mount `ThemeProvider` at the very top of
  `RootLayout`, **above/outside `AuthProvider`** — unauthenticated screens
  (sign-in, the pre-auth intro) also render through `theme/tokens.js` today
  and must stay theme-reactive too (they'll just always read the
  AsyncStorage-cached value, since there's no profile yet to reconcile
  against — same reasoning `introSeen`'s AsyncStorage flag already uses for
  device-local state ahead of auth).
- **`app/settings.js`** — the dead **"Appearance: Light"** row
  ([app/settings.js:365-370](app/settings.js#L365-L370)) becomes a working
  `ThemePicker`, same playbook as the Currency row's dead-row-to-live-picker
  conversion in Phase 2 of `15-currency-going-global.md`.

### 1.5 Impact on existing features

| Area | Impact | Watch for |
|---|---|---|
| Every theme-reactive file (subset of the 67) | `StyleSheet.create` becomes a per-render `useMemo` | Missing a file means that screen silently stays Brand-colored under Dark — a visible bug, not a crash, so it's easy to miss in review |
| Permanently-dark sheet chrome | **Unchanged** — still hardcodes today's literal `colors.ink`/`colors.surface` | Don't "fix" these into theme-reactivity by mistake — that's a scope and behavior change nobody asked for |
| `app/settings.js` | Dead Appearance row becomes a real picker | Copy/behavior mirrors the Currency row precisely |
| Unauthenticated screens (sign-in, pre-auth intro) | Also theme-reactive, via AsyncStorage only | No profile to reconcile against pre-auth — confirm no flash of the wrong theme on cold start |
| Existing/grandfathered users | Default to `'brand'`, zero visible change | Only diverges once a user actively picks something else |

### 1.6 What this phase does NOT include

- **Only two themes** (Brand, Dark) — the other four/five are Phase 2.
- **No Pro gating anywhere** — both themes ship free.
- **No new art** — this is pure token/color work, no icon or illustration changes.
- **No per-theme semantic color variation** — income/danger/warn/streak stay fixed (see Context).

### 1.7 Phase 1 checklist

- [x] `profiles.theme` column applied (default `'brand'`); confirmed via MCP.
- [x] `theme/themes.js` created; `BRAND` colors verified pixel-identical to current `theme/tokens.js` output (by construction — re-export, not re-type).
- [x] `theme/ThemeContext.js` created; `ThemeProvider` mounted above `AuthProvider` in `app/_layout.js`.
- [x] AsyncStorage read is instant on cold start (no flash of the wrong theme before the cached value applies); profile reconciliation happens once signed in (`ThemeProfileSync`).
- [x] `ThemePicker` built and wired into `app/settings.js`, replacing the dead Appearance row.
- [x] Every color-referencing `StyleSheet.create` in-scope (see Implementation Notes for the final scope) converted to the `makeStyles(colors)` + `useMemo` pattern.
- [x] Permanently-dark sheet chrome deliberately left untouched — see Implementation Notes for the full exclusion list.
- [x] On-device: switching Brand ↔ Dark in Settings re-colors the entire app — Home, Transactions, Budgets, Bills, Analytics, Report, Plans, Settings itself — with no screen left stuck in the other palette. Confirmed in Expo Go 2026-07-18; found and fixed several camouflage bugs in the process (see §1.9).
- [x] On-device: force-quit and reopen the app — the picked theme survives instantly (no flash), for both a signed-in and a fresh unauthenticated session.
- [x] Dark theme's text/muted/border values individually reviewed for legibility — the initial pass had two real contrast bugs (Home's hero-card text, `income` green reading muddy on near-black); both fixed and re-confirmed on-device, see §1.9.

**→ Phase 1 approved 2026-07-18. Proceeding to Phase 2.**

### 1.8 Implementation Notes (deviations from the plan above)

**Scope narrowed further than the Before-Starting audit anticipated:**
- **`app/onboarding/**` entirely excluded**, not just individually classified.
  Theme is only ever chosen from Settings, which is reachable exclusively
  *after* onboarding completes — no onboarding screen can be showing a
  non-Brand theme, so converting them would be dead code paths, not a
  correctness gap.
- **`app/pro.js` excluded**, same reasoning as the sheets below — it's its
  own fixed dark marketing surface, not a theme-reactive screen.
- **All bottom sheets excluded and left exactly as originally
  hardcoded**: `AddTransactionSheet`, `AddBudgetSheet`, `AddPlanSheet`,
  `AddBillSheet`, `PayBillSheet`, `AddCategorySheet`, `AddAccountSheet`,
  `EditProfileSheet`, `MenuSheet`, `AlertsSheet`, `AccountSwitcherSheet`,
  `ProUpsellSheet`. These keep their permanent dark chrome unconditionally —
  exactly what the doc's Before-Starting step called for — but they still
  benefit *indirectly* from Phase 1, since the shared primitives they
  compose (`Button`, `Pill`, `IconTile`, etc.) are now theme-reactive where
  it's safe (e.g. a sheet's primary-action button fill follows the active
  theme's accent even though the sheet's own background doesn't).
  **Superseded 2026-07-18 — see §1.10**: on user review this exclusion felt
  like themes were only skin-deep ("extensions of light mode with a
  different color"), so the accent (not the dark chrome) was extended into
  every sheet plus `app/pro.js`. The exclusion reasoning above still holds
  for *why the dark chrome itself* stays fixed — only the accent scope
  changed.

**A finer-grained rule emerged than the doc's per-file binary
(theme-reactive file vs. permanently-dark file).** In practice, many
otherwise theme-reactive files still contain individual pinned surfaces —
most commonly a `<Card dark>` emphasis block (hero balance, plan/budget
summary cards) or a small "New X" / "Mark Paid" solid chip
(`backgroundColor: colors.ink` + white/lime text). Converting the whole file
to `useTheme()` but leaving those specific properties reading the *active*
theme would make Dark theme invert them incorrectly, since Dark's `ink`
value is semantically light (not dark). The rule applied file-by-file:
- Import `{ colors as staticColors }` from `theme/tokens.js` **in addition
  to** `useTheme()` in any file that has at least one pinned-dark surface.
- Anything sitting on a `<Card dark>` block, or forming a pinned-dark
  chip/button in its own right, reads from `staticColors`.
- Everything else in the same file reads from `useTheme().colors` as normal.
- The one recurring exception: a pinned-dark surface's *accent* color
  (e.g. `remainingDark` text on a dark plan card, a `TrendingDown` icon on
  the dark report headline card, `ProgressBar`'s `healthy` status fill) is
  deliberately left theme-reactive — the accent is meant to always reflect
  whichever theme is active, even on an otherwise-pinned dark surface.
- Selected/active UI states that aren't "emphasis" surfaces (segmented
  control active tabs, category-type toggle, report cadence chips) were
  deliberately left theme-reactive rather than pinned, since they're plain
  chrome that should blend with whichever screen they're on, not a branded
  CTA.
- `components/CurrencyPicker.js` needed both halves in one file: its
  `dialog` variant (Settings only) is theme-reactive; its `inline` variant
  and `dark` prop (only ever used inside the excluded sheets) stay fully
  pinned to `staticColors`.

**Converted file list (final), by area:**
- Primitives: `Card`, `Button`, `Pill`, `AmountText`, `IconTile`,
  `ProgressBar`, `Switch`, `Skeleton`, `TabBar`, `Screen`.
- Tabs: `app/(tabs)/index.js`, `transactions.js`, `budgets.js`.
- Pushed screens: `app/settings.js`, `app/report.js`, `app/analytics.js`,
  `app/plans.js`, `app/bills.js`, `app/budget/[id].js`,
  `app/plan/[id]/index.js`, `app/plan/[id]/history.js`,
  `app/manage-categories.js`, `app/streak.js`, `app/sign-in.js`.
- Light dialogs/components: `ReportPeriodPicker`, `CurrencyPicker` (dialog
  path), `DonutChart`, `DayOfWeekChart`, `IncomeExpenseChart`,
  `ReportReadyCard`, `DueBillsModal`, `AnalyticsFilterBar`.
  `AnalyticsSegmentTabs` needed no change — it has no direct color
  references, only `Pill` (already theme-reactive) and `spacing`.

### 1.9 On-device fix round (2026-07-18)

The first Expo Go pass surfaced three real bugs the syntax-check couldn't
have caught, because they're about which *specific* color a token resolves
to under Dark theme, not whether the code runs. All three are fixed and
re-confirmed on-device.

**1. Emphasis cards blended into the screen.** `Card`'s `dark` prop (and
every hand-rolled equivalent — Transactions' summary card, the "New Budget/
Plan/Bill"/"Mark Paid" chip buttons) was pinned to a static near-black
(`#101010`). That's correct on Brand's white screen but nearly identical to
Dark theme's own screen background (`#0B0B0B`) — the card just disappeared.
Fixed by adding a `colors.emphasisBg` token each theme owns: Brand keeps
`#101010` (pixel-identical, per the original invariant); Dark was first set
to an elevated `#242424`, then — per user direction, since these cards will
eventually carry their own illustrations/themes from the gamification track
— simplified to just match `colors.surface` (`#1B1B1B`) like every other
card, rather than inventing a separate "elevated" shade as a placeholder.

**2. Home's hero-card text was reading the wrong pin.** Every *other*
`Card dark` block (Budget/Plan detail, Transactions) had its sitting text
correctly pinned to `staticColors.*` per the §1.8 rule. Home's hero card
(`app/(tabs)/index.js`) was missed during the original conversion pass —
`accountName` and `heroStatValue` (literally the income/expense figures)
were still reading the *active* theme's `colors.surface`, which Dark theme
inverts to a dark gray — dark text on a dark card, invisible. Fixed, plus
the same gap on the "Manage" pill background, loading skeletons, and the
avatar-initial text (which had the mirror-image version of this bug: reading
`colors.ink`, which Dark theme inverts to *light*, sitting on the
still-lime-colored avatar background).

**3. `income`/`incomeAccent` were too dark against Dark theme.** These
were originally left in the fully-locked `SEMANTIC` set (same value in every
theme, per the doc's original principle). On-device, Brand's medium-dark
olive (`#5f8a15`/`#7B8B0C` — tuned for contrast against white) read as muddy
on Dark theme's near-black screen — the Received summary card, income
category icons, and the `IconTile`/`Pill` "income" tone all inherited this.
Moved `income`/`incomeAccent` out of `SEMANTIC` (only `danger`/`warn`/
`streak` and their Strong/Deep variants stayed locked — those read fine
as-is) and gave Dark theme its own brighter values. Three module-scope
`STATUS_COLOR`/`STATUS_STYLES` constants (`app/report.js`,
`app/analytics.js`, `app/(tabs)/budgets.js`) had pinned `income` to the old
static value specifically because module scope can't call `useTheme()` —
moved inside their components, same fix already applied to `bills.js`.

A first pass leaned the brightened values toward the brand lime
(`#C7E23D`/`#AECB1D`) — on-device that read as too close to `colors.brand`
itself (blurring "this is the app's identity color" with "this transaction
is income"), and the paired `incomeBg` (`#233A0F`) still read as too dark.
Revised to a true light emerald green, clearly its own hue rather than a
lime variant, with a lighter `incomeBg` to match: `income: '#3ADD9A'`,
`incomeAccent: '#22C58A'`, `incomeBg: '#1E4534'`. Contrast checked against
both the card background (`#1B1B1B`) and `incomeBg` itself: `income` is
9.83:1 / 6.13:1, `incomeAccent` is 7.73:1 / 4.82:1 — both clear the 4.5:1
body-text bar even sitting directly on `incomeBg`.

**Also fixed while in the area (not contrast bugs, but the same
"washed-out on dark" family the user flagged):**
- `IconTile`'s `brand` tone used a runtime `rgba(brand, 0.16)` alpha blend,
  which composites against whatever's behind it — over Dark theme's
  near-black screen that math produces a barely-visible smudge, not a tint.
  Replaced with `colors.brandBg`, a solid color each theme authors directly.
  `dangerBg`/`warnBg`/`streakBg` and their `Border`/`Track` siblings got the
  same "own dark-tuned tint instead of the pale pastel" treatment (these
  feed every `Pill` and status `IconTile`, so fixing the tokens fixed every
  call site at once).
- `Pill`'s `dark` tone (the selected-state pill in Report's account tabs,
  Transactions' type filter, `AnalyticsSegmentTabs`) had the same pinned-
  near-black bug as the cards — it's plain UI chrome, not a branded
  emphasis surface, so it was made theme-reactive instead of pinned,
  matching how the equivalent segmented-control styles elsewhere already
  behave.
- The ⊕ tab-bar button's icon and Home's avatar-initial text were reading
  the active theme's `colors.ink` while sitting on a surface that stays the
  *same* accent color regardless of theme — pinned to `staticColors.ink`
  instead, matching Button's existing primary-text convention.

**Investigated, not a bug**: a report of "3 budget cards for 1 budget" in
Analytics. Confirmed via the database exactly one budget row exists; the
budget is a *weekly*-period budget, and Analytics' month view correctly
renders one progress row per week that budget has run (`computeBudgetPeriods`
in `lib/analytics.js`) — 2–3 rows inside one card, easy to mistake for
separate cards at a glance, not a duplication bug.

**`ThemePicker`'s swatch was redesigned** (not a bug fix, a UX request):
each option now shows a small circular "palette wheel" (`ThemeSwatch` in
`components/ThemePicker.js`, built with `react-native-svg`) instead of a
bordered circle with a center dot — top hemisphere = `swatch.bg` (the color
that actually dominates the real screen), bottom-left quarter =
`swatch.accent`, bottom-right quarter = `swatch.ink`. Area on the swatch
tracks real screen footprint, the same idea Android/Material-You theme
pickers use. The selected option also gets a colored ring around its swatch.

**A second round of color tuning on `income`/`incomeAccent`** (still
Dark theme only): the first fix (§ above) leaned toward the brand lime,
which on-device blurred "this is the app's identity color" with "this
transaction is income." Revised to a true light green (`#4ADE80`/
`#22C55E`), going through an intermediate emerald (blue-green) pass that
also got rejected as not the plain "positive/money green" the rest of the
app already uses. `incomeBg` was retuned to match each time. Also on
further feedback, Dark theme's `surface` (and `emphasisBg`, which mirrors
it) was darkened from `#1B1B1B` to `#161616` — the first value read as too
gray/bright for a card sitting on a near-black screen.

### 1.10 Scope expansion: sheets now follow the accent too (2026-07-18)

On-device review of the color work above surfaced a bigger structural
complaint: picking a theme only affected pushed screens — every bottom
sheet (Add Transaction, Menu, Pro/Subscription, etc.) and `app/pro.js` kept
showing brand lime regardless of the active theme, since §1.8 deliberately
excluded them. This made the themes feel like "extensions of light mode
with a different color" rather than something that actually reaches the
whole app. Two decisions were needed before touching more code:

1. **Should sheets start following the active theme?** Yes — but only the
   *accent* (buttons, selected states, icons that represent the app's
   identity color), not the sheets' own permanently-dark background. A
   sheet's dark chrome is a legitimate, common design choice independent of
   the app's light/dark theme (plenty of apps use permanently-dark modal
   sheets even in light mode) — the complaint was specifically about lime
   not changing, not about sheets needing to go light under a light theme.
2. **Should each of the 5 Phase-2 accent themes also get its own dark
   variant** (an accent × light/dark matrix), given the app is clearly not
   "all light except Dark" once sheets stay dark-chromed regardless of
   theme? No — kept to one Dark theme, matching the original Phase 2 §2.5
   "Out of Scope" call. Revisiting this only doubles the palette-authoring
   and QA cost the doc already reasoned through; nothing about the sheet
   work below changes that trade-off.

**Converted** (same `makeStyles(colors)` pattern, `colors` as `staticColors`
for everything except the accent spots): `AddTransactionSheet`,
`AddBudgetSheet`, `AddBillSheet`, `PayBillSheet`, `AddCategorySheet`,
`EditProfileSheet`, `MenuSheet`, `AlertsSheet`, `AccountSwitcherSheet`,
`ProUpsellSheet`, `ProBenefits` (shared between `ProUpsellSheet` and
`app/pro.js`), and `app/pro.js` itself. `AddPlanSheet` and `AddAccountSheet`
needed no changes — neither has any direct brand-color reference; both
already inherit theming through the shared primitives (`Button`, `Switch`,
`CurrencyPicker`) they compose.

**Mechanical gotcha, hit repeatedly**: several of these sheets define a
second, smaller component at module scope above the main sheet component
(`AccountField` in `AddTransactionSheet`, `AccountCard` in
`AccountSwitcherSheet`) that reads the shared `styles` object by closure.
Once `styles` moved from a module-level `StyleSheet.create` to a
component-scoped `useMemo`, those sibling components lost access to it —
fixed by threading `styles` through as an explicit prop at each call site,
rather than also converting the sibling into its own `useTheme()` consumer
(neither one needs reactive colors itself, only the shared style lookups).

**Also swept up while touching every sheet's accent**: a handful of
already-pinned `staticColors.brand` spots survived from *earlier* Phase 1
work — the "New Budget/Bill/Plan" button icons and `CurrencyPicker`'s
inline-variant selected-currency checkmark (used inside the now-reactive
`AddAccountSheet`/`AddBillSheet`). These were pinned under the original
"permanently-dark chip" convention, but they're accent indicators sitting
on an otherwise-neutral surface, not brand chrome in their own right — same
category as `ProgressBar`'s healthy-status fill — so they were flipped to
reactive too.

**Not extended**: `app/onboarding/**` stays excluded (same reasoning as
§1.8 — unreachable before a theme choice exists). Sheets' own background,
borders, and non-accent text stay pinned exactly as before — only the
accent moved.

**→ Phase 1 approved 2026-07-18 (including the 1.10 scope expansion). Proceeding to Phase 2.**

---

## Phase 2 — The other four (five) themes

### Goal

Five additional accent-based themes exist alongside Brand and Dark:
**Ocean** (blue), **Violet** (purple), **Amber** (gold/warm), **Teal**, and
**Pink**. All ship free and ungated, selectable from the same `ThemePicker`.
This phase is intentionally over-built (5 candidates, not a final 3) so the
user can compare them live on-device and prune before any of them are
treated as permanent or considered for a Pro gate.

### Before Starting — Confirm Phase 1 is Approved

Phase 1's conversion must already be complete and working for Brand/Dark —
this phase adds zero new file conversions, only new palette data plus
picker entries. If any screen was still Brand-locked at the end of Phase 1,
fix that first; don't let it compound across 5 more themes.

### 2.1 Database

None.

### 2.2 Data layer

Five more entries in `theme/themes.js`'s `THEMES` object, same shape as
`dark` (spread `BRAND_COLORS` + `SEMANTIC`, override `brand`/`bg`/`surface`/
`ink`/`border`/neutrals as needed per theme). Unlike Dark, these stay
**light-mode** — most of the neutral scale (`bg`, `surface`, `border`,
`muted*`, `chevron`, `completed*`) can likely reuse Brand's existing light
values unchanged; only the accent (`brand`) and a couple of accent-derived
tints genuinely need new values per theme. This is the cheap-to-author case
the Phase 1/2 split was designed around.

Exact hex values are a design pass at implementation time (informed by the
2026 UI trend toward slightly desaturated accents over pure-saturated ones,
and WCAG AA contrast checked per theme — 4.5:1 body text, 3:1 large
text/UI — same bar Phase 1's Dark theme needs to clear). Starting hue
directions, not final values:

| Theme | Accent direction | Personality |
|---|---|---|
| Ocean | Blue | Calm, trustworthy — the classic fintech signal |
| Violet | Purple | Premium, modern |
| Amber | Gold / warm | Wealth-coded warmth, leans into "money" rather than away from it |
| Teal | Teal/cyan | Fresh, modern, distinct from both Ocean's blue and the income green |
| Pink | Pink/rose | Warm, friendly — kept deliberately distinct in *tone* from the reserved danger-red even though both are warm hues |

### 2.3 Components

No new files. `ThemePicker`'s option list (`THEME_LIST`) grows from 2 to 7
entries automatically — it already renders from the registry, not a
hardcoded list.

### 2.4 Impact on existing features

| Area | Impact | Watch for |
|---|---|---|
| `ThemePicker` | 5 more options in the same dialog | Swatch previews must stay legible at small size across all 7 |
| Nothing else | Zero — no file outside `theme/themes.js` and the picker's own option count changes | This is the payoff of Phase 1's cost: Phase 2 is genuinely this small |

### 2.5 What this phase does NOT include

- **No final decision on which themes survive.** All 5 ship; pruning some
  after on-device review is expected and fine — deleting a theme later is
  just removing an object from the registry, zero migration cost (nobody's
  data references a theme id anywhere except `profiles.theme`, and a stale
  id degrades gracefully to Brand via `themeMeta`'s fallback).
- **No Pro gating decision.** Explicitly deferred to the user, after seeing
  all themes live — a separate follow-up, not part of this doc.
- **No accent × light/dark matrix** (e.g. "Ocean, but dark"). Each theme is
  one fixed combination; combining every accent with a dark variant would
  roughly double the palette-authoring and QA cost for a feature whose value
  is mostly "pick a mood", not exhaustive coverage. Revisit only if real
  usage specifically asks for it.

### 2.6 Phase 2 checklist

- [x] Ocean, Violet, Amber, Teal, Pink added to `theme/themes.js`. Each is a light theme inheriting Brand's full neutral scale unchanged (bg/surface/border/muted*/income family etc. — those were only tuned for Dark, not needed again here) with just `brand` (accent) and `brandBg` (its pale icon-tile tint, computed the same 16%-over-white way Brand's own was) overridden. `emphasisBg` stays Brand's `#101010` for all five — same "black hero card pops on a light screen" logic. Contrast checked programmatically against the pinned-black-text convention every accent sits under (Button primary, avatar initial, etc.): Ocean 5.69:1, Violet 5.89:1, Amber 8.96:1, Teal 8.40:1, Pink 6.70:1 — all clear the 3:1 UI-element bar comfortably (Brand lime is 12.10:1 for reference).
- [x] All 7 themes selectable — `THEME_LIST` is `Object.values(THEMES)`, so `ThemePicker` picks up the 5 new entries automatically with no code change (confirmed via a Node harness loading the registry directly: 7 themes resolve, no missing color keys on any of them).
- [ ] On-device: cycle through all 7 themes across Home, a sheet (e.g. Add Transaction), and a chart-heavy screen (Analytics) — confirm nothing looks broken or illegible in any of them. **Not yet run — needs a device/emulator pass.**
- [ ] User has reviewed all 5 accent candidates live and decided which (if any) to remove from the set, and separately, which (if any) to flag for a future Pro gate. **Pending the on-device pass above.**

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

```
profiles.theme (text, default 'brand')
        │
        ▼
theme/themes.js — THEMES[id] → { colors: {...} }
        │
        ▼
theme/ThemeContext.js — ThemeProvider / useTheme()
        │
        ▼
every theme-reactive component reads useTheme().colors
at render time via useMemo(() => makeStyles(colors), [colors])
```

### `profiles` — Schema (this feature's addition)
| Column | Type | Notes |
|---|---|---|
| `theme` | text | `NOT NULL DEFAULT 'brand'`. Unknown/stale values degrade to `'brand'` client-side via `themeMeta()`, never enforced by a DB constraint. |

No new tables, no new views — this is entirely a client-side rendering
concern layered on one new profile column, consistent with FLO's
everything-derived philosophy (nothing about a theme is financial data).

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Every screen/component with a color-referencing `StyleSheet.create` | Converted to read the active theme at render time | Phase 1's file-by-file audit and conversion |
| Permanently-dark sheet/dialog chrome | None — deliberately excluded | Classify correctly during the audit; don't over-convert |
| `app/settings.js` | Dead "Appearance: Light" row becomes a real picker | Same shape as the Currency row precedent |
| `IDEAS-gamification.md`'s future card-theme economy | Gains its foundational plumbing for free | No action now — just don't build a second, incompatible theming mechanism when that track picks up |
| `IDEAS-subscription-and-store.md`'s "themes are Pro-gateable" note | Not contradicted — gating is deferred, not decided against | Revisit once Phase 2's on-device review is done |

---

## Phase 3 — Restructured into an accent x mode matrix (2026-07-18)

### Goal

Replace the 7 flat themes (Brand, Dark, Ocean, Violet, Amber, Teal, Pink)
with two independent choices: an **accent** (which color) and a **mode**
(Light or Dark). Any accent can now pair with either mode — originally 6
accents (Lime, Ocean, Violet, Amber, Teal, Pink) × 2 modes = 12
combinations, generated from 8 definitions instead of hand-authored one at
a time; a 7th accent (Hot Rod, named Ember until a 2026-07-18 rename) was
added in the §3.7 fix round, making it 7 × 2 = 14. User-driven:
on-device review of Phase 1/2 surfaced that light-mode accent themes and
Dark were only superficially related (Dark changes the whole neutral scale;
the light accents only ever changed one color), and the user proposed
decomposing them properly instead of continuing to add flat combinations.

### 3.1 Database

```sql
-- 16-app-themes.md — splitting the single `theme` column into two
-- independent axes: theme_accent (which color) and theme_mode (light/dark).
alter table public.profiles
  add column if not exists theme_accent text not null default 'lime',
  add column if not exists theme_mode text not null default 'light';

-- Backfill existing single-column values: 'brand' -> lime+light,
-- 'dark' -> lime+dark, any Phase-2 accent id (ocean/violet/amber/teal/pink)
-- -> that accent + light (all Phase-2 themes were light-only).
update public.profiles
set theme_accent = case when theme in ('brand', 'dark') then 'lime' else theme end,
    theme_mode = case when theme = 'dark' then 'dark' else 'light' end;

alter table public.profiles
  drop column if exists theme;
```

Applied and backfilled via Supabase MCP 2026-07-18; verified all 3 existing
profiles landed correctly (`brand` → `lime`/`light`, both `dark` rows →
`lime`/`dark`). No CHECK constraint, same reasoning as the original `theme`
column — an unknown/stale value degrades gracefully client-side.

### 3.2 Data layer

`theme/themes.js` rewritten around three exports instead of one flat
registry:

- **`MODES`** (`light`, `dark`) — everything that ISN'T the accent: the full
  neutral scale (bg/surface/ink/border/muted\*/chevron/completed\*), the
  income family, and the danger/warn/streak `*Bg`/`*Border`/`*Track` tint
  family. `light` is Brand's original palette verbatim (pixel-parity
  preserved); `dark` is exactly what Dark theme already was.
- **`ACCENTS`** (`lime`, `ocean`, `violet`, `amber`, `teal`, `pink`) — just
  three keys each: `brand` (the color), `brandBg` (its pale tint, for an
  icon tile on a light-mode-following card), `brandBgDark` (its dark tint,
  for an icon tile on a surface that's dark regardless of mode — Plans'
  `Card dark` block). These three keys already existed per-theme from the
  Phase-1.10 sheet-scope-expansion work, so this was a re-slice of existing
  data, not new palette authoring.
- **`resolveColors(accentId, modeId)`** — merges `MODES[modeId].colors` +
  `SEMANTIC` (still fully locked, unchanged) + the accent's `brand`/
  `brandBg`/`brandBgDark` on top. One subtlety: `brandBg` (IconTile's
  default, mode-*following* brand tone) has to track the active mode —
  `accent.brandBg` under light mode, `accent.brandBgDark` under dark mode —
  or a brand-tone icon tile on an ordinary dark-mode card would wash out
  exactly like the original Dark-theme bug. `brandBgDark` itself stays the
  dark tint unconditionally, for `IconTile`'s `onDark` prop specifically
  (a surface that's dark independent of mode).

Verified programmatically: all 12 accent×mode combinations resolve with
every expected color key present, and `resolveColors('lime', 'light')` is
byte-for-byte identical to `theme/tokens.js`'s static export (the
pixel-parity invariant, preserved through the restructuring).

### 3.3 Context layer

`theme/ThemeContext.js`: `themeId`/`setTheme` replaced with `accentId`/
`modeId`/`setAccent`/`setMode` — two independent pieces of state, two
AsyncStorage keys (`flo.themeAccent`, `flo.themeMode`) instead of one
(`flo.themeId`). `colors` is now computed via `resolveColors(accentId,
modeId)` each render rather than a registry lookup. `ThemeProfileSync`
(`app/_layout.js`) reconciles both DB fields independently, same
no-op-when-already-agreeing behavior as before.

Devices with the old `flo.themeId` AsyncStorage key (pre-restructuring
installs) fall through to the default (lime/light) on next cold start until
`ThemeProfileSync` reconciles from the DB profile a beat later — an
acceptable, self-healing transient given the small user base at this stage;
no explicit legacy-key migration was written.

### 3.4 Components

```
components/ColorPicker.js        NEW — replaces ThemePicker.js. Same dialog shape,
                                  repointed at ACCENT_LIST. Swatch reused from the old
                                  ThemeSwatch (top hemisphere = brand, bottom-left =
                                  brandBg, bottom-right = brandBgDark — same area-
                                  proportional idea, re-mapped from the old bg/accent/ink
                                  trio since an accent no longer implies a bg or ink).
components/AppearanceToggle.js   NEW — light/dark is only 2 options, doesn't need a
                                  dialog. Compact inline segmented control (same shape as
                                  Settings' own Reports-cadence segments), placed directly
                                  in the Settings "Appearance" row.
components/ThemePicker.js        REMOVED.
```

`app/settings.js`: one "Appearance" row → two rows, "Primary Color" (opens
`ColorPicker`) and "Appearance" (inline `AppearanceToggle`, no dialog).
`handleThemeChange` split into `handleAccentChange`/`handleModeChange`, each
writing its own profile column.

### 3.5 What this phase does NOT include

- **No new accent colors.** Still the same 6 (Lime, Ocean, Violet, Amber,
  Teal, Pink) — this phase is a restructuring, not a palette expansion.
- **No legacy AsyncStorage-key migration.** See §3.3.
- **No Pro gating decision.** Still entirely deferred, unchanged from
  Phase 2.

### 3.6 Phase 3 checklist

- [x] `profiles.theme_accent`/`theme_mode` columns applied and backfilled; confirmed via MCP.
- [x] `theme/themes.js` rewritten as `MODES` + `ACCENTS` + `resolveColors()`; all combinations verified programmatically (complete color keys, `lime`+`light` pixel-identical to the static tokens).
- [x] `theme/ThemeContext.js` and `app/_layout.js`'s `ThemeProfileSync` updated to track/reconcile `accentId`/`modeId` independently.
- [x] `ColorPicker.js` and `AppearanceToggle.js` built; `ThemePicker.js` removed; `app/settings.js` updated to two rows.
- [x] On-device: mode switching tried — surfaced the four issues in §3.7, now fixed.

### 3.7 On-device fix round (2026-07-18)

**Flicker on mode toggle** — not from the color change itself.
`useProfile().updateProfile()` calls `notifyChanged()` on every successful
write, which bumps `DataRefreshContext`'s global version counter — every
data hook in the app (transactions, budgets, plans, bills, alerts, …)
subscribes to it and refetches. Writing `theme_mode`/`theme_accent` through
the normal path meant every toggle triggered a full app-wide data refetch
at the same instant as the color swap. Added an opt-in `silent` flag to
`updateProfile(fields, { silent: true })` that skips `notifyChanged()` but
still optimistically patches the local `profile` cache directly (needed —
`ThemeProfileSync` compares `profile.theme_accent`/`theme_mode` against the
live context every render, and a stale cached value would make it think the
DB disagrees with the change just made and revert it). Settings' accent/mode
handlers now pass `{ silent: true }`.

Also found and fixed a real, if smaller, contributor: `ThemeContext`'s
`colors` was rebuilt via `resolveColors()` (a fresh object every call) on
*every* `ThemeProvider` render, not just real accent/mode changes — since
object identity changes even when the underlying value doesn't, every
consumer's own `useMemo(() => makeStyles(colors), [colors])` was
invalidating on any re-render bubbling through the tree, not only genuine
theme toggles. Wrapped both `colors` and the context value object itself in
`useMemo`, keyed on `[accentId, modeId]` — reference stability is more than
a micro-optimization here; the amount of avoided recompute across ~40
theme-reactive files is what "smoothness" during a toggle actually measures.

**Sun/moon icons** — `AppearanceToggle` now renders `lucide-react-native`'s
`Sun`/`Moon` next to each segment's label, not just text.

**A 7th accent, Hot Rod** — a true vermillion (`#E3411C`), added because
`streak` (`#FF6B2C`) and `danger` (`#E5484D`) already occupy the "orange"
and "red" ends of this same warm hue neighborhood, and a naive "between
orange and red" pick collides with one or the other by hue alone.
Differentiated on two axes instead of hue alone: `danger` carries real blue
(B=77, reading pink-red) where this carries almost none (B=28, reading
orange-red); `streak` is bright and fully saturated (L=59%, S=100%) where
this sits deeper and slightly less saturated (L=50%, S=78%) — an ember,
not an open flame. Contrast against the pinned-black-text convention every
accent needs is 4.57:1 (lower than the other six, 5.69–8.96:1, but still
clears the 3:1 UI-element bar) — an inherent tradeoff of choosing a
deliberately darker, richer hue over a bright one. Named "Ember" at launch;
renamed to "Hot Rod" 2026-07-18 (id changed `ember` → `hotrod`, migrated on
the 2 profile rows that had already picked it).

**Switch thumb showing a visible ring/"inner circle"** — two rounds. First,
`Switch.js`'s thumb specified both `shadow*` (iOS) and `elevation` (Android)
props together unconditionally; even though each platform is supposed to
ignore the other's prop, specifying both on the same element can still get
partially double-applied (Fabric's own shadow layer plus native elevation) —
split via `Platform.select` so each platform only ever receives its own
prop. That fixed the enabled state but not the reported issue, which turned
out to be specific to the **disabled** state: Android's `elevation` shadow
is its own native compositing layer, independent of the parent
`Pressable`'s `opacity: 0.45` disabled-dimming — the thumb's white fill
faded to 45%, but its shadow stayed at full strength, leaving a
full-opacity dark ring around a now-pale thumb. Fixed by not casting a
shadow on the thumb at all when `disabled` — simpler and more reliable than
fighting Android's opacity/elevation compositing.

### 3.8 Follow-up: the `silent` fix regressed selection entirely (2026-07-18)

The §3.7 flicker fix introduced a worse bug: picking a new accent or mode
stopped visibly applying at all — the picker kept showing the old selection
until the app was force-quit and reopened, at which point the DB value
(which HAD actually saved) finally showed up.

Root cause: `useProfile()` is a plain hook, not a shared/context one — every
call site (Settings.js, and `ThemeProfileSync` in `app/_layout.js`) gets its
OWN independent `profile` state, kept in sync only by everyone reacting to
`DataRefreshContext`'s shared `version` counter via `notifyChanged()`. The
`silent` flag deliberately skips that broadcast for theme writes — which
means `ThemeProfileSync`'s own copy of `profile` never refetches when the
user picks something in Settings. Its reconciliation effect had
`accentId`/`modeId` in its dependency array, so it re-ran on every local
selection, compared the just-picked value against its own stale
`profile.theme_accent`/`theme_mode`, saw a "disagreement", and immediately
called `setAccent`/`setMode` right back to the old value — a silent revert
one React commit after the user's own tap, invisible as a "flash" but
functionally identical to the selection never having happened.

Fixed by removing `accentId`/`modeId` from that effect's dependency array
(deliberate, annotated with `eslint-disable-next-line
react-hooks/exhaustive-deps`, matching the pattern `RootNavigator` already
uses for a similar case). The effect now depends only on `profile` itself —
it reconciles when a genuine refetch happens (cold start, sign-in, or some
unrelated `notifyChanged()` picking up a change made on another device),
not in response to the very local-state change it exists to avoid fighting.

**→ Stop here. Show the result and wait for approval.**

### 3.9 Follow-up: theme leaked across accounts on sign-out/sign-in (2026-07-18)

Reported: switching signed-in accounts on the same device briefly showed the
PREVIOUS user's accent/mode before settling on the new user's own.

Root cause: `ThemeContext`'s AsyncStorage cache (`flo.themeAccent`/
`flo.themeMode`) is device-local, not scoped per user — by design, since
`ThemeProvider` is mounted above `AuthProvider` specifically so pre-auth
screens (sign-in) are theme-reactive too, which means it can't read
`useAuth()` itself. On sign-in, the cached values from whoever last used the
device rendered immediately, and only flipped to the correct ones once the
newly-signed-in user's own profile fetch resolved and `ThemeProfileSync`'s
reconciliation effect (§3.7/§3.8) ran — the gap between those two moments
was the "split second" flash.

Fix follows the precedent already established by `AccountContext.js` for
the exact same class of bug (its own `activeAccountId` cache): reset to a
neutral state the instant the signed-in user changes, before trying to
resolve the new user's real value. `ThemeProfileSync` (which IS inside
`AuthProvider`, unlike `ThemeProvider` itself) now also calls `useAuth()`,
tracks the previous `session.user.id` in a `useRef`, and — when it detects
the id has changed — immediately calls `setAccent(DEFAULT_ACCENT_ID)` /
`setMode(DEFAULT_MODE_ID)` before the existing profile-reconciliation effect
has a chance to run. That existing effect then takes over once the new
user's `profile` arrives, same as always.

**→ Stop here. Show the result and wait for approval.**

---

## Out of Scope (All Phases)

- **Pro gating of any theme** — ships free; the user decides which (if any)
  to gate afterward, as its own follow-up.
- **A generative/arbitrary color picker** (Material-3-style seed-color →
  algorithmic palette). Rejected for this scope: 5–7 known, hand-tuned
  themes don't need a generator, and building one would be solving a
  problem this feature doesn't have.
- ~~**Accent × light/dark as an independent matrix.** Each theme is one
  fixed combination (see Phase 2 §2.5).~~ **Superseded 2026-07-18 — see
  §3.** On reflection this was the more natural structure all along: an
  accent (which color) and a mode (how bright the screen is) are genuinely
  orthogonal, and generating the matrix from 6 accents + 2 modes turned out
  cheaper to author than either the original 7 flat themes or a naive
  12-theme flat list would have been.
- **Per-theme semantic color variation** (income/danger/warn/streak). Fixed
  globally across every theme — see Context.
- **Seasonal themes** (Diwali, Christmas, etc. from `IDEAS-gamification.md`).
  Related idea, separate mechanism (earn-to-keep, time-boxed), not built here
  — though this feature's `THEMES` registry shape is what a seasonal theme
  would eventually plug into.
- **Mascot/avatar skins.** Blocked on Koban art existing at all (per
  `IDEAS-gamification.md`), unrelated to this token-level work.
- **Any new art assets.** This feature is colors only.
