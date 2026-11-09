# 02: Illustration, EmptyState and the mascot flag

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** The one-object-per-moment art system, with icon placeholders until the 3D assets exist, and Koban flagged off everywhere through a single change.

- `Illustration`:
  - named objects `coins`, `token`, `whistle`, `calendar`, `receipt`, `spark` and `trophy`;
  - sizes small and large;
  - each object renders a lucide icon in a large sunk circle for now. Swapping in image files later happens inside this component only.
- `EmptyState` (ledger): a small Illustration, a title, one line and an optional secondary button.
- New `FLAGS.mascot` (off): instead of the cat, the Koban component renders an `Illustration`, using a fixed pose → object map. Koban's components, poses and dev gallery stay.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] With the flag off, no screen shows the cat. Check Home's nothing-logged card, the streak screen, a celebration, the onboarding opener and the old empty states
- [ ] The Koban dev gallery still opens
- [ ] Turning the flag on locally brings Koban back unchanged
- [ ] EmptyState and every Illustration object look right in light and dark (checking them on a temporary dev screen or the Home preview is fine)

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
