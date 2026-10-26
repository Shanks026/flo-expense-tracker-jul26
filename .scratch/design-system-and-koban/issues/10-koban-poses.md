# 10: Koban poses

Spec: .claude/features/37-design-system-and-koban.md

**What to build:** Koban has a movement library: the `pose` prop sets what his body does.
- Poses, each with its own loop: idle, hello (wave), jump-for-joy, walking, hmm (paw to chin with a ? bubble), shrug, little dance, nice-one (thumbs-up and hip).
- Prop poses for the specs that need them: glasses + report, notepad + pencil, magnifier, finger-up tip.
- `loop` off plays a pose once and settles in idle.
- Poses combine with any mood, and are still with reduced motion (holding the pose's key frame).

**Art is a placeholder:** the agreed round-5 Koban is used for now; the person will replace it with their own illustrations later. Keep the art behind the component's props so the swap touches no placement.

**Blocked by:** 09 (Koban moods). Both edit the same component.

**Status:** ready-for-agent

- [ ] The gallery shows all 8 poses and 4 prop poses on light and dark, each moving smoothly
- [ ] A pose with `loop` off plays once and returns to idle
- [ ] Any pose combined with any mood looks right; reduced motion shows the key frame only

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- New `components/koban/poses.js` (placeholder art) defines 12 poses as data: which arm shapes each uses, a duration, a suggested mood, and keyframe channels (`body`, `head`, `armL`, `armR`, `legL`, `legR`, `tail`, `bubble`), each with its own joint origin and an optional phase offset. Keyframes are translateY / rotate / scaleX / scaleY.
  - The seven moves are ported from the prototype's CSS keyframes: hello, jump, walk, hmm, shrug, dance, niceOne.
  - The four prop poses are new: report (glasses + a sheet held in both paws), notepad (a lime pad + pencil writing), magnifier, and tip (a raised finger beside the head).
  - The file also draws the extras: wave paw pads, the thumb, the props, the confetti overlay and the ? bubble.
- `Koban.js` was rewritten around one pose clock (UI thread, linear 0 → 1 per cycle). Each channel interpolates its keyframes into transforms around its joint, and the idle life (breathing, head tilt, tail sway, blink, ear twitches) keeps running underneath. Arms are their own layers over the head (so a paw can reach the chin, as in the prototype), each with its clipped crease.
- **API change from ticket 08:** a new `animated` prop (false = completely still, showing the pose's `still` key frame); `loop={false}` now plays the pose once and settles into idle, as this ticket asks. Reduced motion still makes him still. An unknown pose falls back to idle, with a dev warning. Any pose works with any mood.
- The gallery gained Loop and Pose controls (choosing a pose also picks its suggested mood) and an "Every pose" grid. It renders about 50 Kobans, which is fine for a dev screen.
- **Checked:** every pose was rendered from the real `art.js` / `faces.js` / `poses.js` (Babel → static SVG, same layer order, channels applied at two clock times) on light and dark. Two fixes came out of it: the report sheet was hidden under the arms (now drawn over them, with the paws on top and the arms held still), and the tip finger vanished over the head (the hand moved out beside the head). The other ten matched the intent.
- Open (emulator checks paused): smoothness of each loop on the device, play-once-then-idle, still with reduced motion.
