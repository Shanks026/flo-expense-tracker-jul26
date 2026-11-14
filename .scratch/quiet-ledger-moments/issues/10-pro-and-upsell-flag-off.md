# 10: Pro and upsell on the kit (flag off)

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** Pro and the upsell sheet restyled while `FLAGS.billing` stays off. Spec 49 §Pro and upsell.

- Pro: `ScreenHeader` + `LargeTitle` on `canvas`; the benefits as a checklist in one `surface` card with a hairline border; plan options as selectable `ListRow`s from `PRO_PRICING` (price, per-month equivalent as the sub, a radio check on the chosen one); `PinnedFooter` naming the plan, with the existing placeholder behaviour.
- The upsell: the ledger `Sheet` "Go further with FLO", the reason line, the benefits as rows, the footer "Level up for ₹58/mo" opening Pro.
- The crown badge in `ink` on a sunk circle.
- The route redirect and create-time gates are unchanged. Flip the flag on locally for the check, and never commit it flipped.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] With billing flipped on locally: Pro shows the checklist and plan rows, picking a plan updates the button, the placeholder behaviour runs
- [ ] The upsell opens from a free-limit gate and its button opens Pro
- [ ] With the flag off (committed state), Pro redirects and no upsell appears
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
