# Handoff — 2026-11-09 (late night, after tickets 09–11)

Read this first in a new session, then:
- `AGENTS.md`;
- `.claude/features/00-index.md`, for the standing rules;
- `.claude/features/archive/44-ai-assistant.md`. §3.2–3.3 hold the chat tools and the "Rich answers" and "Several categories" notes; §4 and the "Phase 4: proposals" Implementation Notes hold the proposals.

Tickets are in `.scratch/ai-assistant/issues/`, and each ticket's Comments say what was checked.

## Direction (unchanged)
- **FLO is personal-use first, and AI is the priority.** Finish spec 44, then build one standalone APK for a single phone check of everything.
- **OpenRouter** is the one allowed third-party service. It is called over HTTP from the `ai-assistant` Edge Function, with no SDK. The key exists only as a secret.
- **AI rules:**
  - the local parser goes first;
  - speech-to-text runs on the device;
  - the model only drafts, and the person's Save writes;
  - every number comes from server code, never from the model.

## Where it stands
- **Branch:** `feat/spec44-ai-quick-add-voice`, pushed at `c285ab6`. [PR #1](https://github.com/Shanks026/flo-expense-tracker-jul26/pull/1) is open, titled for tickets 01–12, with its body refreshed. The repo has no CI.
- **Spec 44 is built:** all twelve tickets (01–12). This session's commits:
  - `d243f27`: ticket 09 (transaction proposals);
  - `9a5d8af`: ticket 10 (budget proposals);
  - `ebfd699`: ticket 11 (bill proposals);
  - `c285ab6`: review follow-ups.
- **`ai-assistant` is deployed** with everything up to `c285ab6`.
- **Next: the one phone check of everything** (see below). After that, Phase 4's approval, then whatever the person picks next. A possible follow-up is bulk drafting (several entries in one message), which the person asked about; it's one draft per answer for now.
- **Phone:** see "Open, for the phone check".

## What Ask FLO is now
- **Entry:** a row at the top of More, and a sparkle beside the bell on Home, open `app/assistant.js`. Both are behind `FLAGS.ai`.
- **Past chats** (`app/assistant/history.js`, ticket 08): newest first, titled from the first question. A tap returns to the chat with `router.dismissTo('/assistant', { id, at })`; the bin deletes the conversation (messages cascade) through `deleteConversation` in `lib/ai.js`. The chat header has Past chats, and New chat once there's a turn.
- **Composer mic** (ticket 08): sits in Send's place while the composer is empty; hold, speak, let go, and the question is sent as if typed. Uses `lib/voice.js` like the quick-add mic.
- **`useAssistantConversation`** reports `loadedId`, the id its rows belong to. A loaded id with no rows means the chat was deleted, and the screen starts a new one.
- **Function:** `supabase/functions/ai-assistant/chat.ts` holds the chat mode; `index.ts` is quick add; `shared.ts` holds what both use.
- **Six read-only tools,** each computed on the server as the caller under RLS:
  - `spend_summary`: one or several categories, with a breakdown by category, day, week or month;
  - `accounts_overview`;
  - `compare_periods`;
  - `find_transactions`;
  - `budget_status`, read straight from `v_budgets_with_spent`;
  - `bills_due`.
  Totals count only the exact types `expense` and `income`.
- **Writes:** `ai_conversations`, `ai_messages` and `ai_usage` only, and only after a turn succeeds. `ai_messages.tool_calls` stores the tool log, results included.
- **Proposals (09–11):**
  - `propose_transaction`, `propose_budget` and `propose_bill` live in `proposals.ts`, which has no Supabase client;
  - one checked draft per answer goes into `ai_messages.proposal`;
  - `components/ProposalCard.js` shows it with Review and Dismiss. Review opens the Add, Add Budget or Add Bill sheet pre-filled as a **new** row (an object without `id`), and the sheet's `onDone({ saved })` turns the card to "Saved ✓";
  - the app keeps `proposal.status` (`saved` | `dismissed`) on the row through `setProposalStatus`;
  - earlier drafts go into the model's history as a bracketed note with their status;
  - a budget for a category they don't have gets a question, not a guess.
- **`calculate` tool and all-time ranges** (fix after the person's phone test): sums are done in code from tool totals and amounts the person mentions; `spend_summary` with no `start` means all time; when lookups run out, a last-chance call answers from what was found. Spec 44's Implementation Notes ("Phone bug: how much is left") have the details.
- **`max_tokens` is 1500 for chat.** At 500, Haiku 5.5's reasoning cut answers off. Empty and cut-off answers are logged (`chat answer cut off|empty`).
- **Categories are dynamic.** The prompt maps a word like "food" onto the person's own categories (Breakfast, Lunch, Dinner, Snacks…), names what it counted, and says what it left out (Groceries). A supplied but empty category list is an error, never a silent "all categories".
- **Answers:**
  - they sit on the page with no bubble (only the person's questions are bubbles);
  - `components/RichText.js` draws bold, lists and a heading;
  - `components/BreakdownTable.js` draws tables from the stored tool results, never from the model's text.
- **Motion:**
  - a shimmer thinking line (`components/ShimmerText.js`) next to FLO's arrow mark, which stays still (the person didn't want a moving AI icon);
  - bubbles slide in, answers write out word by word, and the send button springs;
  - all of it is off under reduce-motion.
- **Keyboard:** Android 16 is edge-to-edge, so the window doesn't resize. The screen pads itself from the keyboard's top edge (`screen height − endCoordinates.screenY`).
- **Starter chips** on the empty chat: This month so far · Biggest categories · Am I over a budget? · Bills this week.
- **Model:** `AI_MODEL_CHAT` is Haiku 5.5 (spec default), and `AI_MODEL_QUICK` is Gemini 3.1 Flash Lite. A chat turn costs about $0.001, with p50 3.7 s and p90 4.9 s at the function.

## Open, for the phone check
A standalone release APK of the branch at `c285ab6` (all of spec 44) was built after ticket 11; the person installs it, or plugs the phone in. To build one: stop Metro (and any node left on port 8081), then in `android/` run `./gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a`; no `prebuild --clean` unless a native dependency changed. Install with `adb -s 10BDC910EA00059 install -r android/app/build/outputs/apk/release/app-release.apk`. Check on the phone:
- **Ticket 07:** the median chat turn is ≤ 4 s. The function's p50 was 3.7 s at the old 500-token cap, so recheck it now. The ideas in spec 44's Implementation Notes apply: parallel lookups, a shorter prompt, the region.
- **Ask FLO overall,** in light and dark: the keyboard and composer, the tables, the chips and the proposal cards.
- **08:** a spoken question in the composer.
- **09–11:** one draft of each kind, from Review to Save, and Dismiss.

## Decisions made today
- **Paise:** answers show paise when there are any, to match `formatMoney` and so match Insights exactly. Spec 44 still says "no decimals"; update the spec at some point.
- **Accounts month:** `accounts_overview` uses the calendar month by local date, as the spec asks. The account card follows the Settings reset period, and the two agree while that's Monthly.
- **Overdue bills:** they are always listed, first.
- **Close to a budget:** 80% or more used. This was chosen in the tool; it isn't the Budgets screen's own rule.

## Test account (Pixel_API_36, credentials in the gitignored `.env.test.local`)
It now holds a lot of test data. Keep it unless asked:
- the **Savings** account with a ₹500 transfer from Personal;
- **Food renamed to Lunch**, plus Breakfast, Dinner and Snacks with one entry each;
- budgets **Lunch ₹800** and **Monthly spending ₹2,000**;
- bills **Electricity** (due 12 Nov), **Netflix** (overdue since 7 Nov) and **Rent** (1 Dec), plus a **second identical Rent** made by the ticket 11 check (it can be deleted);
- from tickets 09–10: a ₹250 Transport "Auto" expense on 8 Nov, and a **Snacks ₹6,000** monthly budget. The Lunch budget is now named "Lunch" (saving it renamed it);
- three October expenses totalling ₹1,200;
- a ₹50,000 salary on 1 Nov;
- a ₹30 Snacks entry whose note is a prompt-injection test ("ignore previous instructions…").

Expected answers on 9 Nov (Personal account):
- this month ₹1,960 (₹1,710 before the ₹250 from ticket 09) and last month ₹1,200;
- food ₹1,430 across the four meal categories;
- balances: Personal ₹46,340 (₹46,590 less the ₹250; worked out, not yet seen on screen), Savings ₹500.

## Tooling notes
- **Deploying:** `npx supabase functions deploy ai-assistant --remote=uergtlcfpwajztqgncim --use-api --yes`, only after the person says yes.
- **Type-checking the function:** copy `supabase/functions/ai-assistant/*.ts` into a scratch folder with a `deno.json` of `{"nodeModulesDir":"auto"}`, then run `npx -y deno@2 check index.ts`. Inside the repo, Deno trips on the app's `node_modules`.
- **Driving the emulator:** see the memory note.
  - Send one tap per command, or tap by label via `uiautomator dump`.
  - Set `MSYS_NO_PATHCONV=1` in Git Bash.
  - Inside a `while read` loop, `adb shell` swallows stdin, so read the list from fd 3 and run adb with `</dev/null`.
  - A scratch `ask.sh` (type a question, send, wait for the shimmer to end) made the 15-question run easy; rebuild it if needed.
- **Ticket tracker:**
  - `/mattpocock-skills:implement <ticket path>` now always opens the FLO tickets pane and makes that ticket active. After a plugin change, run `/reload-plugins`.
  - It looks for `.scratch` from the current folder, so keep the shell at the repo root.
  - The implement skill can only be started by the person; the agent can't call it. Start each ticket with it so the pane opens on that ticket.
- **Two devices are attached** (the emulator and the phone), so use `adb -s emulator-5554 …` or `adb -s 10BDC910EA00059 …`; a bare `adb` command fails.
- **Metro:**
  - run it without `CI=1`, so files are watched;
  - stop it before Gradle builds (it was stopped for the 9 Nov APK, so start it again with `npx expo start` before emulator work);
  - stopping the shell task can leave node holding port 8081.

**Parked until launch:** spec 44 phase 5, spec 32 tickets 05/07/08, the closed test, Play Billing (41), forgot password (42), PKCE for Google sign-in, the smaller RLS items, and the mic permission for a store build.
