# Handoff — 2026-11-09 (evening)

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
- **Branch:** `feat/spec44-ai-quick-add-voice` (PR #1). Not pushed since `cc325c5`.
- **Done and resolved:** tickets 01–07 and 12, with these commits:
  - `20edc1c`: ticket 06;
  - `ddba4e0`: ticket 12;
  - `0ac1991`: ticket 07.
- **Next:** ticket 08 (past chats, the Home sparkle, and the mic in the composer), then 09, 10 and 11 (proposals). Ticket 09 waits for 08.
- **`ai-assistant` is deployed** with every change up to ticket 07.

## What Ask FLO is now
- **Entry:** a row at the top of More opens `app/assistant.js`. It's behind `FLAGS.ai`.
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

## Open, for the phone check after spec 44
Build one standalone APK when 08–11 are done. The phone currently runs a pre-06 APK, with no Ask FLO. Then check on the phone:
- **Ticket 07:** the median chat turn is ≤ 4 s. The function's p50 is 3.7 s and the app adds about 0.4 s, so it's likely just over. The ideas in spec 44's Implementation Notes apply: parallel lookups, a shorter prompt, the region.
- **Ask FLO overall,** in light and dark: the keyboard and composer, the tables, and the chips.
- **The phone checks from tickets 09 and 11.**

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
  - The implement skill can only be started by the person; the agent can't call it.
- **Metro:**
  - run it without `CI=1`, so files are watched;
  - stop it before Gradle builds;
  - stopping the shell task can leave node holding port 8081.

**Parked until launch:** spec 44 phase 5, spec 32 tickets 05/07/08, the closed test, Play Billing (41), forgot password (42), PKCE for Google sign-in, the smaller RLS items, and the mic permission for a store build.
