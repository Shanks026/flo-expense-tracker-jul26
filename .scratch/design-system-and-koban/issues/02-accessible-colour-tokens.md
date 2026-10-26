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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
