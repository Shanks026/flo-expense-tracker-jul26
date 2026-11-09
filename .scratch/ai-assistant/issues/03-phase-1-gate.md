# 03: The phase 1 gate

Spec: .claude/features/44-ai-assistant.md (§1.7)

**What to build:** A dev-only screen, hidden from release builds like the existing dev screens, that runs the 40 phrases through the parser and then the function. For each case it shows whether every field is right, which path answered (phone or model), and the timing (p50 and p90). It can switch between the default model and the challenger. Both models are run, and the results are written into the spec's Implementation Notes.

**Blocked by:** 02

**Status:** resolved

- [x] **≥ 90%** fully correct on the starting category set, on the default model
- [x] Model-path **p50 ≤ 1.5 s**
- [x] The phone answers at least 50% of the cases
- [x] The results for both models, and for the current category set, are recorded in the spec

**→ Gate: if it fails, stop and decide (another model, a better prompt, more local rules) before ticket 04.**

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

**2026-11-09: gate run on Pixel_API_36. Two of three criteria pass; p50 depends on where it's measured.**
- On the starting set, default model (Gemini 3.1 Flash Lite): 40/40 fully correct, and the phone answered 29 of 40.
- Model p50: 1.28 s inside the function (passes) and 1.65 s round trip in the app (fails by 0.15 s).
- Haiku 5.5 as challenger: 37/40, p50 1.89 s in the app.
- Full table: spec 44 → Implementation Notes.
- The screen is `app/dev/ai-eval.js`, under Settings → Developer → AI test set. The function takes an `eval` context and a `model` choice limited to the two configured models.
- Green signal is waiting on the person's call about the p50 criterion.

**2026-11-09: the person passed the gate.** The p50 criterion counts as met on the function's own time (1.28 s). The app's round trip (1.65 s) is recorded but not held against the gate.
