# 06: Ask your first question

Spec: .claude/features/archive/44-ai-assistant.md (Phase 3)

**What to build:** An "Ask FLO" row at the top of the More tab opens a chat screen. Asking "how much did I spend on food this month?" gets a short, correct answer in ₹ that says which period it used. The number comes from a spending-total tool that the function runs against the person's own data, counting only exact expense or income types, so transfers never count. The model only picks the tool and phrases the result. Conversations and messages are stored, and the function writes both sides. The screen has a message list and a text composer; the empty state uses Koban. The chat tables need the person's yes on the SQL, applied with the CLI.

**Blocked by:** 05

**Status:** resolved

- [x] The chat tables exist with RLS; user A can't read B's conversations, or add a message to one of them (rolled-back check); the advisor shows no new WARN
- [x] "How much on food this month?" matches the Insights screen exactly
- [x] A transfer between accounts doesn't change the answer
- [x] With the AI flag off, the More row is hidden
- [x] The keyboard doesn't cover the composer (Pixel_API_36, light and dark)

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

**2026-11-09: built, deployed and checked on Pixel_API_36.**
- **Database:** `ai_conversations` and `ai_messages` applied as written in spec 44 §3.1 (migration `ai_conversations_and_messages`, after the person's yes). Rolled-back RLS check: user A reads 0 of B's conversations and messages, can't add a message to B's conversation, can't create one as B, and updates 0 of B's rows. The security advisor shows the same 3 WARNs as before (pg_net in public, SECURITY DEFINER functions, leaked-password protection), none new.
- **Function:** `chat` mode in `supabase/functions/ai-assistant/chat.ts`, with `shared.ts` for what both modes use. One tool so far, `spend_summary`:
  - counts only `type = 'expense'` or `'income'`;
  - optional category and account, defaulting to the active account the app sends, which is Insights' default scope;
  - breakdowns by category, day, week (starting Monday) or month;
  - sums paise as integers and formats ₹ the way `formatMoney` does.
  The model is given ready-made periods and copies the tool's ₹ amount and period text. A loop runs at most 4 tool rounds, with 20 s per call and a 45 s turn budget, and sends the last 12 messages. The title is the first 40 characters of the first message. `AI_DAILY_CHAT` caps calls. The conversation and both messages are written only after a turn succeeds, and a half-written turn is removed. `AI_MODEL_CHAT` is Haiku 5.5 (spec default); `ai_usage` shows about $0.0005 and 3.8 s a turn.
- **App:** `app/assistant.js` (Ask FLO, header title), `hooks/useAssistantConversation.js`, `aiChat` in `lib/ai.js`, and an Ask FLO row at the top of More, behind `FLAGS.ai`.
- **Motion (the person's request, 2026-11-09):**
  - `components/ShimmerText.js` gives the thinking line a sweeping band, and the line steps through Thinking → Reading your transactions → Adding it up → Almost there.
  - FLO's arrow mark sits beside it, still: the person didn't want a moving AI icon.
  - Bubbles slide and fade in, and the list shifts with a spring.
  - A fresh answer writes itself out word by word.
  - The send button springs and fades between grey and lime.
  - All of it is off under reduce-motion.
- **Keyboard:** Android 16 is edge-to-edge, so the window doesn't resize. The screen pads itself from the keyboard's top edge (`screen height − endCoordinates.screenY`). KeyboardAvoidingView's `height` mode overshot and stuck.
- **Emulator checks:**
  - "how much did I spend on food this month?" → ₹950, November 2026, Personal. That's the same as Insights' Food row and the database.
  - Still ₹950 after a ₹500 Personal → Savings transfer, which added a Savings account to the test account.
  - Groceries → ₹250.
  - A second question in the same chat reloads the conversation.
  - With `FLAGS.ai` off, the More row is hidden.
  - The composer sits above the keyboard and returns to the bottom, in light and dark.
- **Review (standards + spec), kept as is on purpose:**
  - Totals are added in the function, not SQL: the spec's tool table says "aggregated in the function".
  - INR only: multi-currency is out of scope and the currency picker is off.
  - Paise are shown when present, to match `formatMoney` and so Insights exactly. Spec 44 says "no decimals"; worth updating the spec.
  - No mic in the composer yet (ticket 08).
  - The usage, cap and context code is still copied between quick add and chat; worth moving into `shared.ts` when ticket 07 touches it.
