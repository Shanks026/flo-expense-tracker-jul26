# 04: The share-usage ask and the toast

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The two remaining ambient moments on the kit. Spec 49 §The share-usage ask and §The toast.

- The share-usage ask moves into the ledger `Sheet`: the small `spark` object, "Help improve FLO?", the existing one-line body, Share usage (primary) + Not now (secondary). Dismissing counts as Not now. Trigger, storage key and writes unchanged.
- The toast keeps its API, position and timing, and still doesn't slide in (spec 46's Undo fix). It becomes an `ink` capsule with `inkOnInk` body text, a small status glyph (`positive` for success, `danger` for error, none for plain) and the action as a 600-weight text button.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The ask shows as a sheet after resetting its stored answer (dev only); both answers are remembered as before
- [x] Success, error and plain toasts look right in light and dark
- [x] The save toast's Undo lands on the first tap
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-14 (resolved): the share-usage ask is a ledger `Sheet` (the question as its title, the `spark` object, the existing line, Share usage + Not now); any close without an answer saves a Not now, as before. Review fixes: the answer is marked before it saves, so a close mid-save can't write a Not now over a yes; and if sharing turns on while the sheet is up, it closes itself. The toast is an ink capsule with `inkOnInk` text, a status glyph coloured from the other mode's palette so it reads on the pill (tick for success, cross for error, warning sign for the existing `warn` variant, none for plain/info), and the action as 600-weight text. Pills are centred under the status bar, with the same top position, timing and fade (no slide).
- Checked on Pixel_API_36. With usage sharing turned off in Settings, the real moment queue showed the ask (this account had never answered); Not now closed it. From a Kit preview: in dark, the ask, and the X closing it; Share usage turned sharing back on (DB `analytics_consent` true). Toasts: success with Undo, error and plain in light and dark (Kit buttons); a real "Logged ₹12 · Lunch" toast whose Undo removed the entry on the first tap, and a real "Transaction deleted" toast. A first Undo attempt was tapped too late (the toast had gone) and opened Streak; that ₹12 test entry was deleted through the app. End state: sharing on, Light, no test entries.

