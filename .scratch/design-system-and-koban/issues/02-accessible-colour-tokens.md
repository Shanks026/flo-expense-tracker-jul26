# 02: Accessible colour tokens

Spec: .claude/features/37-design-system-and-koban.md

**What to build:** Text is readable in both modes, and colour never carries meaning on its own.
- Muted text tokens reach at least 4.5:1 against their backgrounds in light and dark.
- Lime is used only as a fill. A new brand-text token, legible on light surfaces, replaces every place lime is used as text or as a thin icon on white.
- Danger, warning and income colours are kept for meaning only.
- Income and expense amounts are told apart by sign and label as well as colour, everywhere they're listed.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Every muted text token measures at least 4.5:1 on its surface in both modes (record the ratios in the ticket)
- [ ] No lime text or thin lime icon on a light surface anywhere in the app
- [ ] Income and expense rows read correctly in greyscale (sign and label present)
- [ ] Both modes look right on Home, the Add sheet, Transactions and Settings

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.

Contrast, measured (on bg / surface):

| Token | Light before | Light now | Dark before | Dark now |
|---|---|---|---|---|
| mutedDarker | 4.8 / 5.1 | `#55594f` 6.7 / 7.2 | 11.5 | unchanged |
| muted | 3.1 / 3.3 | `#62665d` 5.5 / 5.9 | 6.3 / 5.8 | unchanged |
| mutedMid | 2.5 / 2.7 | `#686c63` 5.0 / 5.4 | 7.7 / 7.0 | unchanged |
| mutedLight | 2.0 / 2.1 | `#6e7268` 4.6 / 4.9 | 4.4 / 4.0 | `#878a81` 5.6 / 5.2 |
| income | 3.8 / 4.1 | `#4C7311` 5.2 / 5.6 | 11.3 | unchanged |
| brand as text | 1.5 / 1.6 | `brandStrong` `#4F6B00` 5.7 / 6.1 | 12.5 | lime |

- New `brandStrong` token (deep olive in light, lime in dark). It replaces lime as text or a thin icon on mode-following surfaces: the join screen, the report's down-trend icon, the Settings test-push link, the split settle pill, the Add sheet transfer empty state, the alerts empty state, currency and split-member checks, the toast action, the TodayCard check, ProBenefits (light only) and the pull-to-refresh spinners. Lime stays on permanently dark cards and as fills (chart bars, buttons).
- **Kept the old values for dark surfaces:** the static muted greys were also used for text on permanently dark cards (hero, summary, Pro, celebrations), where darkening them would have dropped them from about 7:1 to 3.6:1. Those 34 uses now point at new `mutedOnDark` / `mutedOnDarkLight` / `mutedOnDarkDarker` tokens holding the exact old values, so they render unchanged. Ticket 03 should check whether any of them is actually on a light surface.
- **Income vs expense:** signed amounts already show + / −. The budget detail's expense list is now signed too, and `AmountText` gives TalkBack a label such as "Expense ₹250" / "Income ₹1,200".
- **Not changed, still below 4.5:1 as light-mode text:** danger `#E5484D` (3.9 on surface), warn `#C98A12` (2.95), streakDeep `#D9480F` (4.3). They are shared across modes in `SEMANTIC`, so a fix needs light-only text variants and a pass over their uses. Worth a follow-up ticket.
- Open (emulator checks paused): both modes on Home, the Add sheet, Transactions and Settings; the greyscale income/expense check.
