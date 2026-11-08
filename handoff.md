# Handoff — 2026-11-08

Read this first in a new session, then `AGENTS.md`, `.claude/features/00-index.md` (standing rules) and `.claude/features/44-ai-assistant.md`. The full roadmap is under "Direction change" in `docs/matt-implement-flo.md`.

## Direction (decided 2026-11-08)
- **FLO is a personal-use app first. AI is the priority.** The store launch comes later.
- The old "no AI" rule is **lifted** (`00-index.md`, `AGENTS.md`). OpenRouter is the one allowed third-party service (`CLAUDE.md`). It's called over HTTP from one Edge Function (`ai-assistant`), with no SDK, and the key exists only as a secret.
- **AI design rules:**
  - a local parser handles simple entries first;
  - speech-to-text runs on the device;
  - **the model never writes**: it drafts or proposes, the person taps Save, and the existing sheet code writes;
  - every number comes from server code, never from model arithmetic;
  - phase 1 must pass a 40-phrase test (≥90% correct, p50 ≤ 1.5 s) before the chat is built.
- **Model:** `anthropic/claude-haiku-5.5` ($0.10 / $0.50 per M tokens), with fallback `google/gemini-3.1-flash-lite`. Prices were checked on 2026-11-08.

## Done this session
- **Docs:**
  - spec 44 is written and indexed;
  - the AI rule is reversed;
  - testing moves to the **`Pixel_API_36`** emulator (Android 16, AVD on `D:\Android\avd`), made but **never booted**;
  - the SDK's `system-images` and `.sdk` folders are junctions to D: because C: is nearly full.
- **Tracker mod:** `flo-ticket-tracker/` is a copy of the ticket-tracker mod that reads `.scratch` tickets. Load it with `claude --plugin-dir ./flo-ticket-tracker`.
- **Supabase cleanup:**
  - the `ai-interpret` and `ai-report-summary` functions are deleted (only `send-push` remains);
  - the `GEMINI_API_KEY` secret is removed;
  - **only `chrisaustin2001@gmail.com` remains** (358 transactions, 3 accounts, 3 budgets, 1 split; 7 other accounts deleted, every table checked);
  - **there's no test account**, so make one for emulator checks (random email; skip the email link).
- **RLS hardening** (`rls_hardening_ownership_and_splits`):
  - split members can only edit `display_name`;
  - ownership checks on account, category and plan ids for transactions, budgets, plans, bills and splits;
  - split-share writes limited to the entry author or the organizer.

  12 rolled-back checks pass, and the advisor shows only the pre-existing WARNs. The SQL is in `.scratch/rls-hardening.sql`, and the test in `.scratch/rls-hardening-test.sql`. It's **not** in `supabase_migrations` (it was applied with the CLI).
- **Build health:**
  - `node_modules` was missing and is reinstalled with `npm ci` (expo 54.0.37);
  - `npx expo export --platform android` bundles cleanly (4,185 modules);
  - `supabase/.temp/` is git-ignored.

## Tooling notes (important)
- **The Supabase MCP auto-declines every write** (`execute_sql` deletes, `apply_migration`): "declined" comes back with no prompt. Reads work. For writes, either:
  - apply with the CLI after the person says yes: `npx supabase db query --remote=uergtlcfpwajztqgncim --yes -f <file.sql>`; or
  - have the person paste the SQL into the Dashboard SQL editor.
- **CLI reads:** `npx supabase db query --linked --project-ref uergtlcfpwajztqgncim --read-only "<select>"`. Functions and secrets go through the CLI; auto mode blocks agent secret writes, so the person sets secrets.
- If the MCP says "needs sign in": `/mcp`, and pick **FLO's organization**, not "Austin's Org".

## Next, in order
1. **The "weekly report ready" push** still goes out through `send-push`, and Settings no longer has a control for it. Either switch it off for the profile (check the `profiles` report columns; an UPDATE needs a yes and goes through the CLI), or pull spec 39 ticket 01's push removal forward.
2. **Add sheet phone check** (the person, on the vivo, with the existing dev client and Metro): saving, the Undo toast, a prefilled open (share text), and the keyboard staying clear of Save. AI fills this sheet.
3. **Spec 44 tickets:** `/mattpocock-skills:to-tickets .claude/features/44-ai-assistant.md`, then `/mattpocock-skills:implement` for ticket 01.
4. **Spec 44 phase 1 code** (no key needed):
   - `lib/quickParse.js`;
   - `components/QuickAddField.js` in the Add sheet;
   - `FLAGS.ai`;
   - `lib/ai.js`;
   - `supabase/functions/ai-assistant/` (written, not deployed);
   - `app/dev/ai-eval.js` with `lib/aiEvalCases.js`;
   - the `ai_usage` SQL (show it and get a yes; apply with the CLI).
5. **OpenRouter (the person, 2026-11-09 morning):**
   - buy credits;
   - create a key with a credit limit;
   - turn off logging and training;
   - revoke the old August key and the old Gemini key;
   - then run `npx supabase secrets set OPENROUTER_API_KEY=… AI_MODEL_QUICK=anthropic/claude-haiku-5.5 AI_MODEL_CHAT=anthropic/claude-haiku-5.5 AI_MODEL_FALLBACK=google/gemini-3.1-flash-lite --project-ref uergtlcfpwajztqgncim`.
6. **Deploy `ai-assistant` and run the phase 1 gate** (`app/dev/ai-eval.js`). If it fails, stop and decide.
7. **Phase 2 (voice): this is where the native rebuild happens.** `expo-speech-recognition` is a new native dependency (name it to the person first). Then run `npx expo prebuild --clean` (stop Metro first) and `npx expo run:android`. One build covers the phone, and the emulator once it's booted.
8. Phases 3–4 (chat read-only, then proposals). Then spec 39 and spec 40.

**Parked until launch:** spec 44 phase 5, spec 32 tickets 05/07/08, the closed test, Play Billing (41), forgot password (42), PKCE for Google sign-in, and the smaller RLS items (a member-in-split trigger for settlements, hiding `splits.account_id`).

## On the long native build
**Don't do a clean native build now.** Phase 1 is JavaScript only (a parser, a component and an Edge Function), so it runs on the dev client already installed on the phone, through Metro. The first native change is phase 2's speech library, and it forces a rebuild anyway. Building now would mean building twice. Build once, at the start of phase 2, after adding `expo-speech-recognition`.
