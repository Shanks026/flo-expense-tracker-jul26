# Feature: Card themes and accent colours, back and unlocked
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/43-themes-back-unlocked.md`
**Status**: Phase 1 code built, phone check pending
**Last Updated**: October 2026

---

## Context

Spec 34 flagged the whole game economy off, and card themes went with it (`FLAGS.economy`). Spec 37 then fixed the accent to lime and hid Personalize. On the first phone check (2026-10-27) the person reported that card themes "were a hit" with friends, and decided:

- bring back all ~50 card themes **and** the accent colours;
- **unlock everything for everyone for now**, with no coins, no shop and no streak gates;
- gate them later, following the recommendations recorded below.

This partly reverses spec 37's "no accent picker, no card skins" decision. Coins, XP, ranks, trophies, the spin wheel and the Shop stay off.

The code is all still there: the catalogue (`lib/cardThemes.js`), the renderer (`components/CardThemeSurface.js`), the hub (`app/personalize.js`, `components/PersonalizePreview.js`) and the stored choices (`profiles.equipped_card_theme`, `profiles.theme_accent`, which spec 37 ignored but never cleared).

---

## Phase Overview

```
Phase 1 — Themes back, all unlocked
  A themes flag separate from the economy; Personalize returns with every
  card theme and every accent; the equipped card paints Home's account card.

Phase 2 — Gating (not scheduled)
  Recorded recommendations only. Build when the person asks.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Themes back, all unlocked 🚧 Code built

### Goal
From Settings → Personalize, anyone can pick any of the ~50 card designs and any accent colour, preview them together, and tap Equip. The chosen card paints Home's account card, and the accent repaints the app. Nothing is locked or priced. The rest of the economy stays off.

### Before Starting — Confirm With Codebase
- `lib/flags.js`: the `FLAGS` shape, and every `FLAGS.economy` check in `app/personalize.js`, `app/settings.js` and `lib/cardThemeMutations.js`.
- `theme/ThemeContext.js`: `accentId` is the constant `DEFAULT_ACCENT_ID`. The pre-spec-37 version (`git show e2404b2^:theme/ThemeContext.js`) had `setAccent` and the `flo.themeAccent` AsyncStorage key.
- `ThemeProfileSync` in `app/_layout.js`: mode only today.
- `app/(tabs)/index.js`: `AccountHeroCarousel` gets `cardTheme={null}`.
- `hooks/useCardThemes.js`: it reads `v_reward_balances` and `reward_events`, both economy tables.

### 1.1 Database

No database changes. `profiles.equipped_card_theme` and `profiles.theme_accent` already exist and keep their stored values.

### 1.2 Data Layer

- **`lib/flags.js`:** two new flags.
  - `themes: true` covers Personalize, accent colours and card themes, separate from `economy`.
  - `themeGating: false`. While false, every card theme counts as owned. Phase 2 turns it on.
- **`hooks/useCardThemes.js`:**
  - With `themeGating` off, `ownedIds` is every `CARD_THEMES` id, and the hook skips the coin balance and `reward_events` reads.
  - It still reads `profiles.equipped_card_theme`.
  - With gating on, the hook behaves as it does today.
- **`lib/cardThemeMutations.js`:** `equipTheme` checks `FLAGS.themes`, not `FLAGS.economy`. `buyTheme` keeps the economy check.
- **`theme/ThemeContext.js`:**
  - Restore the accent as state, read from `flo.themeAccent` at hydrate time. An unknown id falls back to lime.
  - Add `setAccent(id)`, which writes AsyncStorage and is exposed on the context.
  - With `FLAGS.themes` off, the accent stays pinned to lime as it is now.
- **`ThemeProfileSync`:** also reconciles `profile.theme_accent` into `setAccent`, and resets the accent to lime on login or account switch, mirroring the mode.

### 1.3 Components

