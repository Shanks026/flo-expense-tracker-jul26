# Feature: Personalize Hub
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/23-personalize-hub.md`
**Status**: Planned
**Last Updated**: 2026-07-21

---

## Context

Personalization is split awkwardly today: **Primary color** and **Appearance**
(light/dark) live as two separate rows in Settings and apply *instantly* on tap,
while the **card theme** can only be chosen inside the **Shop** — a store, not a
settings surface. There's no single place to see how a color + appearance + card
combine, and picking a card feels like "shopping" even when you already own it.

This feature adds a **Personalize hub**: one screen with a *static preview* of
the Home UI (placeholder data, like how a phone OS previews a wallpaper/theme)
plus three controls — Appearance, Accent color, Card design — that the user
**experiments with freely**. Nothing applies on selection; a single **Equip**
button commits all three choices at once. The Shop stays the place you *acquire*
cards; the hub is where you *equip* what you own and set your free preferences.

Resolves the shop-vs-appearance confusion via **acquire (Shop) vs equip
(hub)**: an unowned card isn't shown here with a price — it's simply absent,
with a "Get more → Shop" link as the only bridge.

---

## Phase Overview

```
Phase 1 — The Personalize hub
  A pushed screen: static Home preview reflecting the DRAFT (accent + mode +
  card) + three draft controls + an Equip button that commits all three.
  Settings' Primary Color and Appearance rows collapse into one "Personalize"
  row that opens it.
