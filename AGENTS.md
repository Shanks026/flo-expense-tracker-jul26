# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

---

# FLO — project guide

FLO is a personal expense tracker: **Expo (SDK 54) / React Native 0.81 / React 19**
front end, **Supabase** (auth + Postgres w/ RLS + Deno Edge Functions) backend.
File-based routing via **expo-router**. New architecture enabled. Currency
defaults to INR; the target market is India.

## Commands

- `npm start` / `npx expo start` — Metro, Expo-Go-compatible for JS-only work.
- `npm run android` / `npm run ios` — `expo run:android|ios` (dev-client build).
  Required for any feature touching a native module (share-intent,
  notifications, notification-listener). Not Expo Go.
- `npx expo prebuild` — regenerates `android/` (gitignored). `app.json` `plugins`
  is the source of truth; check the regenerated `AndroidManifest.xml` after
  adding any native dependency.
- No lint, no tests, no typecheck script. Code is `.js` (JSX), not `.ts`, though
  `tsconfig` extends Expo's base. Don't invent a test runner; verify by running
  the app.

## Architecture & data flow

The whole app's reactivity rests on three primitives — learn these first:

1. **`useDataRefresh()`** (`lib/DataRefreshContext.js`) — a global integer
   `version` + `notifyChanged()`. After ANY mutation, call `notifyChanged()`;
   every read hook depends on `version` and refetches. This is the cache-bust.
   There is no react-query / SWR / Redux.
2. **`useAccount()`** (`lib/AccountContext.js`) — `activeAccountId`. Most data is
   account-scoped; read hooks filter by it and return `[]` when it's null.
3. **`useAuth()`** (`lib/AuthContext.js`) — Supabase session.

**Read hooks** (`hooks/use*.js`) follow one shape: subscribe to `version`, scope
by `activeAccountId`, expose `{ data, loading, refetch }`. See
`hooks/useTransactions.js` as the canonical example. **Mutations** live in
`lib/*.js` as plain async functions calling `supabase`; the caller runs
`notifyChanged()` afterward. Keep reads in `hooks/`, writes in `lib/`.

## Layout & providers

`app/_layout.js` is the spine: a deep provider stack + a set of headless
"sibling of `<Stack>`" components (`OnboardingGate`, `ThemeProfileSync`,
`TimezoneSync`, `ShareIntentHandler`, `NotificationSync`, `PushTokenSync`,
`DetectedTransactionHandler`). These exist as Stack siblings because they need
hooks (`useProfile` → `useDataRefresh`) that `RootNavigator` defines but cannot
itself consume. Redirect ownership is split strictly by session:
`RootNavigator` owns all `!session` routing, `OnboardingGate` owns all `session`
routing (`profiles.onboarded_at` is the flag). Preserve that split — it exists
to kill route-flash bugs, documented at length in the file's comments.

**Bottom sheets** (`@gorhom/bottom-sheet`) use a uniform pattern:
`<XSheetProvider>` in the stack + a `useXSheet()` opener hook (e.g.
`AddTransactionSheet`, `ProUpsellSheet`). Follow it for any new sheet.

## Theming

Never hardcode colors. `useTheme()` → `{ colors, accentId, modeId }`. Theme is
two axes: **accent** × **mode** (`theme/themes.js`, `resolveColors`). Static
scale (`radii`, `spacing`, `fontFamily`/Manrope, `fontSize`) lives in
`theme/tokens.js`. Screens build styles with
`const styles = useMemo(() => makeStyles(colors), [colors])`. Emphasis surfaces
use `<Card dark>` → `colors.emphasisBg` (NOT `colors.ink`). Icons:
`lucide-react-native`. Money: format via `lib/currency.js` (`lib/money.js` is a
thin re-export).

## Pro / entitlements

