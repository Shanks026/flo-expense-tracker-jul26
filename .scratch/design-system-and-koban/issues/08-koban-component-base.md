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

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- `components/koban/art.js` holds the whole drawing as data: the round-5 style A shapes, palette, idle arm centre-lines, stripes, whiskers, eyes, limb widths and the joint each part turns around. It is marked as placeholder art, so the person's illustrations replace this one file.
- `components/koban/Koban.js` takes `size`, `mood`, `pose`, `loop`, `scarf`, `surface` and an optional `accessibilityLabel` (decorative and hidden from TalkBack without one). Each moving part is its own Svg layer in an `Animated.View`, transformed around its joint (`transformOrigin`), so all motion is transform-only on the UI thread:
  - breathing (scales from the feet);
  - a slow head tilt;
  - a tail sway;
  - a blink about every 4.5 s;
  - an ear twitch on each ear at different intervals, with the inner ears moving with them.
- `useReducedMotion()` or `loop={false}` stops everything and resets to a neutral still. Only `neutral` / `idle` exist so far; anything else logs a dev warning and falls back.
- Creases work as in the prototype: the arms are drawn again in the crease colour, clipped to the torso and head, with a fur disc over each shoulder. **One change from the prototype:** the lime scarf is drawn over the shoulders (on top of the arms), because in the prototype order the arms and crease discs hid almost all of it.
- Dev gallery `app/dev/koban.js` (native header "Koban gallery") shows 48/96/160 dp on light and dark, with Motion and Scarf switches. It redirects Home when `__DEV__` is false, and the only way in is a dev-only "Developer → Koban gallery" row in Settings.
- **Checked:** the same layers from `art.js` rendered to a static SVG and viewed in the browser on light and dark, with and without the scarf. They match the round-5 drawing (that check is how the scarf problem was found). Motion is checked on the emulator only.
- Open (emulator checks paused): the gallery on the device, smooth idle motion, still with reduced motion, the scarf toggle, and that the gallery is unreachable in a release build.
