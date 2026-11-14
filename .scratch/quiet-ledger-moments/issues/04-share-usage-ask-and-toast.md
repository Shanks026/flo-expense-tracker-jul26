# 04: The share-usage ask and the toast

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The two remaining ambient moments on the kit. Spec 49 §The share-usage ask and §The toast.

- The share-usage ask moves into the ledger `Sheet`: the small `spark` object, "Help improve FLO?", the existing one-line body, Share usage (primary) + Not now (secondary). Dismissing counts as Not now. Trigger, storage key and writes unchanged.
- The toast keeps its API, position and timing, and still doesn't slide in (spec 46's Undo fix). It becomes an `ink` capsule with `inkOnInk` body text, a small status glyph (`positive` for success, `danger` for error, none for plain) and the action as a 600-weight text button.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The ask shows as a sheet after resetting its stored answer (dev only); both answers are remembered as before
- [ ] Success, error and plain toasts look right in light and dark
- [ ] The save toast's Undo lands on the first tap
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
