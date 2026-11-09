# 08: Past chats and quicker entry

Spec: .claude/features/44-ai-assistant.md (§3.3)

**What to build:** A history screen lists past conversations, each titled from its first question. Any of them can be reopened, or deleted along with its messages. A sparkle in the Home header, beside the bell, opens the chat. The chat's composer gets the mic from ticket 04, so a question can be spoken. All of it is hidden when the AI flag is off.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Reopening a past chat shows its messages in order
- [ ] A deleted chat is gone and doesn't come back
- [ ] The Home sparkle opens the chat; with the AI flag off, it's hidden
- [ ] A spoken question in the composer is sent like a typed one

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
