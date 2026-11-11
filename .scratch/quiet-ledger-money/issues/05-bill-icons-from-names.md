# 05: Bill icons from names

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** Each bill gets an icon that fits its name, previewed as the person types and changeable in the sheet. A local keyword list does most of it; for names it doesn't know, one Ask FLO call after saving picks a key from FLO's icon set. Spec 48 §Bill icons, §Database (the icon part).

- **Migration** (apply only with the person's yes; record it in `00-index.md`): `bills.icon` (shape check) and `bills.icon_picked` (boolean, default false).
- The icon set's key list lives in a pure module; the icon component gains `wifi`, `water`, `gas` and `tv`.
- `iconForBillName` is a pure keyword map (Indian names first; case-insensitive, word or prefix match). Display order: stored icon → category icon → receipt.
- `IconPicker` joins the kit (and the gallery). The bill sheet gets an icon row with a live preview and Change; choosing one sets `icon_picked`.
- `ai-assistant` gains a `bill_icon` mode: takes only the name, returns a key from its list or null, and logs latency like `quick_add` (no name). The app calls it only with `FLAGS.ai` on, no picked icon and no keyword match, after the save, and writes the result only if the icon still isn't picked. Deploying the function is part of this ticket.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The check script covers each keyword family, case and word boundaries ("AIRTEL" matches, "Fairtel" doesn't), no match, the fallback order, every mapped key being in the set, and the function's copied list matching the set
- [ ] Migration applied with the person's yes; an invalid icon value is rejected (rolled back)
- [ ] Typing "Netflix", "BESCOM", "Jio", "LIC", "SIP", "EMI" previews the right icon before saving
- [ ] A name the map doesn't know gets an icon from Ask FLO after saving, and the save didn't wait for it
- [ ] A picked icon survives a rename; with AI off the fallbacks apply
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
