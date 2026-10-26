# 09: Koban moods

Spec: .claude/features/37-design-system-and-koban.md

**What to build:** Koban can react: the `mood` prop sets his expression.
- Moods: neutral, happy, joy, wink, surprised, curious/look-up, focus, content, worried, sleepy.
- Expressions change only the face (eyes, pupils, brows, mouth, blush). Brows appear only for expressions.
- Changing mood on screen eases from one expression to the next rather than snapping.
- Every mood works with the idle motion and with reduced motion.

**Blocked by:** 08 (Koban component: silhouette, idle and motion)

**Status:** ready-for-agent

- [ ] The gallery shows all 10 moods on light and dark, each recognisably different
- [ ] Switching mood in the gallery eases between expressions
- [ ] Blinking still works in every mood that has open eyes

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
