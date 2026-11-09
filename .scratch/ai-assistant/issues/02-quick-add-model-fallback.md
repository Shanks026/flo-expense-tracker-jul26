# 02: The model handles what the parser can't

Spec: .claude/features/44-ai-assistant.md ("Shared: the ai-assistant Edge Function", Phase 1)

**What to build:** When the phone's parser isn't sure (a bare "swiggy 340", "2 chai 40", "paid ravi back 500"), the quick-add line shows a small spinner and asks the AI function. The sheet fills when it answers, using the same fields, and the person still taps Save. The function runs as the person under RLS, loads their own accounts and categories, and gets the local date, time and timezone from the app. It checks the model's reply (amount, ids, date range) and answers "couldn't read" rather than pass on a bad guess. A timeout, an error or a failed check leaves the sheet as it was. Every call is recorded with its model, tokens, cost and latency, and a daily cap stops runaway use. The key lives only in a function secret.

This needs three things from the person: a yes on the usage-table SQL (applied with the CLI), the secrets set, and a yes on the deploy.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The usage table exists with RLS; as user A, B's rows read as 0, and an insert for B is refused (rolled-back check); the advisor shows no new WARN
- [ ] A phrase the parser can't read fills the sheet in a dev build; analytics `source` is `quick_ai`
- [ ] An expired session gets 401; "asdf" and a forced timeout leave the sheet usable and unchanged
- [ ] "500 SBI to Axis" (two accounts) comes back "couldn't read", pointing to the Transfer tab
- [ ] Each call writes exactly one usage row; `sk-or-` appears nowhere in the repo or the exported bundle

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
