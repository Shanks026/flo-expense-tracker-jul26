# 09: Koban moods

Spec: .claude/features/archive/37-design-system-and-koban.md

**What to build:** Koban can react: the `mood` prop sets his expression.
- Moods: neutral, happy, joy, wink, surprised, curious/look-up, focus, content, worried, sleepy.
- Expressions change only the face (eyes, pupils, brows, mouth, blush). Brows appear only for expressions.
- Changing mood on screen eases from one expression to the next rather than snapping.
- Every mood works with the idle motion and with reduced motion.

**Art is a placeholder:** the agreed round-5 Koban is used for now; the person will replace it with their own illustrations later. Keep the art behind the component's props so the swap touches no placement.

**Blocked by:** 08 (Koban component: silhouette, idle and motion)

**Status:** ready-for-agent

- [ ] The gallery shows all 10 moods on light and dark, each recognisably different
- [ ] Switching mood in the gallery eases between expressions
- [ ] Blinking still works in every mood that has open eyes

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built. The person chose animated illustrations, so 09 and 10 are built in full on the placeholder art.
- New `components/koban/faces.js` (placeholder art, like `art.js`) defines all 10 moods as data, then draws them. Each mood sets the eyes (open, happy-closed ^ or asleep ‿), the open-eye look (size, pupil size, gaze offset, lid), the brows and the mouth.
- Six moods come from the prototype: neutral, happy (its smile), joy, wink, curious (its look-up) and worried (its brows). Four are new in the same style: surprised (bigger eyes, raised brows, "o"), focus (a light lid, near-level brows, small mouth), content (half lids, soft smile) and sleepy (closed eyes, small "o", a "z").
- The face is split into `FaceFeatures` and `OpenEyes`, so the blink squashes only open eyes (closed eyes and lids never blink oddly). A mood change crossfades over about 200 ms: the old face fades out as the new one fades in. With reduced motion it swaps instantly.
- An unknown mood falls back to neutral, with a dev warning.
- The gallery now has a live Koban with a mood picker (to see the crossfade) and a grid of all 10 moods, on light and dark.
- **Checked:** the real `faces.js` was compiled with Babel and rendered to static SVG for every mood on light and dark. All 10 read distinctly. Focus first read as cross, so its brows, lid and mouth were softened until it read as concentrating.
- Open (emulator checks paused): the gallery on the device, the crossfade, blinking in the open-eyed moods.
