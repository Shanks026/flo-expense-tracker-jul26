# 01: Appearance: System / Light / Dark

Spec: .claude/features/archive/37-design-system-and-koban.md

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

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- `theme/ThemeContext.js` stores a mode preference (`system` | `light` | `dark`, default `system`, AsyncStorage `flo.themeMode`) and resolves `modeId` from `useColorScheme()` when it's `system`, so a phone switch repaints live. It exposes `modePreference` and `setModePreference`; `modeId` stays the resolved light/dark that StatusBar, the navigation bar and `resolveColors` read. The accent is fixed to lime and accent storage is gone; the two axes stay internal.
- `ThemeProfileSync` resets to System on sign-in and applies `profiles.theme_mode` when it's a valid preference. `theme_accent` and `equipped_card_theme` are ignored, not cleared.
- Settings → Appearance: the shared `AppearanceToggle` is now System / Light / Dark (radio roles, labels, selected state). It applies instantly and saves `theme_mode` silently.
- `app.json` `userInterfaceStyle` → `automatic` (**needs a native rebuild**). The sign-in screen follows the phone's scheme (still independent of the account, so no repaint flash on sign-in).
- Migration `profiles_theme_mode_default_system` (approved): `theme_mode` defaults to `system`, checked via the MCP. No check constraint on the column, so `system` saves fine. Existing rows untouched.
- The flagged-off Personalize uses the new API; its accent picker only previews and never applies.
- Open (emulator checks paused): the live phone-setting switch, a forced mode surviving a cold start, the choice following the account, and no accent UI.
