# 10: Koban poses

Spec: .claude/features/37-design-system-and-koban.md

**What to build:** Koban has a movement library: the `pose` prop sets what his body does.
- Poses, each with its own loop: idle, hello (wave), jump-for-joy, walking, hmm (paw to chin with a ? bubble), shrug, little dance, nice-one (thumbs-up and hip).
- Prop poses for the specs that need them: glasses + report, notepad + pencil, magnifier, finger-up tip.
- `loop` off plays a pose once and settles in idle.
- Poses combine with any mood, and are still with reduced motion (holding the pose's key frame).

**Blocked by:** 09 (Koban moods). Both edit the same component.

**Status:** ready-for-agent

- [ ] The gallery shows all 8 poses and 4 prop poses on light and dark, each moving smoothly
- [ ] A pose with `loop` off plays once and returns to idle
- [ ] Any pose combined with any mood looks right; reduced motion shows the key frame only

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
