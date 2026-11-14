# 07: Ask FLO chat and Past chats on the kit

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The Ask FLO chat and Past chats restyled; behaviour unchanged. Spec 49 §Ask FLO.

- Chat: `ScreenHeader` with Past chats and New chat icon buttons. Empty: the `spark` object, "Ask about your money", one line, the four starters as outlined `Chip`s that send on tap. The person's bubbles are `ink` with `inkOnInk` text; answers stay bubble-less in `ledgerType.body`; breakdowns become flat rows (tinted category circle when there is one, name, amount, a 600-weight total row) reading the same data shape the table read; the composer is a sunk capsule with the mic and a 40 dp ink send circle.
- Unchanged: the `FLAGS.ai` redirect, the `id`/`at` params, voice, the thinking steps, the reveal and its reduced-motion rule, a failed turn putting the question back, the proposal card.
- Past chats: `ScreenHeader` + `LargeTitle`, a New chat `ListRow`, then chats grouped by the shared date-label module (title, time as sub). With none: "Your chats will show up here."

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A starter chip sends; a typed question and a voice question both get answers
- [ ] An answer with a breakdown shows the rows and total
- [ ] A proposal card still reviews and saves
- [ ] Past chats groups by date and opens a chat; New chat starts fresh
- [ ] Emulator check in light and dark. Asking spends AI calls on the test account, so keep it to a few

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
