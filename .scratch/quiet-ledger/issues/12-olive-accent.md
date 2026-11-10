# 12: Olive accent replaces the blue

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** The one accent colour changes from blue to a muted olive green (asked for on 2026-11-10, after Origin's use of a soft green). It stays decoration and meaning only: chart lines and fills, progress, selection marks, the switch, the caret, and soft info surfaces. Buttons and primary actions stay ink.

- `theme/ledger.js`: `accent` becomes olive in both modes, plus a new `accentSoft` fill. `chart` and `highlight` stay aliases of `accent`.
  - Light: `accent` `#5F7A1F`, `accentSoft` `#E9F0D2`.
  - Dark: `accent` `#B5CC6A`, `accentSoft` `#2A3315`.
- **Info callout** (`Callout` tone `info`) moves from `surfaceSunk` to `accentSoft`, with ink text. The Today prompt's icon tone follows `accent`.
- **Switch knob in dark mode:** on the olive track the knob turns `inkOnInk` (dark). The white knob fails there (see the table).
- **Muted text on `accentSoft`** isn't allowed in light mode (4.46:1, just under AA). Use ink on soft fills.
- **Soft fills need an edge** where they mark a boundary: `accentSoft` on white is only 1.18:1, so an info card that must read as a card keeps a hairline.
- **Income green (`positive`):** decide whether to keep `#1E7A46` or move it to teal (`#0F766E` light, `#5EEAD4` dark). The olive leans yellow so the two stay apart, but the Home week line is *spending*. Check that it doesn't read as money in.
- Write the rule into spec 46 (design tokens): olive is never a button fill or text on white at body size.

**Blocked by:** 01

**Status:** ready-for-agent

## WCAG check (2026-11-10)

Contrast ratios computed with the WCAG 2.x relative-luminance formula. AA thresholds: 4.5:1 body text, 3:1 large text and non-text UI or graphics (1.4.11).

| Pair | Ratio | Result |
|---|---|---|
| Light olive line `#5F7A1F` on canvas `#FFFFFF` | 4.89 | passes graphics, and text at AA |
| Light olive line on sunk `#F4F4F2` | 4.44 | passes graphics; not for body text |
| Ink `#121211` on light `accentSoft` `#E9F0D2` | 15.94 | passes |
| Muted `#6E6C66` on light `accentSoft` | 4.46 | fails AA body text by a hair: use ink |
| Light `accentSoft` on canvas (fill edge) | 1.18 | not a boundary: add a hairline where it matters |
| White knob on light olive track | 4.89 | passes |
| Dark olive `#B5CC6A` on dark canvas `#0B0B0B` | 11.07 | passes |
| Dark olive on dark sunk `#1F1F1F` | 9.27 | passes |
| Ink `#F3F2EE` on dark `accentSoft` `#2A3315` | 11.84 | passes |
| Muted `#A3A19B` on dark `accentSoft` | 5.14 | passes |
| White knob on dark olive track | 1.78 | **fails 3:1**: use the `inkOnInk` knob (10.54) |
| Income green light `#1E7A46` on canvas | 5.35 | passes (unchanged) |
| Income green dark `#5FD394` on dark canvas | 10.53 | passes (unchanged) |
| Today's blue, for reference: `#3B5BDB` light / `#8EA6FF` dark | 5.67 / 8.48 | passes |

- [ ] The week line, progress bars, switches, the caret and selection marks show olive in light and dark
- [ ] The info callout uses `accentSoft` with ink text
- [ ] The dark switch knob is dark on the olive track
- [ ] No button or primary action uses olive
- [ ] The `positive` decision is recorded, and spending never reads as income on Home
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
