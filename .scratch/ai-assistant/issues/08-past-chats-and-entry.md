# 08: Past chats and quicker entry

Spec: .claude/features/archive/44-ai-assistant.md (§3.3)

**What to build:** A history screen lists past conversations, each titled from its first question. Any of them can be reopened, or deleted along with its messages. A sparkle in the Home header, beside the bell, opens the chat. The chat's composer gets the mic from ticket 04, so a question can be spoken. All of it is hidden when the AI flag is off.

**Blocked by:** 06

**Status:** resolved

- [x] Reopening a past chat shows its messages in order
- [x] A deleted chat is gone and doesn't come back
- [x] The Home sparkle opens the chat; with the AI flag off, it's hidden
- [ ] A spoken question in the composer is sent like a typed one

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

**2026-11-09: built and checked on Pixel_API_36. The spoken question needs the phone.**
- **Past chats:** `app/assistant/history.js` (route `/assistant/history`, title "Past chats"), read through `hooks/useAssistantConversations.js`, newest first. Each row shows the stored title (the first question, 40 characters) and its date. A tap goes back to the chat with `router.dismissTo('/assistant', { id, at })`; a "New chat" row does the same with no id.
- **Delete:** the bin asks first, then `deleteConversation(id)` in `lib/ai.js` deletes the `ai_conversations` row; its messages go by `on delete cascade`. The row leaves the list at once, and `notifyChanged()` lets an open chat of the same id notice and start fresh. It's the app's only direct write to the chat tables.
- **Chat screen:** the header has Past chats, and New chat once there's a turn. `useAssistantConversation` now reports `loadedId`, so switching chats never shows the old chat's rows, and a loaded chat with no rows (deleted) resets to a new chat. An answer to a chat you've left isn't drawn into the new one.
- **Home:** a sparkle beside the bell opens Ask FLO, behind `FLAGS.ai`. With the flag off, the sparkle, Past chats and the chat screen are all hidden or redirect, and `voiceSupported()` already checks the flag.
- **Mic in the composer:** shown in the Send button's place while the composer is empty (the build and phone must support voice, as in ticket 04). Hold to speak; the words fill the composer; letting go sends them exactly like a typed question. No speech gives "Couldn't hear that".
- **Emulator:**
  - the sparkle opens the chat;
  - Past chats lists every chat, and reopening one showed its questions and answers in order, tables included;
  - deleting the chat that was open reset the chat to new, and the chat stayed gone after reopening Past chats; a second delete left the list at once;
  - holding the mic shows "Listening…" and Android's mic indicator, and letting go with no audio gives "Couldn't hear that";
  - typing swaps the mic for Send, and a typed "Bills this week" was answered as before.
- **Phone check:** a spoken question is sent and answered (the emulator's mic gets no host audio).
