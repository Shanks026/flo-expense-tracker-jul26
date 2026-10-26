# Design system ("Ledger, not game") and the Koban component

Spec: .claude/features/37-design-system-and-koban.md

Decisions made while ticketing (2026-10-26):
- New tokens are added alongside the old ones and not swept across the app: screens adopt the type ramp, radii and shared components as each spec touches them, as the spec says.
- The one sweep that stays in this spec is the static light-mode colour imports (40 files, ticket 03). With System the default, dark mode reaches everyone, so those bugs can't wait for each screen's own spec.
- Settings is the tracer screen for the shared components (04) and native headers (05), because tickets 01 and 02 already touch it.
- Koban is split into body and motion (08), moods (09) and poses (10), because the drawing is the hard part. 09 and 10 edit the same files, so they run in a line.
- Ticket 01 also fixes the gap left by spec 34 ticket 04, where hiding Personalize removed the Light/Dark switch.
- **Koban art is a placeholder (2026-10-26, the person):** build tickets 08–11 with the agreed round-5 design, which the person will later replace with their own illustrations. Keep the drawing inside the Koban component behind its props (`mood`, `pose`, `size`, `surface`, `scarf`, `loop`), so swapping the art changes no placement.