- **`app/personalize.js`:**
  - Redirects to Home when `!FLAGS.themes` (was `!FLAGS.economy`).
  - Equip applies the accent: `setAccent` plus `updateProfile({ theme_accent }, { silent: true })`. This replaces the spec 37 comment that says accents are preview-only.
  - "Get more →" (the Shop link) shows only with `FLAGS.economy`.
  - The card grid lists every theme, because `ownedIds` holds them all.
- **No new components.**

### 1.4 Navigation / Integration

- **`app/settings.js`:** the Personalize row shows with `FLAGS.themes`.
- **`app/(tabs)/index.js`:** pass `cardTheme={FLAGS.themes ? equippedTheme : null}` from `useCardThemes()`. Equipping Ink keeps the current look: `AccountHeroCarousel` already maps a null or default theme to `colors.emphasisBg`.
  - Confirm the Ink case while building. `getTheme('ink')` is not null, so the carousel may need Ink treated like null to keep the dark-mode `emphasisBg`.
- **Shop, trophies and the spin wheel stay redirected** (`FLAGS.economy`).

### 1.5 Checklist
- [x] `FLAGS.themes` and `FLAGS.themeGating` added
- [x] `useCardThemes` returns every theme as owned while gating is off, without economy reads
- [x] `equipTheme` works with the economy off
- [x] The accent is state again, persisted locally and to `profiles.theme_accent`, and synced on sign-in
- [x] Personalize is reachable from Settings and lists all card themes and accents; the Shop link is hidden
- [ ] Home's account card paints the equipped theme; Ink looks as it does today in light and dark
- [x] Bundle check passes
- [ ] On the phone: equip a card theme and an accent, see them on Home, relaunch the app and see them persist

### Implementation Notes (2026-10-27)
- Built with `/to-tickets` and `/implement` (`.scratch/themes-back-unlocked/`), followed by the two-axis code review.
- **Appearance left Personalize.** Its Light/Dark toggle would overwrite Settings' System choice (spec 37), so the preview follows the mode on screen. In light mode, Ash and Cream can't be picked from here.
- **Dark-only accents:** `ThemeContext` shows lime while Ash or Cream meets light mode, and the stored choice comes back with dark. The context exposes both `accentId` (what's shown) and `accentPreference` (what's stored).
- **Ink** maps to the plain emphasis surface on Home and in the Personalize preview, so it looks as it did before.
- **Review fixes:**
  - Equip writes the accent before the card's `notifyChanged()`, so `ThemeProfileSync`'s refetch can't put back the old accent.
  - The sync compares against the stored accent before calling `setAccent`.
  - Dead Appearance code was removed.
- **Left as is:**
  - Home runs `useCardThemes` even when the flag is off. That's one small `profiles` read.
  - `'ink'` is still a bare string in several places.
  - In light mode, you can't explicitly re-equip lime over a stored dark-only accent.

### Risks
- **Contrast.** Spec 37 found that 13 accents fail 3:1 and that lime text on white is 1.6:1. `brandStrong` is tuned for lime only, so brand-coloured text and thin icons can be hard to read with some accents. Spec 37's ticket 02 has a follow-up on danger/warn/streak text contrast. For now this is accepted ("bring them all"). Revisit when gating lands: either drop the failing accents or give each one its own `brandStrong`.
- **The design QA matrix comes back** (≈23 accents × 2 modes × ~50 cards). Spec 37 removed the matrix to avoid this.
- **Money-figure legibility on busy cards.** Spec 38 required a fixed-contrast plate (≥4.5:1) under the money figure on any hero skin. The restored card themes predate that rule, so check the patterned and gradient themes on the phone.

---

## Phase 1b — First illustrated skin: Christmas (sample)

### Goal
A Christmas scene shows up in Personalize next to the other card designs and can be equipped on Home's account card. It's the first test of illustrated, seasonal skins, drawn from `.scratch/skin-samples/christmas-card.svg`.

