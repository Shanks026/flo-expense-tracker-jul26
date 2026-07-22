# Rank Badges — Batch 3 of 3

Match the style of `assets/comeback/comeback.png` — hexagonal medal frame,
laurel wreath on both sides, a ribbon + star base, rich gradient background,
one illustrated animal as the centerpiece. Same frame family every time;
the animal and color change per rank.

This batch covers the top 3 ranks — the most commanding animals and the
richest, most jewel-toned colors on the ladder. `money_master` is the peak;
it should read as the single best-looking badge of all nine.

| # | id (filename) | Title (display) | XP | Animal | Color |
|---|---|---|---|---|---|
| 7 | `tycoon` | Vanguard | 45,000 | Horse — leads the charge, sets the pace | Amber-gold / bronze |
| 8 | `magnate` | Master | 80,000 | Tiger — total command, no surprises | Deep rose-gold / crimson |
| 9 | `money_master` | Sovereign | 135,000 | Lion — the top, rules itself | Royal gold |

## Files

Drop finished PNGs into `assets/rank/`. **Name files by id, not title** —
rank 9 is titled "Sovereign" but its id is `money_master` — use the `id`
column above, not the `Title` column, when saving:

`tycoon.png`, `magnate.png`, `money_master.png`.

Each also needs a grayscale/locked twin for when the rank isn't yet reached
— same name + `-locked` (e.g. `money_master-locked.png`).
