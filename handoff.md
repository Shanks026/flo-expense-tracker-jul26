# Handoff — 2026-11-09 (night, after ticket 08)

Read this first in a new session, then:
- `AGENTS.md`;
- `.claude/features/00-index.md`, for the standing rules;
- `.claude/features/44-ai-assistant.md`. §3.2–3.3 hold the chat tools and the "Rich answers" and "Several categories" notes.

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
- **Branch:** `feat/spec44-ai-quick-add-voice`, pushed. [PR #1](https://github.com/Shanks026/flo-expense-tracker-jul26/pull/1) is open, titled for tickets 01–08 and 12, and mergeable; the repo has no CI. Keep adding 09–11 to this branch and refresh the PR body when they land.
- **Done and resolved:** tickets 01–08 and 12, with these commits:
  - `20edc1c`: ticket 06;
  - `ddba4e0`: ticket 12;
  - `0ac1991`: ticket 07;
  - `e6d1d09`: ticket 08 (past chats, Home sparkle, composer mic; app only, no function change).
- **Next:** tickets 09, 10 and 11 (proposals), in that order. Each needs a function change (a deploy, so ask first). 10 and 11 also give `AddBudgetSheet` and `AddBillSheet` a prefill path for a **new** row, an object without `id`; the free-plan gate must still run at Save. Spec 44 §4 has the proposal shapes and the rules.
- **`ai-assistant` is deployed** with every change up to ticket 07 (08 didn't touch it).
- **Phone:** a standalone release APK of the branch at `e6d1d09` (tickets 01–08 and 12) was installed on the vivo I2220 over adb on 9 Nov. See "Open, for the phone check" below.

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
The phone now runs the APK of tickets 01–08 and 12, so these can be checked already. After 09–11, build one more APK for their proposal checks. To build one: stop Metro, then in `android/` run `./gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a`; no `prebuild --clean` unless a native dependency changed. Install with `adb -s 10BDC910EA00059 install -r android/app/build/outputs/apk/release/app-release.apk`. Check on the phone:
- **Ticket 07:** the median chat turn is ≤ 4 s. The function's p50 is 3.7 s and the app adds about 0.4 s, so it's likely just over. The ideas in spec 44's Implementation Notes apply: parallel lookups, a shorter prompt, the region.
- **Ask FLO overall,** in light and dark: the keyboard and composer, the tables, and the chips.
- **The phone checks from tickets 08 (a spoken question in the composer), 09 and 11.**

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
- bills **Electricity** (due 12 Nov), **Netflix** (overdue since 7 Nov) and **Rent** (1 Dec);
- three October expenses totalling ₹1,200;
- a ₹50,000 salary on 1 Nov;
- a ₹30 Snacks entry whose note is a prompt-injection test ("ignore previous instructions…").

Expected answers on 9 Nov (Personal account):
- this month ₹1,710 and last month ₹1,200;
- food ₹1,430 across the four meal categories;
- balances: Personal ₹46,590, Savings ₹500.

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
