# 01: Appearance: System / Light / Dark

Spec: .claude/features/37-design-system-and-koban.md

**What to build:** FLO follows the phone's light or dark setting by default, and the user can force Light or Dark.
- The app's native interface style becomes automatic. This needs a native rebuild.
- The theme gains a `system` mode that follows the OS scheme live, and it's the default for new and existing users without a saved choice.
- Settings → Appearance offers System / Light / Dark. This brings back the switch that went away when Personalize was flagged off (spec 34).
- The accent is fixed to the brand lime; there's no accent picker anywhere.
- The profile theme sync stores only the mode. Existing `theme_accent` and `equipped_card_theme` values are ignored, not cleared.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] With Appearance on System, switching the phone between light and dark switches FLO without a restart
- [ ] Forcing Light or Dark overrides the phone setting and survives a cold start
- [ ] The choice is saved to `profiles.theme_mode` and restored on another sign-in (checked via the Supabase MCP)
- [ ] No accent picker, Personalize or card-skin UI anywhere; a stored non-lime accent no longer changes the app

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
