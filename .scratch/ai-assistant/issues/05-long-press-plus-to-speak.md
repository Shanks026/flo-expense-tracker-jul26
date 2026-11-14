# 05: Long-press + to speak

Spec: .claude/features/archive/44-ai-assistant.md (Phase 2, Goal)

**What to build:** Long-pressing the + tab opens the Add sheet already listening. When the person stops speaking, the sheet fills in, and **the filled sheet is the preview**. The transcript stays in the quick-add line, so they can fix a word and parse it again, every field can be edited, and Save writes the entry. There's no separate preview card. A short tap on + works exactly as before.

**Blocked by:** 04

**Status:** resolved

- [x] Long-press + → speak → the sheet is filled, and Save writes one row
- [x] Editing the transcript and parsing again updates the fields
- [x] A short tap on + opens the sheet as before, with no listening
- [x] Phone check, light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

**2026-11-09: built and checked on Pixel_API_36. The spoken checks need the phone.**
- **How it works:** a long-press on ⊕ (400 ms, with a haptic) opens the sheet with `listen: true`. The quick-add line then listens without holding, in non-continuous mode, and stops by itself when the person stops speaking. What it hears is submitted like a typed line. Tapping the mic while it listens ends it early. Without voice (lite build, unsupported, or permission refused), the long-press opens the sheet as a tap does and focuses the line.
- **Two bugs found on the emulator and fixed:**
  - The sheet's content remounts on every open, so a short tap after a long-press listened again. Every other open now clears the listen request.
  - On a cold start the speech module may not answer when the tab bar first renders, so the long-press handler was missing. Support is now checked at press time.
- **Emulator:**
  - long-press opens the sheet listening, including the first open after a cold start;
  - with no audio it ends with "Couldn't hear that";
  - a short tap opens it as before.
- **Still to do on the phone:** speak, check the filled sheet and Save, edit the transcript and re-parse, and check light and dark.

**2026-11-09: phone check passed (vivo I2220, standalone release APK).** The person reports that long-press ⊕ → speak → fill → Save writes the entry, editing the transcript and re-parsing updates the fields, and light and dark both look right. Ticked from that report.
