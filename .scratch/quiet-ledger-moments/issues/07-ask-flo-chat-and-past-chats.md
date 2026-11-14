# 07: Ask FLO chat and Past chats on the kit

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The Ask FLO chat and Past chats restyled; behaviour unchanged. Spec 49 §Ask FLO.

- Chat: `ScreenHeader` with Past chats and New chat icon buttons. Empty: the `spark` object, "Ask about your money", one line, the four starters as outlined `Chip`s that send on tap. The person's bubbles are `ink` with `inkOnInk` text; answers stay bubble-less in `ledgerType.body`; breakdowns become flat rows (tinted category circle when there is one, name, amount, a 600-weight total row) reading the same data shape the table read; the composer is a sunk capsule with the mic and a 40 dp ink send circle.
- Unchanged: the `FLAGS.ai` redirect, the `id`/`at` params, voice, the thinking steps, the reveal and its reduced-motion rule, a failed turn putting the question back, the proposal card.
- Past chats: `ScreenHeader` + `LargeTitle`, a New chat `ListRow`, then chats grouped by the shared date-label module (title, time as sub). With none: "Your chats will show up here."

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] A starter chip sends; a typed question and a voice question both get answers
- [x] An answer with a breakdown shows the rows and total
- [x] A proposal card still reviews and saves
- [x] Past chats groups by date and opens a chat; New chat starts fresh
- [x] Emulator check in light and dark. Asking spends AI calls on the test account, so keep it to a few

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-14 (resolved): the chat on the kit: `ScreenHeader` (native header off) with Past chats and New chat (New chat always shown, per story 59); the empty state with the `spark` object and the four starters as outlined `Chip`s; the person's questions as ink bubbles, fully rounded (the person's call while building); answers in ledger type (`RichText` moved to `ledgerType`); breakdowns as flat rows in a new `AnswerBreakdown` (a caption like "Spent by category · November 2026", a row per line with the category's own circle on by-category rows, entries as the sub, a 600-weight total); a sunk capsule composer with the mic and a 40 dp ink send circle. Behaviour unchanged (redirect, params, voice, thinking line, reveal, failed turns, proposal card). Past chats on the kit: New chat row, then chats grouped by day (`dateLabels`), title and time; Delete moved from a bin on each row into each row's ⋯ menu (same confirm). The old `BreakdownTable` was deleted here (nothing imported it), so its parser lives in one place. Categories for breakdown rows are fetched once per chat.
- Checked on Pixel_API_36: empty chat; a starter ("Biggest categories") answered with a category breakdown; a typed question ("Am I over any budget") answered with bold and bullets; Past chats grouped Today / Mon 9 Nov; past chats reopen (a by-day breakdown, and a saved proposal card in dark); dark mode for Past chats and the chat. The two test chats were deleted through the ⋯ menu. Not checked: a voice question (the emulator has no mic input) and reviewing and saving a new proposal (it would write real data; the card is unchanged). Seen once: after Past chats was opened straight from a link (no chat screen under it) and a hot reload, picking a chat landed on an empty chat until a full reload; not reproduced after reloading, and that navigation is unchanged from before.

