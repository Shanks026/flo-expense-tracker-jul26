# Design system ("Ledger, not game") and the Koban component

Status: ready-for-agent
Source: v1-reset map — [Design language direction](../../.scratch/v1-reset/issues/04-design-language-direction.md), [Mascot prototype](../../.scratch/v1-reset/issues/16-mascot-vector-prototype.md) (prototype on branch `prototype/koban-mascot`, final round `koban-body-v5.prototype.html`)

## Problem Statement

FLO's look is a matrix: 23 accents × 2 modes × about 50 card skins makes 2,254 combinations, and 13 accents fail 3:1 contrast. Lime is used as text on white (1.57:1). Muted text is about 3:1. The app ignores the phone's light/dark setting. There are 279 Pressables with no accessibility labels, and 18 hand-built 40×40 back buttons. Every block is a bordered card, the type ramp has 14 sizes, and glossy 3D coin and chest art clashes with a flat UI. Koban, the mascot, is a flat raster silhouette that can't animate and looks different on every screen.

## Solution

**One calm, accessible look:**
- **Money screens are ledger-calm** (numbers first, neutral greys).
- **Lime is used only as a fill.**
- **Appearance is System / Light / Dark,** with System as the default and no accent picker.
- **Shared components enforce accessibility by construction:** 48dp targets, required labels and pressed states.
- **Tokens:** a 6-step type ramp, 3 radii and section spacing.
- **Native Stack headers.**
- **Flat grouped lists** instead of cards everywhere.
- **Lucide icons only.**

**Koban becomes one code-drawn ginger tabby** (react-native-svg + Reanimated):
- flat 2D colour, standing on two legs;
- tube limbs that merge into the body;
- the approved round-eye face with a set of expressions;
- a movement library;
- an optional lime scarf.

He appears **only in character moments**.

## User Stories

1. As a user, I want FLO to follow my phone's light or dark setting by default, so that it matches the rest of my phone.
2. As a user, I want to force Light or Dark in Settings → Appearance, so that I can override the system.
3. As a user, I want every money figure to be the most prominent thing on its screen, so that I see my money first.
4. As a user, I want readable muted text (≥4.5:1), so that secondary information isn't a strain.
5. As a user, I want lime never used as text on white, so that labels are legible.
6. As a user with colour-vision deficiency, I want income and expense distinguished by sign and label, not just colour, so that I never confuse them.
7. As a TalkBack user, I want every button announced with a label and role, so that I can use FLO by voice.
8. As a user, I want every tap target at least 48dp, so that I don't mis-tap.
9. As a user with large system text, I want screens that don't clip at the largest font size, so that FLO stays usable.
10. As a user, I want pressed feedback on everything I tap, so that the app feels responsive.
11. As a user, I want the standard Android back gesture and header on every pushed screen, so that navigation behaves like other apps.
12. As a user, I want lists as clean grouped rows rather than bordered boxes, so that screens feel calm.
13. As a user, I want content not to fade in on every load, so that the app feels fast.
14. As a user, I want one consistent icon style, so that the app looks finished.
15. As a user, I want to meet Koban in onboarding, empty states, coach marks, streak moments and the weekly recap, so that FLO has warmth without clutter.
16. As a user, I want Koban never drawn on top of my money figures, so that the numbers stay clear.
17. As a user, I want Koban to move smoothly (breathing, blinking, tail sway) and react with expressions, so that he feels alive.
18. As a user with reduced motion enabled, I want Koban still, so that motion never bothers me.
19. As a user on dark mode, I want Koban clearly visible, so that he works on every surface.
20. As the person running FLO, I want one Koban component with mood and pose props, so that every placement uses the same character.
21. As the person running FLO, I want old themes, accents and card skins removed from the UI, so that every new screen is designed and QA'd once.
22. As the person running FLO, I want the theme to remain two axes internally (a fixed accent × mode), so that seasonal hero skins can plug in later without a redesign.

## Implementation Decisions

**Theme:**
- `app.json` `userInterfaceStyle` becomes **automatic**.
- The theme context gains a **`system`** mode that follows the OS scheme, and becomes the default.
- The accent is fixed to the **brand lime**. The accent list and picker are removed from the UI.
- The profile theme sync stores only the mode.
- Existing `theme_accent` and `equipped_card_theme` values are ignored, not cleared.

**Colour tokens:**
- muted text raised to ≥4.5:1 in both modes;
- a "lime as fill" rule: a brand-text token, legible on light, for the rare text use;
- semantic colours (danger, warn, income) reserved for meaning;
- screens no longer import static light-mode colours directly.

**Scale tokens:**
- **type ramp:** 12/14/16/20/28/40 × 3 Manrope weights; body text ≥14;
- **radii:** 8/12/16 plus full, with continuous corners;
- **spacing** adds 32/48 section gaps;
- **shadow and motion tokens**, so components stop hand-rolling them.

**Shared components:**
- **IconButton:** a 48dp target, a **required** `accessibilityLabel`, a role and a pressed state.
- **BackButton** and **Row:** a grouped-list row with a hairline, a pressed highlight and role/label.
- **Button:** primary is a lime fill; secondary is a text button.
- **Card** keeps the hero/emphasis use only.
- Screens move to these components as each screen spec touches them.

**Navigation chrome:** the root Stack uses **native headers** for pushed screens. The 18 hand-rolled header/back copies are replaced as their screens are touched; spec 38 covers the main ones.

**Feedback:** pressed states via the shared components; a light haptic on save and on destructive confirmations; entrance animation only for first-time moments.

