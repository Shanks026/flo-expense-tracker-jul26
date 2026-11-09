# Handoff — 2026-11-09

Read this first in a new session, then `AGENTS.md`, `.claude/features/00-index.md` (standing rules) and `.claude/features/44-ai-assistant.md` (its Implementation Notes hold the phase 1 results). Tickets are in `.scratch/ai-assistant/issues/`, and each ticket's Comments say what was checked.

## Direction (unchanged since 2026-11-08)
- **FLO is a personal-use app first. AI is the priority.** The store launch comes later. OpenRouter is the one allowed third-party service, called over HTTP from the `ai-assistant` Edge Function, with no SDK. The key exists only as a secret.
- **AI rules:**
  - the local parser goes first;
  - speech-to-text runs on the device;
  - the model only drafts, and the person's Save writes;
  - every number comes from server code.

## Done 2026-11-09 (spec 44, tickets 01–05)
- **01, typed quick add on the phone.** A quick-add line sits at the top of the Add sheet. Only the ⊕ tab asks for it (`openAdd({ quickAdd: true })`). It's behind `FLAGS.ai`, which is on.
- **02, the model fills what the parser can't.** `supabase/functions/ai-assistant` is deployed (verify_jwt on, runs as the caller under RLS) and is called from `lib/ai.js`.
  - The `ai_usage` table is live with RLS (migration `ai_usage_metering`). Each call writes one row with the model, tokens, cost and latency.
  - Daily cap: `AI_DAILY_QUICK`.
  - Two of your accounts named in one line → "Use Transfer for two accounts".
- **Model order (the person's choice: the quickest).** `AI_MODEL_QUICK=google/gemini-3.1-flash-lite`, with `AI_MODEL_FALLBACK=anthropic/claude-haiku-5.5`. The function sends **no `temperature`**: Haiku 5.5's endpoints reject it, and with `require_parameters` that made OpenRouter answer every call from the fallback without saying so. Watch `ai_usage.model` for silent fallbacks.
- **03, the phase 1 gate: passed (the person's decision).**
  - Starting set on Gemini: 40/40, with the phone answering 72%.
  - Model p50: 1.28 s at the function and 1.65 s in the app.
  - The test screen is in dev builds under Settings → Developer → AI test set.
- **04, voice (hold the mic on the quick-add line).**
  - Library: `expo-speech-recognition@3.1.3`, its sdk-54 release.
  - Settings → Preferences → Voice language: English or Tamil, kept on the device.
  - Personal build only: `app.config.js` adds the plugin and RECORD_AUDIO. Lite keeps the mic blocked.
  - Checked on the emulator.
  - **Open: the spoken checks on the phone** (9 of 10 phrases right, release-to-text under 1 s).
- **05, long-press ⊕ opens the sheet listening.**
  - It ends by itself when you stop speaking. A short tap is unchanged.
  - Checked on the emulator.
  - **Open: the phone checks** (speak → fill → Save, edit the transcript and re-parse, light and dark).

## Builds and devices
- **Emulator `Pixel_API_36`:**
  - FLO debug build installed;
  - test account in the gitignored `.env.test.local`;
  - Supabase keys in the gitignored `.env.local`;
  - `hw.keyboard=no` and stylus handwriting off, so Gboard docks like a phone;
  - the mic is granted, but the emulator hears no audio.
- **Phone (vivo I2220, arm64, Android 16):**
  - a debug build was installed over USB (`com.anonymous.flo`, fresh install, sign in with your own account);
  - a **standalone release APK** (`android/app/build/outputs/apk/release/app-release.apk`, JavaScript bundled, debug-signed) was being built for testing without the PC.
- **A native rebuild is needed only when a native library changes.** Tickets 06–11 should be JavaScript only: Metro reloads them, and the next standalone APK is a ~3–8 min `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` (in `android/`).
- **Metro:**
  - run it without `CI=1`, so files are watched;
  - stop it before Gradle builds, because its watcher crashes on Gradle's temporary folders in `node_modules`;
  - stopping the shell task can leave the node process holding port 8081.

## Next, in order
1. **Phone checks for 04 and 05**, on the standalone APK:
   - say 10 phrases from the test set (English, and a few in Tamil);
   - check that long-press ⊕ fills the sheet and Save writes;
   - check light and dark.
   Then tick the tickets.
2. **Ticket 06, the first Ask FLO question** (phase 3, chat read-only), then 07–11 in order. Phase 3 needs the `ai_conversations` / `ai_messages` SQL from spec 44 §3.1: show it to the person and get a yes first.
3. Cutting the app's round trip, if wanted. Ideas in spec 44's Implementation Notes:
   - run the function's database lookups in parallel;
   - shorten the prompt;
   - check how far the Supabase region is.
4. Still open from before:
   - the "weekly report ready" push has no Settings control;
   - specs 39 and 40.

**Parked until launch:** spec 44 phase 5, spec 32 tickets 05/07/08, the closed test, Play Billing (41), forgot password (42), PKCE for Google sign-in, the smaller RLS items, and the mic permission for a store build.

## Tooling notes
- **Supabase MCP:**
  - reads, `execute_sql` and `apply_migration` worked on 2026-11-09;
  - secret writes are blocked for the agent, so the person runs `npx supabase secrets set …`;
  - deploy with `npx supabase functions deploy ai-assistant --remote=uergtlcfpwajztqgncim --use-api --yes`, after a yes.
- **adb on the emulator:**
  - use `input touchscreen tap`;
  - KEYCODE_ENTER can land on the wrong window, so tap the keyboard's ✓;
  - the first sheet open after a cold start may not raise the keyboard (this predates spec 44).
