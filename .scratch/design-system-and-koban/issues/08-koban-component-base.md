# 08: Koban component: silhouette, idle and motion

Spec: .claude/features/37-design-system-and-koban.md

**What to build:** Koban exists as one code-drawn character that feels alive.
- One flat ginger-tabby silhouette, style A from the approved prototype round (branch `prototype/koban-mascot`, `koban-body-v5.prototype.html`): a head with ears, a pear torso, round-capped tube arms, legs and tail in the body colour, and a crease line only where a limb crosses the body or face. No outline, no gradients.
- The approved face in its neutral mood: big round green eyes with round pupils, a cream muzzle, a pink nose, blush and whiskers.
- The idle pose loops breathing, blinking, a tail sway and an occasional ear twitch. Each moving part animates only transform and opacity around its joint.
- Props: `size`, `surface` (light or dark, so he reads on both), `scarf` (the optional lime zigzag scarf), `loop`. `mood` and `pose` exist with only `neutral` and `idle` for now.
- With reduced motion on, he's still.
- A development-only gallery screen shows him at several sizes on light and dark. It never appears in store builds.

**Art is a placeholder:** the agreed round-5 Koban is used for now; the person will replace it with their own illustrations later. Keep the art behind the component's props so the swap touches no placement.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The gallery shows Koban matching the round-5 prototype on light and dark surfaces
- [ ] The idle loop runs smoothly (no dropped frames visible) and stops when reduced motion is on
- [ ] The scarf toggles on and off
- [ ] The gallery isn't reachable in a store build

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
