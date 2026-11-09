# 02: Illustration, EmptyState, and Koban deleted

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** The one-object-per-moment art system, with icon placeholders until the 3D assets exist, and Koban deleted. (Changed 2026-11-10: the person chose to delete him rather than flag him off.)

- `Illustration`:
  - named objects `coins`, `token`, `whistle`, `calendar`, `receipt`, `spark` and `trophy`;
  - sizes small and large;
  - each object renders a lucide icon in a large sunk circle for now. Swapping in image files later happens inside this component only.
- `EmptyState` (ledger): a small Illustration, a title, one line and an optional secondary button.
- Koban deleted: his component, art, faces, poses and the dev gallery (and its Settings row and route). No flag.
  - The onboarding opener, the share-usage ask, streak celebrations and the old `EmptyState` show an `Illustration` object instead; the old `EmptyState` maps its callers' pose prop to the nearest object.
  - The coach mark, the nothing-logged card and the streak hero show no art.
  - The streak copy helpers in `lib/koban.js` stay (text, not art).

**Blocked by:** 01

**Status:** resolved

- [x] No screen shows the cat. Check Home's nothing-logged card, the streak screen, a celebration, the onboarding opener and the old empty states
- [x] No code imports the deleted Koban files, and Settings → Developer has no Koban gallery row
- [x] EmptyState and every Illustration object look right in light and dark (checking them on a temporary dev screen or the Home preview is fine)

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-10: Koban deleted rather than flagged off, on the person's call. Checked on Pixel_API_36: the old Home empty state (receipt), the streak hero (no art), Settings → Developer (no gallery row), and every object plus the ledger EmptyState in light and dark. Not seen on screen: the onboarding opener (needs a sign-out) and a streak celebration (needs a milestone); both are one-line swaps to an Illustration, and the celebration's object uses the dark palette to match its always-dark screen. Celebrations themselves stay for now; whether to drop them is decided after the redesign.
