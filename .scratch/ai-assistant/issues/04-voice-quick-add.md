# 04: Voice in the quick-add line

Spec: .claude/features/44-ai-assistant.md (Phase 2)

**What to build:** A mic button at the end of the quick-add line. Hold it, speak ("forty rupees lunch today", or a Tamil phrase), let go, and the words appear in the line and go through the same pipeline as typing. Speech-to-text runs on the device. A setting chooses between English (India) and Tamil. The mic permission is asked the first time it's used, never at launch.

This is the native rebuild: the speech library (`expo-speech-recognition` is recommended) is named to the person before it's added, and checked against SDK 54 and the new architecture. Then Metro is stopped, the native project is regenerated, the app is built, and the regenerated manifest is checked.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] If the permission is denied, the mic hides and typing still works
- [ ] 9 of 10 spoken test phrases fill the sheet correctly, on the phone
- [ ] Release-to-text takes under 1 s, on the phone
- [ ] The language setting switches between English and Tamil, and is remembered

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
