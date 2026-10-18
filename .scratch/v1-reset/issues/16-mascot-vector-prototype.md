# Mascot: rough vector cat prototype

Map: [../map.md](../map.md)
Type: prototype
Labels: wayfinder:prototype
Status: resolved
Blocked by: 

## Question

What does Koban look like as a layered vector cat that can be rigged with react-native-svg + Reanimated?

Brief:
- Start from the existing black-cat art: `assets/mascot/` and the app-icon head.
- Kind, shape and colour are open.
- Aim for Duolingo-level character, but comfortable beside a calm ledger UI.

Produce a rough, reactable artifact: a few poses or moods, using the layer split in audit §7 "What the SVG must look like". Iterate with the human.

Feeds ticket 04.

Refs: audit §7.

## Answer

Prototyped with the user over five rounds on 2026-10-18. The direction is locked. The user may ask for another iteration later, and that would reopen only the drawing, not the decisions below.

**Koban is a ginger tabby cat.** The black silhouette and maneki-neko framings were both rejected.

**Style:**
- **Flat 2D colour only:** no gradients, no shading ramps.
- **One continuous silhouette:** arms, legs and tail are round-capped tubes in the same colour as the body, so they merge into it. A thin crease shows only where a limb crosses the body or face. This is the approach of the existing onboarding art.
- **Body:** a compact pear-shaped torso with a small cream belly patch.
- **Face** (approved as "on point"):
  - big round eyes with green irises and round pupils;
  - cream muzzle, pink nose, blush, whiskers;
  - a few forehead stripes;
  - brows only when an expression needs them.
- Whether to add an outline (Storybook), a plush build, or the Waterllama-like editorial scarf is **left to [Design language direction](04-design-language-direction.md)**. All four sit on the same body.

**Personality:** curious and helpful, with a bit of sass. The rejected rounds were grumpy (heavy lids, brow stripes, slit pupils) and sitting.

**Pose and movement:**
- **Always standing on two legs.**
- **Movement library:** jump for joy, walking, hmm (paw to chin with a ? bubble), shrug, a little dance, a thumbs-up wink, and hello.
- **Not wave-centric.**
- **Prop poses** (from round 3, to carry onto the new body in the spec): glasses with the weekly report, a notepad and pencil, a magnifier, and a finger-up tip.

**Expressions:** neutral, happy, joy, wink, surprised, curious and look-up, focus, content, worried, sleepy, all switchable on one face rig.

**Build:**
- **Code-based first:** react-native-svg + Reanimated, with no new native dependency.
- Rive may come later, but the rig is not shaped around it.
- References: the onboarding art, Duolingo (character), and Waterllama (calm flat illustration).

**Prototype:** `.scratch/v1-reset/prototypes/` on branch `prototype/koban-mascot`. The final round is `koban-body-v5.prototype.html`, and rounds 1–4 are kept for reference.
