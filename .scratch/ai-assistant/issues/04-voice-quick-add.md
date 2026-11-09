# 04: Voice in the quick-add line

Spec: .claude/features/44-ai-assistant.md (Phase 2)

**What to build:** A mic button at the end of the quick-add line. Hold it, speak ("forty rupees lunch today", or a Tamil phrase), let go, and the words appear in the line and go through the same pipeline as typing. Speech-to-text runs on the device. A setting chooses between English (India) and Tamil. The mic permission is asked the first time it's used, never at launch.

This is the native rebuild: the speech library (`expo-speech-recognition` is recommended) is named to the person before it's added, and checked against SDK 54 and the new architecture. Then Metro is stopped, the native project is regenerated, the app is built, and the regenerated manifest is checked.

**Blocked by:** 03

**Status:** resolved

- [x] If the permission is denied, the mic hides and typing still works
- [x] 9 of 10 spoken test phrases fill the sheet correctly, on the phone
- [x] Release-to-text takes under 1 s, on the phone
- [x] The language setting switches between English and Tamil, and is remembered

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

**2026-11-09: built and checked on Pixel_API_36. The spoken checks need the phone.**
- **Library:** `expo-speech-recognition@3.1.3`, the library's own `sdk-54` release. The 58.x line is for newer SDKs.
- **Personal build only:** `app.config.js` adds the speech plugin and lifts the `RECORD_AUDIO` block. It also drops expo-image-picker's `microphonePermission: false`, which was stripping `RECORD_AUDIO` from the manifest. The lite build keeps the mic blocked and the button hidden (`extra.voiceEnabled`).
- **Manifest** after `prebuild --clean`: `RECORD_AUDIO` is present, CAMERA is still removed, and there are queries for `googlequicksearchbox` and `com.google.android.tts` RecognitionService.
- **Code:** `lib/voice.js` holds the language (`en-IN` / `ta-IN`, kept on the device), the permission, and the hold-to-talk session. It prefers on-device recognition when the language pack is installed. `QuickAddField` gets the mic. Settings → Preferences gets a Voice language row.
- **Emulator:**
  - the first hold asks for the permission;
  - two denials hide the mic and typing still works;
  - after a grant, holding shows "Listening…" and Android's mic indicator;
  - release with no audio gives "Couldn't hear that";
  - Tamil survives an app restart.
- **Still to do on the phone:**
  - 9 of 10 spoken phrases fill the sheet;
  - release-to-text under 1 s (dev builds log `voice: release to text … ms`).
  The emulator's mic doesn't receive host audio.
- The phone needs this new native build, installed over adb / `expo run:android`.

**2026-11-09: phone check passed (vivo I2220, standalone release APK).** The person reports that at least 9 of 10 spoken phrases filled the sheet correctly and the text appeared in under 1 s. Ticked from that report.