### Build
- **New background type `scene`** in `CardThemeSurface`. It renders a named SVG from `lib/cardScenes.js` with `preserveAspectRatio="xMidYMid slice"`, so the art fills any card size without stretching.
- **`lib/cardScenes.js`:** the Christmas scene as a static SVG string, generated from the sample. It's the sample's settled frame: no CSS, no falling flakes, no mask. react-native-svg can't run CSS animations.
- **Catalogue entry** `christmas` (tier `seasonal`), placed right after the free themes.
  - Colours: `textColor` #FFFFFF, a gold `chipColor` and `negativeColor` #FF8F8F.
- **Skin red for a negative balance:**
  - Themes can set `negativeColor`. A negative balance uses it in place of the app red, which is 3.2:1 on this green.
  - `AmountText` gets an optional `negativeColor` prop, so the ₹ takes it too.

### Constraints carried over from the sample
- Text stays in the left two-thirds.
- Worst contrast behind text: white 12.7:1, muted 9.6:1, `#FF8F8F` 5.8:1.

### Animation (added 2026-10-27)
- **Layers:** `lib/cardScenes.js` holds the scene as ordered layers in one 360×180 space, generated from the sample by `.scratch/skin-samples/gen-card-scenes.js`. There are 4 static layers and 7 moving ones: the star's halo, the star, the stable's glow, three bulb groups, the bells and the twinkling sky. `sceneXml` joins them for the static frame.
- **`components/AnimatedCardScene.js`** puts each moving layer in an `Animated.View` and drives it with Reanimated: pulse (opacity), scale and swing.
  - Scale and swing turn about a scene point, mapped through the `xMidYMid slice` fit into the card's pixels (`transformOrigin`).
  - Snow is 34 animated dots that fade out over Home's text areas with a soft edge, the same idea as the sample's mask.
- **Timing:** everything finishes within about 5 seconds and rests on the finished frame. With Reduce motion on (Reanimated's `useReducedMotion`) nothing moves and no snow falls.
- **Where it plays:** Home's card and the Personalize preview (`CardThemeSurface animate`). It plays each time its screen comes into focus (`useFocusEffect`), so it replays on every return to Home, and again when you pick it in the preview. Each play is a fresh ~5 seconds with a new snowfall, never a loop (the person's call, 2026-10-27). The grid tiles stay still.
- **Checked on the phone:** a mid-animation and a settled screenshot of Home.

### Not in this step
- **A seasonal availability window.** Gating is Phase 2.

### Checklist
- [x] `scene` background type renders in Personalize's grid and on Home
- [x] Christmas is listed and can be equipped
- [ ] A negative balance on the Christmas card uses #FF8F8F, including the ₹
- [ ] Other themes are unchanged (no `negativeColor` means the app red)
- [x] Bundle check and phone check (Home, animated and settled)

---

## Phase 2 — Gating (recommendations, not scheduled)

The person chose "unlock all for now, gate later". The recommendation from 2026-10-27, recorded for when that happens:

1. **Streak milestones first (no currency).**
   - 2–3 card themes and a handful of accents stay free from day 1.
   - The rest unlock along the streak: the existing milestones 7 / 30 / 100 / 365, plus maybe 3 and 14.
   - Each unlock is a moment on the queue (`lib/momentQueue.js`) with Koban.
   - The catalogue already has a `milestone` tier with `unlock.day` metadata to reuse.
   - Grants would come from `streak_marks` milestones (spec 34), not the economy's `reward_events`.
2. **Pro unlocks every theme once Play Billing ships** (spec 41). Themes become a visible reason to pay. Add them to `lib/pro.js`'s benefits.
3. **Paid seasonal skins after that**, as one-time purchases through spec 41's ledger: the planned post-launch Store.
4. **Don't bring coins back.** Balancing earn rates and prices against a ledger is what made the app read as a game, which is why spec 34 cut the economy.

Turning on `FLAGS.themeGating` would bring back the existing owned-ids path. Phase 2 would then swap its sources from coin purchases to milestone grants and Pro.

---

## Out of Scope
- Coins, XP, ranks, trophies, the spin wheel, the Shop and coin packs (they stay behind `FLAGS.economy`).
- New card or accent art.
- Fixing accent contrast (see Risks).
