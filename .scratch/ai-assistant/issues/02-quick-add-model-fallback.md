# 02: The model handles what the parser can't

Spec: .claude/features/44-ai-assistant.md ("Shared: the ai-assistant Edge Function", Phase 1)

**What to build:** When the phone's parser isn't sure (a bare "swiggy 340", "2 chai 40", "paid ravi back 500"), the quick-add line shows a small spinner and asks the AI function. The sheet fills when it answers, using the same fields, and the person still taps Save. The function runs as the person under RLS, loads their own accounts and categories, and gets the local date, time and timezone from the app. It checks the model's reply (amount, ids, date range) and answers "couldn't read" rather than pass on a bad guess. A timeout, an error or a failed check leaves the sheet as it was. Every call is recorded with its model, tokens, cost and latency, and a daily cap stops runaway use. The key lives only in a function secret.

This needs three things from the person: a yes on the usage-table SQL (applied with the CLI), the secrets set, and a yes on the deploy.

**Blocked by:** 01

**Status:** resolved

- [x] The usage table exists with RLS; as user A, B's rows read as 0, and an insert for B is refused (rolled-back check); the advisor shows no new WARN
- [x] A phrase the parser can't read fills the sheet in a dev build; analytics `source` is `quick_ai`
- [x] An expired session gets 401; "asdf" and a forced timeout leave the sheet usable and unchanged
- [x] "500 SBI to Axis" (two accounts) comes back "couldn't read", pointing to the Transfer tab
- [x] Each call writes exactly one usage row; `sk-or-` appears nowhere in the repo or the exported bundle

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

**2026-11-09: built, deployed and checked on Pixel_API_36.**
- The person approved the SQL and the deploy. `ai_usage_metering` is applied, and the security advisor shows the same three WARN groups as before.
- RLS check, rolled back: user A sees 0 of B's rows, and an insert for B is refused by the policy.
- `ai-assistant` is deployed with verify_jwt. No token and an expired token both get 401 from the gateway. The function runs as the caller with the anon key.
- On the emulator:
  - "swiggy 340" → ₹340, Food, note "swiggy". "2 chai 40" → ₹40, Food, note "chai". Both saves logged `source: quick_ai`.
  - "asdf" → "Couldn't read that".
  - "500 SBI to Axis" → "Use Transfer for two accounts". It's caught before any model call.
  - With the network off, the sheet stays unchanged with "Couldn't read that".
  - A chip tapped while the model is thinking makes the late answer drop.
- Every call that reaches the function writes one usage row, including cap hits and failures. Each answer cost about $0.0004 and took about 1.5 s.
- The answering model was `google/gemini-3.1-flash-lite`, so `AI_MODEL_QUICK` seems to be set to it rather than Haiku.
- `sk-or-` appears in neither the exported bundle nor the repo, apart from the spec text.
- Changes from the spec, because OpenRouter's docs (checked 2026-11-09) differ:
  - `usage: {include: true}` is deprecated (usage is always returned);
  - the title header is `X-OpenRouter-Title`;
  - no `HTTP-Referer`, since FLO has no site URL.
- Future dates are refused, the same as the sheet's date picker.
- A true 8 s model timeout wasn't forced. The offline path covers the client side.
