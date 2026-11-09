# 01: Ledger tokens, the money sign rule and the check script

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** Finish the Quiet Ledger token set and turn the money sign and paise rule into a plain function that node can test, so every later screen formats money the same way. Hide the accent picker behind a new flag.

- Tokens gain:
  - `accent` (the chart blue; `chart` and `highlight` stay as aliases);
  - `streak` orange;
  - type entries for the greeting (18/24/600) and the quick-action label (12/16/500).
- The palette depends only on light or dark mode.
- The sign, tone and paise logic moves out of the ledger `AmountText` into a pure function in the currency module. It returns `{ sign, tone, text }`, where tone is positive, ink or danger. `AmountText` maps the tone to a colour.
- New `FLAGS.accents` (off): Personalize hides the accent swatches, and the stored `theme_accent` is neither read nor written. The code stays.
- A new node check script with the amount cases. It follows the shape of the quick-add check script: plain ESM, imports `lib/` directly, keeps a tally, and exits non-zero on failure.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The check script passes these cases:
  - income gets "+" in positive, expense gets "−" in ink, and a negative balance gets "−" in danger;
  - 1200 → "1,200", 1367.6 → "1,367.60", 0.5 → "0.50", 100000 → "1,00,000";
  - an unknown currency reads as INR.
- [x] The pure function imports nothing from React Native, Expo or Supabase
- [x] The Home preview's amounts render exactly as before (light and dark)
- [x] Personalize shows no accent swatches; card themes still equip
- [x] No other screen changes

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal
