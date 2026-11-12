# 05: Bill icons from names

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** Each bill gets an icon that fits its name, previewed as the person types and changeable in the sheet. A local keyword list does most of it; for names it doesn't know, one Ask FLO call after saving picks a key from FLO's icon set. Spec 48 §Bill icons, §Database (the icon part).

- **Migration** (apply only with the person's yes; record it in `00-index.md`): `bills.icon` (shape check) and `bills.icon_picked` (boolean, default false).
- The icon set's key list lives in a pure module; the icon component gains `wifi`, `water`, `gas` and `tv`.
- `iconForBillName` is a pure keyword map (Indian names first; case-insensitive, word or prefix match). Display order: stored icon → category icon → receipt.
- `IconPicker` joins the kit (and the gallery). The bill sheet gets an icon row with a live preview and Change; choosing one sets `icon_picked`.
- `ai-assistant` gains a `bill_icon` mode: takes only the name, returns a key from its list or null, and logs latency like `quick_add` (no name). The app calls it only with `FLAGS.ai` on, no picked icon and no keyword match, after the save, and writes the result only if the icon still isn't picked. Deploying the function is part of this ticket.

**Blocked by:** 03

**Status:** in progress (blocked on deploying `ai-assistant`)

- [x] The check script covers each keyword family, case and word boundaries ("AIRTEL" matches, "Fairtel" doesn't), no match, the fallback order, every mapped key being in the set, and the function's copied list matching the set
- [x] Migration applied with the person's yes; an invalid icon value is rejected (rolled back)
- [x] Typing "Netflix", "BESCOM", "Jio", "LIC", "SIP", "EMI" previews the right icon before saving
- [ ] A name the map doesn't know gets an icon from Ask FLO after saving, and the save didn't wait for it
- [x] A picked icon survives a rename; with AI off the fallbacks apply
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-11-12 (in progress, not resolved): migration `quiet_ledger_money_bill_icons` applied on the person's go-ahead and verified (an invalid icon is rejected); `lib/billIcons.js`, the four new glyphs in `CategoryIcon`, and the check-script group are written but uncommitted. Not yet built: `billIcon.ts` with its route and deploy, `IconPicker`, the bill sheet's icon row and save logic, showing `billIconKey` on the screens, the emulator check. Details in the handoff's "Ticket 05 in progress".
- 2026-11-12 (built, not resolved): everything is built and emulator-checked except the Ask FLO step. `billIcon.ts` (mode `bill_icon`, name only, quick model, reply held to the key list, `ai_usage` kind `bill_icon`, daily cap `AI_DAILY_BILL_ICON` default 50) is routed in `index.ts` but **not deployed**: the deploy was held by the permission check and needs the person's OK. Until then the app's call gets a 400 and the bill keeps its fallback, which is the designed failure path. Checked on Pixel_API_36: Netflix, BESCOM, Jio, LIC, SIP, EMI and ACT preview the right icon; an unknown name shows "Ask FLO picks one after saving"; a picked icon (gas) survives a rename to Netflix in the DB; "Use the automatic icon" stores `entertainment`, unpicked; Bills list, bill detail, the sheet and IconPicker in light and dark (bill detail dark was owed from 04); the kit gallery shows IconPicker. Test bills deleted through the sheet. Review fixes: Prime/ACT/Dish match alone; loose words (house, flat, course) dropped; Ask FLO runs only for a new or renamed bill; the sheet uses `billIconKey`; bill save/delete moved to `lib/bills.js` (`saveBill`, `deleteBill`); the name caps at 80. To close: deploy, then save an unknown name (e.g. "Aunty tiffin") with AI on and confirm an icon arrives after the save.