**Assets:** retire the 3D coin, chest and flame PNGs from v1 surfaces. The streak uses the lucide flame or Koban.

**The Koban component** (new, in a `koban` component folder):
- **API:** `mood`, `pose`, `size`, `loop`, `scarf`, `surface`.
- **Parts:** one flat ginger silhouette: a head with ears, a pear torso, **round-capped tube** arms, legs and tail in the body colour, and a crease line only where a limb crosses the body or face.
- **Face:** big round green eyes with round pupils, a cream muzzle, a pink nose, blush and whiskers; brows only for expressions.
- **Moods:** neutral, happy, joy, wink, surprised, curious/look-up, focus, content, worried, sleepy.
- **Poses** (the movement library): idle, hello, jump-for-joy, walking, hmm (paw to chin with a ? bubble), shrug, little dance, nice-one (thumbs-up + hip).
- **Prop poses** (glasses + report, notepad + pencil, magnifier, finger-up tip) are available for the specs that need them.
- **Motion:** Reanimated drives breathing, blink, tail sway, ear twitch and each pose's loop. Each moving part is its own small SVG inside an Animated view, animating only transform and opacity, with `transformOrigin` at the joint. Reduced motion means static.
- **The lime zigzag scarf** is an optional prop.
- The **style is A (Silhouette)** from the prototype. No outline and no gradients.

**Placement guardrail:** Koban appears only on character-moment surfaces (onboarding opener, empty states, coach marks, streak and milestone moments, weekly recap, Today strip). He never appears on a money figure.

## Testing Decisions

- **A good test** checks what a user perceives: contrast, tap target size, TalkBack announcements, the look in both modes, and Koban's rendering and motion. Not token values in isolation.
- **Seam 1, the emulator:**
  - switch the phone's light/dark setting with Appearance on System and confirm FLO follows; force Light and Dark;
  - TalkBack pass on Home, the Add sheet and Settings: every control announced;
  - largest font scale on Home, the Add sheet and Settings: no clipping;
  - Koban renders in each mood and pose on light and dark, animates smoothly, and is still with reduced motion on;
  - no Personalize, accent picker or card-skin UI anywhere.
- **Seam 2:** none needed. This spec has no data effects besides the mode-only theme sync, which can be checked via MCP on `profiles.theme_mode`.
- **Prior art:** theme handling in the theme context; the prototype rounds on branch `prototype/koban-mascot` as the visual reference for Koban.

## Out of Scope

- **Seasonal hero card skins and the Store** (post-launch). The hero keeps an internal skin slot (spec 38).
- **Redrawing the onboarding PNG art one by one:** onboarding uses the new component.
- **Rive** (maybe later).
- **The tab structure:** spec 38.
- **Per-screen refactors** beyond the screens the other specs touch.

## Further Notes

- The user may ask for another round on Koban's drawing later. That would change only the art inside the component, not its API or placements.
- Native-header adoption is gradual. Any screen a spec touches moves to it.

## As built (2026-10-26)

Code for tickets 01–11 (`.scratch/design-system-and-koban/`) is in. Emulator checks are pending, because they're paused.

- **Appearance (01):** `theme/ThemeContext.js` stores a mode preference (`system` | `light` | `dark`, System by default) and resolves it with `useColorScheme()`. The accent is fixed to lime. Settings → Appearance holds the three-way switch, `app.json` is `automatic`, and the profile sync is mode-only. One migration: `profiles.theme_mode` defaults to `'system'`.
- **Colour (02, 03):** light-mode muted text reaches 4.6–6.7:1, dark `mutedLight` 5.6:1, and income 5.2:1. `brandStrong` replaces lime as text. `mutedOnDark*` keep the old greys for permanently dark surfaces. Signed amounts carry a TalkBack label. Every remaining static-palette import is documented.
  - **Superseded:** onboarding and sign-in now follow Appearance too (the person's call; it reverses "no dark onboarding").
  - **Open follow-up:** danger, warn and streak orange are still below 4.5:1 as light-mode text.
- **Scale and components (04):** `type` / `radius` / `hitTarget` / `shadow` / `motion` tokens sit alongside the old ones. New components: `IconButton` (48 dp, label required), `BackButton`, `Row` + `RowGroup` (grouped lists; a switch row is one accessible switch), and `SegmentedChoice`. `Button` gained a `secondary` text variant. Settings is rebuilt on these.
- **Native headers (05):** the root Stack themes native headers, off by default; Settings, Streak and the dev Koban gallery turn them on.
- **Feedback (06):** `FadeIn` no longer animates unless `animate` is passed. `lib/haptics.js` → `destructiveHaptic()` fires at every destructive confirm.
- **Art (07):** the streak chip, hero and calendar use the lucide `Flame` / `Snowflake`. The 3D PNGs remain only on economy surfaces.
- **Koban (08–11):** `components/koban/` = `Koban.js` (layers and motion) plus three placeholder-art files: `art.js` (the body), `faces.js` (10 moods) and `poses.js` (12 poses as keyframe channels).
  - Props: `size`, `mood`, `pose`, `loop` (false = play once, then idle), `animated` (false = still), `scarf`, `surface`. Reduced motion makes him still.
  - The dev gallery is at `/dev/koban` (Settings → Developer, dev builds only).
  - Placed in the onboarding opener, coach marks, the streak hero and the streak celebration. No empty state had a mascot to replace.
  - The person plans their own **animated** illustrations to replace the art files.

