# Rank Badges

One badge per rank on the 9-rank XP ladder, escalating in richness as it
climbs. Match the style of the existing badge art in this app (illustrated
medal/emblem — same family as the streak and trophy badges). Your creative
call on the rest.

## Ranks

Descriptions are the app's own in-app rank flavor (`RANK_FLAVOR` in
`lib/rewards.js`) — the tone each badge should carry.

| # | id (filename) | Title (shown in app) | XP | Description |
|---|---|---|---|---|
| 1 | `saver` | Saver | 0 | Every habit starts somewhere. This is yours. |
| 2 | `bookkeeper` | Keeper | 400 | Saver was instinct. Keeper is discipline — the record is yours now. |
| 3 | `steward` | Steward | 1,500 | You're not just logging anymore. You're minding it like it's worth minding. |
| 4 | `strategist` | Navigator | 4,000 | Not just watching where it went. Deciding where it goes. |
| 5 | `treasurer` | Strategist | 10,000 | This isn't a habit now, it's a plan. You're thinking ahead. |
| 6 | `financier` | Architect | 22,000 | You don't react to your money anymore. You design how it moves. |
| 7 | `tycoon` | Vanguard | 45,000 | Ahead of it now — every rupee already has somewhere to be. |
| 8 | `magnate` | Master | 80,000 | Nothing here surprises you. That took years, and it shows. |
| 9 | `money_master` | Sovereign | 135,000 | The top. Nothing outside this decides how your money moves. |

## Files

Drop finished PNGs into this folder (`assets/rank/`). **Name files by `id`,
not title** — the two deliberately differ (e.g. rank 2's title is "Keeper" but
its id is `bookkeeper`; rank 5's title is "Strategist" but its id is
`treasurer`). Use the `id` column above:

`saver.png`, `bookkeeper.png`, `steward.png`, `strategist.png`,
`treasurer.png`, `financier.png`, `tycoon.png`, `magnate.png`,
`money_master.png`

Each also needs a grayscale **locked** twin for a rank not yet reached — same
name + `-locked` (e.g. `saver-locked.png`, `money_master-locked.png`).
