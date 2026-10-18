# 07: EAS cloud builds that boot

Spec: .claude/features/32-safe-closed-test-build.md

**What to build:** A cloud EAS build of the lite profile boots and signs in instead of crashing at launch. The Supabase URL and anon key are set as EAS environment variables for the preview and production environments, and the build profiles pick them up. `eas.json` switches to `appVersionSource: remote`, with the remote version code set above the current 2, so every upload gets a fresh, higher version code automatically.

**Blocked by:** None (can start immediately). It assumes the P0 safety track has made lite the store default and removed `submit.full`.

**Status:** ready-for-agent

- [ ] `eas.json` uses `appVersionSource: remote`, and the remote Android version code starts above 2
- [ ] The Supabase URL and anon key exist as EAS environment variables for preview and production, with nothing new committed to the repo
- [ ] A cloud `lite-preview` build installs on the emulator, boots, and signs in to the test account
- [ ] Two successive cloud builds get increasing version codes

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