```

Single phase — a hub with only some of the three controls isn't what was asked,
so the whole hub is the smallest useful version. (Future polish — a Menu entry,
richer preview — noted in Out of Scope, not built here.)

**After the phase: stop and wait for approval.**

---

## Phase 1 — The Personalize hub ✅ Complete

### Goal

The user opens **Personalize** from Settings, sees a static Home preview, taps
between accents / light-dark / owned cards and watches *only the preview*
change, then taps **Equip** to apply all three at once (or leaves, discarding
everything). No setting applies on selection anymore — it's experiment-then-
commit, like an OS theme picker.

### Before Starting — Confirm With Codebase

- `theme/ThemeContext.js` — `useTheme()` returns `{ accentId, modeId, setAccent,
  setMode, colors }`; `setAccent`/`setMode` are AsyncStorage-backed local
  setters (they apply app-wide immediately — the hub must NOT call them until
  Equip).
- `theme/themes.js` — `resolveColors(accentId, modeId)` is a **pure** function
  (the key enabler: the preview calls it with DRAFT values, independent of the
  active theme); `ACCENT_LIST`, `accentSupportsMode`, `accentModeLabel`,
  `DEFAULT_ACCENT_ID`.
- `hooks/useCardThemes.js` — `{ ownedIds (Set), equippedId, loading }`.
- `lib/cardThemeMutations.js` — `equipTheme(userId, themeId)` → writes
  `profiles.equipped_card_theme`, caller then `notifyChanged()`.
- `lib/cardThemes.js` — `getTheme(id)`, `CARD_THEMES`, `TIER_LABELS`.
- `app/settings.js` — the current `ColorPicker` row (`handleAccentChange`) +
  `AppearanceToggle` row (`handleModeChange`), incl. the dual-write pattern
  (`setAccent()` + `updateProfile({ theme_accent }, { silent:true })`) — this
  logic MOVES into the hub's Equip commit.
- `app/shop.js` — the hero-card preview markup + `PREVIEW_BALANCE`/`_INCOME`/
  `_EXPENSE` placeholders + the tile grid, to mirror for the hub's preview and
  card grid (no coins here).

### 1.1 Database

**No database changes.** Everything already exists: `profiles.theme_accent`,
`profiles.theme_mode`, `profiles.equipped_card_theme`, and the three mutations.
The hub only changes *when* they're written (on Equip, not on tap).

### 1.2 Data Layer

- **No new hooks.** The hub reads `useTheme()` (active accent/mode + setters),
  `useCardThemes()` (ownedIds/equippedId), `useProfile()` (`updateProfile` for
  the durable accent/mode write), `useAuth()` (userId), `useDataRefresh()`
  (`notifyChanged`).
- **Draft state is local `useState`** in the screen: `draftAccent`,
  `draftMode`, `draftCard`, each initialized from the active value
  (`accentId` / `modeId` / `equippedId`) once loaded.
- **Preview colors** come from `resolveColors(draftAccent, draftMode)` called
  directly (NOT `useTheme().colors`) — this is what makes the preview show the
  draft without touching the live app. The preview's hero card uses
  `getTheme(draftCard)`.
- **Dirty check**: `dirty = draftAccent !== accentId || draftMode !== modeId ||
  draftCard !== equippedId`. Equip is disabled unless `dirty`.
- **Mode-lock rule**: when `draftMode` changes to a mode the current
  `draftAccent` doesn't support (`!accentSupportsMode(draftAccent, draftMode)`),
  snap `draftAccent` back to `DEFAULT_ACCENT_ID` in the same update — so the
  draft is always a legible combination, and the accent picker's locked state
  (below) always matches the previewed mode.
- **Equip commit** (one handler, all three):
  ```
  await equipTheme(userId, draftCard);
  setAccent(draftAccent);  await updateProfile({ theme_accent: draftAccent }, { silent: true });
  setMode(draftMode);      await updateProfile({ theme_mode: draftMode }, { silent: true });
  notifyChanged();         // Home hero re-reads equipped_card_theme
  showToast({ message: 'Applied', variant: 'success' });
  ```

### 1.3 Components

- **`app/personalize.js`** (new route, pushed) — the hub. Layout, top→bottom:
  1. Header (back + "Personalize").
  2. **Preview** (`PersonalizePreview`, pinned) — the static mock (see below).
  3. **Appearance** — a light/dark segmented control (reuse
     `AppearanceToggle`'s shape, but `value={draftMode}` /
     `onChange={setDraftMode}`).
  4. **Accent color** — a horizontal row of `ColorSwatch`es (extract/reuse the
     one in `ColorPicker.js`); tapping sets `draftAccent`. An accent unsupported
     in `draftMode` is locked (dimmed + lock + "Dark mode only") exactly as the
     picker does — but now it unlocks live when the user flips Appearance to
     dark in the same draft.
  5. **Card design** — owned cards only, rendered as `CardThemeSurface` tiles
     like the Shop's grid **but with no coin/price caption** (name + a
     selected check). Tapping sets `draftCard`. A trailing "Get more designs →"
     row/button pushes `/shop`.
  6. **Equip** button (footer, primary) — disabled unless `dirty`; commits all
     three; shows a spinner while writing.
- **`components/PersonalizePreview.js`** (new) — a **static** Home replica with
  placeholder values (NOT the real Home, NOT live). Built from a passed-in
  resolved-colors object + the draft card theme. Contents, enough to read the
  whole look at a glance:
  - screen bg (`preview.bg`),
  - the hero card (`CardThemeSurface` + placeholder balance/income/expense,
    mirroring `AccountHeroCarousel`/the Shop preview),
  - a couple of representative chrome bits tinted by the accent: a section
    label, one or two list rows, a primary (`preview.brand`) button, and a mini
    tab bar — so accent + mode + card all show together.
  - Deliberately non-interactive (`pointerEvents="none"`).
- **`ColorSwatch`** — currently a local function inside `ColorPicker.js`. Export
  it (or lift to a tiny shared component) so both the picker and the hub use one
  swatch renderer.

### 1.4 Navigation / Integration

- **`app/settings.js`** — remove the `ColorPicker` row and the
  `AppearanceToggle` row; replace with a single **"Personalize"** row (Palette
  icon, value = current accent name or blank) that `router.push('/personalize')`.
  Delete the now-unused `handleAccentChange`/`handleModeChange` from Settings
  (their dual-write logic now lives in the hub's Equip). `ColorPicker` the
  component stays in the repo (the hub reuses its `ColorSwatch`); the *dialog*
  usage in Settings goes away.
- The Shop is unchanged for buying; its post-buy "Equip" convenience stays, but
  the hub becomes the primary place to switch card designs.

### 1.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| Settings | Two theming rows → one "Personalize" row | The dual-write (`setAccent`+`updateProfile`) must move intact into the hub, not be lost |
| Appearance toggle behavior | No longer applies instantly from Settings | Intended — it now applies via the hub's Equip. Confirm nothing else calls the old Settings handlers |
| `ColorPicker.js` | `ColorSwatch` gets exported/shared; dialog no longer used by Settings | Don't break the component's own mode-lock logic when extracting the swatch |
| Home hero card | Updates after Equip via `notifyChanged()` | Same refetch path the Shop's equip already uses |
| `ThemeProfileSync` | unaffected | Still reconciles profile→local on load; the hub writes the same fields |

### 1.6 What This Phase Does NOT Include

- No buying/coins in the hub — acquisition stays in the Shop (the "Get more"
  link is the only bridge).
- No new preview of *other* screens — one Home-style composite only.
- No Menu-sheet entry (reachable from Settings; a Menu shortcut is future).
- No per-account card themes (equip is global, as today).

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] `/personalize` opens from a single Settings "Personalize" row; the old
      Primary Color + Appearance rows are gone.
- [x] Changing accent / appearance / card updates **only the preview** — the
      live app and other screens do not change until Equip.
- [x] The preview is static, placeholder-valued, non-interactive, and reflects
      all three draft choices together (accent + mode + card).
- [x] Accent swatches lock/unlock against `draftMode` live; flipping Appearance
      to dark unlocks Ash/Cream in the same session; flipping to light while a
      dark-only accent is drafted snaps the draft accent back to default.
- [x] Card design shows only owned themes, no coin/price; "Get more →" opens the
      Shop.
- [x] Equip is disabled until something changed; on tap it commits only the
      fields that actually changed (card via `equipTheme` + `notifyChanged`,
      accent/mode via `setAccent`/`setMode` + silent `updateProfile`), toasts
      success, and the Home hero + app chrome reflect it.
- [x] Leaving without Equip discards the draft — active theme unchanged (draft
      state is local to the screen, nothing is written until Equip).

### Implementation Notes

- **`components/ColorPicker.js`** — `ColorSwatch` exported (was a private inner
  function) so the hub reuses the exact swatch renderer.
- **`components/PersonalizePreview.js`** (new) — pure/presentational: takes a
  fully-resolved `colors` object (built by the caller via `resolveColors`) and
  a card theme, never calls `useTheme()` itself. This is what guarantees the
  preview can show a draft combination the real active theme has never seen.
  Revised per direct feedback to mirror `app/shop.js`'s hero preview EXACTLY
  (incl. its income/expense stats row, via the same `chipColor`/Ink-exception/
  `lighten()` derivation, using the DRAFT accent for Ink's special case rather
  than the real active one), plus a bar-graph mock (expense-only, a single
  `colors.brand`-tinted series with fixed/deterministic heights + day labels —
  same visual grammar as `components/IncomeExpenseChart.js`, not live data or
  `Math.random()`) in place of the original list-row mock, and the primary
  button — no tab-bar mock (removed per feedback). `pointerEvents="none"`
  throughout.
  - **Second revision**: the bar graph now sits inside its own card, matching
    Home's real layout (`IncomeExpenseChart` lives inside a `<Card>`, not bare
    on the screen). `components/Card.js` reads `useTheme()` internally so it
    can't be reused (it would paint the real active theme, not the draft) —
    hand-rolled Card's exact base style (`radii.card`/1px border/`spacing.lg`
    padding) driven by the passed-in draft `colors` instead.
  - **Third revision**: the whole preview was PINNED above the scrolling
    sections (Shop's own pinned-top/scroll-middle shape). **Superseded by the
    fourth revision below** (unpinned again) once the preview grew into a
    full mini Home clone — pinning a preview that tall would leave little
    room to scroll the actual controls underneath it.
  - **Fourth revision** (current shape) — per direct feedback ("clone the
    exact homescreen ui... make it smaller... exact nav bar... make it
    dynamic"), rebuilt as a genuine miniature clone of the real Home screen
    (`app/(tabs)/index.js`): header chips (coins/freeze/level/streak/bell),
    the avatar+greeting row, the hero card, carousel dots, the chart card,
    a half-visible "Recent Transactions" list, and the tab bar (incl. its
    raised accent + button) — built at the SAME internal proportions as the
    real screen (real `theme/tokens.js` values throughout, not a re-tuned
    mini layout), then uniformly shrunk with a single `transform: [{scale}]`
    + `transformOrigin: ['0%','0%']` (confirmed supported — RN 0.81's
    `StyleSheetTypes.d.ts` declares it) on one `DEVICE_WIDTH`×`DEVICE_HEIGHT`
    canvas — per "the entire screen with the same scale but smaller on the
    whole," not a redesign. Un-pinned (reverting the third revision) and
    centered (`alignSelf: 'center'`) in normal scroll flow instead, since a
    full-screen clone is much taller than the old hero-only preview.
    - The "half visible" second transaction row comes from the tab-bar mock
      being absolutely positioned at the canvas bottom and painted (JSX
      order) AFTER the transaction list — it visually overlaps whatever
      content sits in that region, exactly like the real floating tab bar
      over Home's scroll content. `DEVICE_HEIGHT`/`NAV_HEIGHT` are the two
      constants tuned (by estimating each real section's height from actual
      token values) to land that cut around the second row's midpoint —
      flagged in-file as the pair to retune on-device, since layout math
      this precise can't be verified without rendering RN.
    - The bar graph, hero stats row, header chips, and avatar are now
      dynamic — every color comes from the `colors` prop (draft accent+mode)
      or `cardTheme` (draft card), never a real `useTheme()` call, so
      `Card`/`IconTile`/`AccountDots`/`IncomeExpenseChart` (each reads the
      real active theme internally) are hand-rolled equivalents here;
      `AmountText`/`CategoryIcon` ARE reused since both take every rendered
      color as an explicit prop.
    - The standalone "Add Transaction" CTA pill (added in the second
      revision, before the full clone existed) is removed — the real Home
      screen has no such pill either; the tab bar's own raised + button now
      fills that "primary button" role, matching the reference screenshot.
- **`components/Button.js`** — per direct feedback ("make all type of buttons
  rounded like a pill"), the shared `base` style's `borderRadius` changed from
  `radii.button` (16) to `radii.pill` — since every variant (primary/dark/
  outline/danger/ghost) shares this one base style, the change applies
  everywhere `Button` is used app-wide (onboarding, celebrations, the
  Personalize hub's own Equip button, etc.), not just one call site.
- **`app/personalize.js`** (new route) — `draftAccent`/`draftMode` seed
  directly from `useTheme()`'s `accentId`/`modeId` (already-hydrated context
  values by the time this screen is reachable — same assumption every other
  consumer of `useTheme()` in this app already makes). `draftCard` seeds from
  `equippedId` via a `useEffect` gated on `useCardThemes()`'s `loading` flag,
  since that value comes from an async DB fetch, not context.
- **Equip commits only the fields that actually changed**, not a blind rewrite
  of all three — a slight refinement on the doc's illustrative pseudocode:
  writing `theme_accent`/`theme_mode` when they didn't change would be a
  wasted round-trip for no behavior difference. `dirty` (which also gates the
  button) is computed the same way.
- **Accent row is a horizontal `ScrollView`** of swatches (per direct
  instruction), not the Settings dialog's vertical list — a dedicated screen
  has the room, and it reads faster for "browse and compare" than a modal.
  Locked (mode-unsupported) swatches dim, show a lock scrim, and swap their
  caption to `accentModeLabel()` (e.g. "Dark mode only") in place of the name.
- **Card design grid** mirrors the Shop's tile shape (`CardThemeSurface` +
  selected check badge) filtered to `ownedIds` only, with no coin/price
  caption — exactly the "no shopping" framing requested. "Get more →" pushes
  `/shop`.
- **`app/settings.js`** — removed `ColorPicker`/`AppearanceToggle` imports, the
  `accentId`/`modeId`/`setAccent`/`setMode` destructure, and both
  `handleAccentChange`/`handleModeChange` (that dual-write logic now lives in
  the hub's `handleEquip`). The two rows collapsed into one "Personalize" row
  (Palette icon, chevron, pushes `/personalize`) — verified `SunMedium` stays
  imported (still used by the unrelated Daily Reminders row).
- **Verified**: all four touched/new files Babel-compile clean.

### Known Drift (2026-07-21) — Not Fixed Here

A same-day, unrelated Home-screen pass ("tweak", `af2dd80`) restyled the
**real** hero card in `components/AccountHeroCarousel.js` without touching
`components/PersonalizePreview.js`. Since the preview's whole premise is
hand-cloning that card at real token values, it now renders a stale version
of it:

- `heroLabel` ("In Hand") and `heroStatLabel` ("Income"/"Expenses") moved
  from `fontFamily.semibold` / `fontSize.base`|`fontSize.sm` (no tracking) to
  `fontFamily.bold` / `fontSize.xs` + `letterSpacing: 0.3` — a smaller,
  micro-kicker treatment. `PersonalizePreview.js` still uses the old sizes/
  weights (`personalize.js` styles `heroLabel`/`heroStatLabel`, unchanged).
- The muted label color went from the per-card-theme `theme.mutedColor` to a
  flat `rgba(255,255,255,0.55)` (`MUTED_LABEL_COLOR`) — the real card no
  longer derives that color from the theme at all; the preview still passes
  `cardTheme.mutedColor`.
- `heroTopRow`'s bottom margin grew `spacing.md` → `spacing.lg`; the real
  `heroBalance` gained `letterSpacing: -1` (was the shared `AmountText`
  default). Preview has neither.
- Real `AccountHeroCarousel`/Home also grew a loading-skeleton state
  (`accountsLoading` prop, chip `Skeleton`s on Home). **Not applicable** to
  the preview by design — it's always-static/never-loading, so there's
  nothing to mirror here; noted so this isn't mistaken for a missed spot.
- `components/AmountText.js` gained `fontVariant: ['tabular-nums']`. No
  action needed — the preview reuses the real `AmountText` component (not a
  hand-rolled clone) for the hero balance, so this applied automatically.

**Reconciliation is still owed**: re-sync `PersonalizePreview.js`'s
`heroLabel`/`heroStatLabel`/`heroTopRow`/`heroBalance` styles and the muted-
label color source to match the real card. Left undone in this pass — this
section only records the drift.

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

No schema changes. The hub reads/writes existing fields only:
`profiles.theme_accent`, `profiles.theme_mode`, `profiles.equipped_card_theme`
— on Equip, not on selection.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Settings theming rows | Collapse into one "Personalize" row | Phase 1 |
| Shop | Unchanged (still the acquire surface); hub becomes primary equip | none |
| `ColorPicker` `ColorSwatch` | Shared with the hub | Phase 1 (export) |

---

## Out of Scope (All Phases)

- **Buying cards in the hub** — Shop only; "Get more →" is the bridge.
- **Menu-sheet shortcut** to Personalize — future; Settings is the entry now.
- **Multi-screen preview** — one Home composite is enough.
- **Per-account card themes** — equip stays global.
- **Seasonal/animated card themes** — separate ideas (`IDEAS-gamification.md`).