`lib/pro.js` is the single source of truth for limits/pricing/benefits
(`FREE_LIMITS`, `PRO_PRICING`). `useEntitlement()` → `entitlements` table
(`is_pro`; missing row = Free, intentionally). **Client checks are create-time
gates only** (block the 2nd account / 3rd budget, etc.) — never access-time,
never data-model changes. See `.claude/features/archive/14-subscription-pro.md`.

## Edge Functions (`supabase/functions/`)

- `send-push` — server push, driven by a cron reading `profiles.timezone` for
  local-time scheduling. `TimezoneSync` writes the device's real IANA zone.
- **AI goes through one Edge Function** (planned in spec 44, `ai-assistant`).
  It holds the OpenRouter key as a secret and calls OpenRouter over plain HTTP,
  with no SDK. The app never holds the key or calls a model directly. Earlier
  AI functions (`ai-interpret`, `ai-report-summary`) were removed; don't
  revive their code, build to spec 44.

## Supabase / schema truth

**No SQL migrations are committed in this repo.** Live schema is truth — pull it
via the Supabase MCP (`list_tables`, `list_migrations`; project
`uergtlcfpwajztqgncim`) rather than reconstructing from code. Each feature doc's
"Database" section is the durable written record. RLS is on everywhere.

## Feature workflow — READ THIS BEFORE BUILDING

- **`.claude/features/00-index.md` is the one main design doc**: standing rules,
  schema reference, shared infrastructure notes and a row per feature. **Read it
  first.** Built specs (`01`–`49`) are history in `.claude/features/archive/`
  (code comments cite them by file name); unscheduled ideas are in
  `.claude/features/ideas/`. A new spec goes beside the index as
  `.claude/features/NN-<slug>.md` and moves to `archive/` once built.
- Use the **`flo-feature` skill** before writing any feature code — the planning
  doc must exist first. Continue existing features through the same skill.

## Standing rules (from 00-index.md — do not re-litigate)

- **AI is the current priority (since 2026-11-08), and FLO is personal-use
  first; a store launch comes later.** The old "no AI" rule is lifted: the two
  earlier removals were mainly because credits couldn't be bought, and
  OpenRouter now solves that. Build to spec 44: voice and typed quick add, and
  a chat over transactions and accounts. Design rules carried from the
  removals ("it doesnt work. plus it very slow"):
  - a local parser handles simple entries with no AI call;
  - speech-to-text runs on the device;
  - the model only drafts or proposes, the person confirms, and the existing
    `lib/*.js` mutation writes;
  - totals and balances come from SQL, never from model arithmetic;
  - phase 1 must pass a phrasing test set before chat is built.
  Details are in `00-index.md`. Whether AI becomes part of Pro is decided at
  launch planning.
- **Auto-detect is personal-use only, never shippable.** The notification-listener
  path (`modules/flo-notification-listener/`, `lib/detect.js`,
  `DetectedTransactionHandler`) is architecturally impossible on iOS and
  policy-fraught on Play. Do not propose gating, polishing, or store-hardening
  it for a store. It stays in the author's personal build.
- **Native-permission test builds** hit Play Protect + Android "Restricted
  settings" — install over `adb`/`expo run:android`, and enable "Allow
  restricted settings" per install. Details in `00-index.md`.
- Local scheduled notifications are best-effort on OEM Android skins — not a bug.

## Agent skills

### Issue tracker

Local markdown: tickets and wayfinder maps live under `.scratch/<effort>/`; specs live in `.claude/features/`. See `docs/agents/issue-tracker.md`.

Specs produced by `/to-spec` are written as `.claude/features/NN-<slug>.md` in the flo-feature template; the flo-feature rule (planning doc before feature code) is satisfied by that file.

Each implementation ticket ends with a `## Tracer` checklist for the user-wide `tracer` mod (`/tracer` pane); in FLO, "Verified" means an emulator check, not lint/build. See the "Tracer board" section of `docs/agents/issue-tracker.md`.

### Triage labels

Default five roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as `Status:` lines. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
