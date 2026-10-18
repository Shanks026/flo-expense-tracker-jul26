# Design language direction: Ledger, not game; accents; System/Light/Dark

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 02

## Question

What is FLO's v1 visual language?

The audit proposes "Ledger, not game":
- one brand accent plus System/Light/Dark, cutting the 2,254 theme combinations;
- lime only as a fill;
- fewer cards and borders;
- native navigation chrome.

The reference apps pull two ways: Duolingo's mascot-led warmth vs Tricount and Splitwise's calm ledger.

Grill:
- Where on that line does FLO sit?
- Which accent?
- Does any user choice of accent survive?
- How does the mascot (ticket 16) fit?
- What accessibility baseline must it meet?

Input: the outcome of the mascot prototype (16) if it has been worked.

Refs: audit §4 (all), §4 Design-language recommendation.

## Answer

Grilled with the user on 2026-10-18.

**1. Split by surface.**
- **Money screens** (Home numbers, transactions, budgets, reports) are ledger-calm: numbers first, neutral greys, nothing decorative above a rupee figure.
- **Character moments** (onboarding, empty states, coach marks, the streak and milestones, the weekly recap) are where Koban brings the Duolingo warmth.
- Koban never sits on a money number.

**2. Colour:**
- One brand accent, **lime**, used only as a fill: the primary button, selection and highlights, never as text on light surfaces.
- Red, amber and green carry meaning only (over budget, near the limit, income).
- Koban's ginger is the character's colour, never a UI accent.
- No accent picker in v1.

**3. Koban treatment: style A (Silhouette)** from [the mascot prototype](16-mascot-vector-prototype.md). That means flat, no outline, and the approved round-eye face. The **lime zigzag scarf** from style D is an optional accessory, swappable later for seasons or streaks.

**4. Appearance:**
- **System / Light / Dark**, with System as the default (`userInterfaceStyle: "automatic"`).
- One control in Settings → Appearance; Personalize is gone.
- The hero card is a plain emphasis surface with no skins.

**5. Accessibility baseline,** enforced by the shared components:
- **Touch targets and labels:** one `IconButton` and one `BackButton` with a 48dp target, a required label and a pressed state.
- **Contrast:** muted text at ≥4.5:1, and lime never used as text on white.
- **Income vs expense:** shown by sign and label as well as colour.
- **Text size:** body text at least 14, and screens checked at the largest system font size.

**6. Chrome and surfaces:**
- native Stack headers instead of the 18 hand-built ones;
- flat grouped lists with hairline separators, with cards only for the hero and truly separate objects;
- radii 8/12/16 plus full;
- pressed states everywhere and a light haptic on save;
- no fade-in on every load.

Tab structure stays with [Home IA](05-home-ia-and-tabs.md).

**7. Type, tokens and icons:**
- **Type:** Manrope stays, on a 6-step ramp (12/14/16/20/28/40) × 3 weights.
- **Spacing:** adds 32/48 section gaps.
- **Icons:** lucide only.
- **Assets:** the glossy 3D coin, chest and flame PNGs are retired. The streak uses a lucide flame or Koban.
