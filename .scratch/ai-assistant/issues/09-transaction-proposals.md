# 09: "Add 250 auto yesterday" from chat

Spec: .claude/features/archive/44-ai-assistant.md (Phase 4)

**What to build:** When the person asks the chat to log something, it replies with a proposal card that describes the entry in plain words, with Review and Dismiss. Review opens the Add sheet pre-filled; Save writes it through the existing code, and the card then shows "Saved ✓". The function checks the proposal's ids, amount and date before showing it. An invalid proposal is dropped and the model is told why. Nothing is written without the Save tap.

**Blocked by:** 07, 08

**Status:** done (phone check pending)

- [x] The function writes to no table except its own usage and chat tables (read the code)
- [x] Review opens the Add sheet fully filled; Save creates exactly one row; the card shows "Saved ✓"
- [x] Dismiss leaves nothing behind
- [ ] Phone check

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

2026-11-09, emulator (Pixel_API_36), function deployed:
- **The function writes only its own tables.** `proposals.ts` has no Supabase client at all. In `chat.ts`, the only inserts, updates and deletes are on `ai_usage`, `ai_conversations` and `ai_messages`. The draft is stored in `ai_messages.proposal`.
- **Checks before a card shows:** type is expense or income; the amount is above 0, within ₹1 crore and rounded to paise; the category is theirs and of the same type; the account is theirs (default: the current one); the date is a real day, not in the future and not more than 5 years back; the note is trimmed to 120 characters. A failed check goes back to the model as an error, and nothing is shown. One draft per answer.
- **"Add 250 auto yesterday"** gave a card reading ₹250 · Transport · Personal · Yesterday · "Auto". Review opened the Add sheet with every field filled (Expense, ₹250, Transport, Yesterday, the note "Auto", Personal). Save logged it, and the card turned to "Saved ✓". Asked afterwards, the chat listed exactly one ₹250 Transport "Auto" row on 8 Nov.
- **"log 80 for tea today"** gave a Snacks card. Dismiss turned it to "Dismissed", and the Snacks list for the month has no ₹80 entry.
- **Reopened from Past chats,** the cards still read "Saved ✓" and "Dismissed". The app stores the mark as `proposal.status` on the answer row; that is the app's only chat-table write besides deleting a chat.
- **Fixed during the check:** the history sent to the model held only the answer text, so on the next turn the model said it had "never created that draft". Each earlier answer with a draft now ends with a bracketed note giving the draft and its status, and the prompt says to trust it. Afterwards the model correctly said the tea was dismissed.
- **Seen once:** a turn failed with no error in the logs (the model's answer was empty), and a long list answer stopped partway. The function now logs empty and cut-off answers (`finish_reason`); this goes out with ticket 10's deploy.
- Analytics: a draft saved from chat logs `expense_logged` with `source: 'assistant'`.
