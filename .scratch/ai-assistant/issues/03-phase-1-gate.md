# 03: The phase 1 gate

Spec: .claude/features/44-ai-assistant.md (§1.7)

**What to build:** A dev-only screen, hidden from release builds like the existing dev screens, that runs the 40 phrases through the parser and then the function. For each case it shows whether every field is right, which path answered (phone or model), and the timing (p50 and p90). It can switch between the default model and the challenger. Both models are run, and the results are written into the spec's Implementation Notes.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] **≥ 90%** fully correct on the starting category set, on the default model
- [ ] Model-path **p50 ≤ 1.5 s**
- [ ] The phone answers at least 50% of the cases
- [ ] The results for both models, and for the current category set, are recorded in the spec

**→ Gate: if it fails, stop and decide (another model, a better prompt, more local rules) before ticket 04.**

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
