# 01: Quick add from typing, on the phone only

Spec: .claude/features/44-ai-assistant.md (Phase 1, "Quick-add decisions")

**What to build:** In a blank Add sheet, the person types a line like "120 lunch nethu" into a new quick-add line at the top. The keyboard opens there. Tapping done fills the sheet with the amount, type, category, date, account and note, and they tap Save as usual. The phone parses everything itself; there's no network call. The rules are the ones settled in the spec: category words with fallback lists, income words, Tanglish date words, the most recent past weekday, day-first day numbers, and two numbers → not sure. Anything the parser isn't sure about leaves the sheet untouched with a quiet "Couldn't read that". The line appears only for a blank new entry, and only when the AI flag is on.

This ticket also produces the 40-phrase test set, weighted as in the spec. **The person reviews the phrases before the parser is written.** A plain-node check runs the set against both category sets (the onboarding starting set and the person's current set) and prints the results and the local hit rate.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The person has approved the 40 phrases
- [x] The parser answers at least 20 of the 40 on the starting set, all correctly; every case it isn't sure about returns "not sure", never a wrong answer
- [ ] "120 lunch nethu" fills the sheet; Save writes the same row as a manual entry, analytics `source` is `quick_local`, and Undo works
- [ ] A category tapped after parsing is never overridden; `category_was_prefilled` stays truthful
- [ ] Editing, share and notification opens show no quick-add line; with the AI flag off, the sheet is exactly as before
- [ ] Pixel_API_36, light and dark: the keyboard covers neither the line nor Save, and the sheet height doesn't jump

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-11-09: the parser half is done.**
- The person approved the 40 phrases.
- The parser and the check script are written, and `node --no-warnings scripts/quick-parse-check.mjs` passes:
  - starting set: 29 answered on the phone, 8 to the model, 3 refused correctly, 0 wrong;
  - current set: 31 on the phone, 6 to the model, 3 refused, 0 wrong.
- One rule was added while testing: "amma"/"mom" next to a word pointing outward ("ku", "to", "gave", "anupinen") goes to the model.

**Still to do:** the AI flag, the quick-add line, and re-filling the sheet with the `accountId` prefill, the `quick_local` source and focus, plus the emulator check. "Code implementation" stays unticked until then.
