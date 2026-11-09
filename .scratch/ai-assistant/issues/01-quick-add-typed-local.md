# 01: Quick add from typing, on the phone only

Spec: .claude/features/44-ai-assistant.md (Phase 1, "Quick-add decisions")

**What to build:** In a blank Add sheet, the person types a line like "120 lunch nethu" into a new quick-add line at the top. The keyboard opens there. Tapping done fills the sheet with the amount, type, category, date, account and note, and they tap Save as usual. The phone parses everything itself; there's no network call. The rules are the ones settled in the spec: category words with fallback lists, income words, Tanglish date words, the most recent past weekday, day-first day numbers, and two numbers → not sure. Anything the parser isn't sure about leaves the sheet untouched with a quiet "Couldn't read that". The line appears only for a blank new entry, and only when the AI flag is on.

This ticket also produces the 40-phrase test set, weighted as in the spec. **The person reviews the phrases before the parser is written.** A plain-node check runs the set against both category sets (the onboarding starting set and the person's current set) and prints the results and the local hit rate.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The person has approved the 40 phrases
- [x] The parser answers at least 20 of the 40 on the starting set, all correctly; every case it isn't sure about returns "not sure", never a wrong answer
- [x] "120 lunch nethu" fills the sheet; Save writes the same row as a manual entry, analytics `source` is `quick_local`, and Undo works
- [x] A category tapped after parsing is never overridden; `category_was_prefilled` stays truthful
- [x] Editing, share and notification opens show no quick-add line; with the AI flag off, the sheet is exactly as before
- [x] Pixel_API_36, light and dark: the keyboard covers neither the line nor Save, and the sheet height doesn't jump

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-11-09: the parser half is done.**
- The person approved the 40 phrases.
- The parser and the check script are written, and `node --no-warnings scripts/quick-parse-check.mjs` passes:
  - starting set: 29 answered on the phone, 8 to the model, 3 refused correctly, 0 wrong;
  - current set: 31 on the phone, 6 to the model, 3 refused, 0 wrong.
- One rule was added while testing: "amma"/"mom" next to a word pointing outward ("ku", "to", "gave", "anupinen") goes to the model.

**Still to do:** the AI flag, the quick-add line, and re-filling the sheet with the `accountId` prefill, the `quick_local` source and focus, plus the emulator check. "Code implementation" stays unticked until then.

**2026-11-09: the sheet half is written; the emulator check is still to do.**
- `FLAGS.ai` (on) is in `lib/flags.js`. `components/QuickAddField.js` is the line: a sparkle icon, "Type it: 40 lunch today", and done to parse. A failed parse shows "Couldn't read that" in a row that's always laid out, so the height doesn't change.
- Only the ⊕ tab asks for the line (`openAdd({ quickAdd: true })`). Editing, share, the nudge, auto-detect and onboarding get the sheet as it was. The keyboard opens on the line.
- A parse fills type, amount, category, account (a new `accountId` prefill key, defaulting to the active account), date and note. It sets `source` to `quick_local` and dismisses the keyboard. Save and Undo use the existing path.
- The parsed category counts as prefilled. A chip tapped after a parse is kept on a re-parse of the same type; a chip tapped before any parse gives way.
- `expo export --platform android` bundles cleanly. The quick-parse check still has 0 wrong.
- The model spinner waits for ticket 02.
- Not yet run on a device: FLO isn't installed on Pixel_API_36. The handoff says to hold the native build until phase 2.

**2026-11-09: emulator check on Pixel_API_36, with a new test account.**
- "120 lunch nethu" filled ₹120 · Expense · Food · yesterday (the starting set has no Lunch, so it fell back to Food). The saved row matches a manual entry: expense, 120.00, Food, 2026-11-08, no note, Personal.
- `expense_logged` recorded `source: quick_local`. "250 auto", then tapping Groceries, then re-parsing "250 auto yesterday" kept Groceries, moved the date and logged `category_was_prefilled: false`. "40 chai" logged `true`, and Undo deleted the row.
- Editing, a share intent and onboarding's first expense show no line. With `FLAGS.ai` off, the sheet is as before. The nudge passes no payload, so it gets no line (checked in code, not fired).
- "asdf" and "60 bus today 5" show "Couldn't read that" and leave the sheet alone.
- Two fixes came out of the check:
  - The message now sits inside the line's row. The extra row it used to keep pushed Save under a text keyboard by about 7 dp.
  - The line stays mounted between opens instead of remounting.
- With a docked keyboard, in light and dark, the line and Save both clear the text keyboard and the number pad.
- The first ⊕ open after a cold app start gets focus but no keyboard. This happens with the flag off too (the amount field, 1 of 3 opens each way), so it predates this ticket.
- The emulator now runs with `hw.keyboard=no` and stylus handwriting off, so Gboard docks the way it does on a phone. Supabase keys are in the gitignored `.env.local`, and test credentials are in `.env.test.local`.
