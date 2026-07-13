# Feature: First-Run Onboarding
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/07-onboarding.md`
**Status**: Planned
**Last Updated**: July 2026

---

## Context

FLO has no first-run experience. `app/_layout.js`'s `RootNavigator` gates only
on `session` — sign up, and you land on an empty Home screen with a default
"Personal" account you didn't name, notifications off, and no idea that the
app's most valuable feature (auto-detecting bank/UPI transactions) exists or
that it needs a system-level grant you can only reach through Settings.

The design in `claude-design/FLO Expense Tracker Design/FLO App.dc.html`
specifies a 5-screen onboarding group (Welcome → Name your account → Add your
first transaction → Turn on reminders → You're all set). That design predates
Koban, Bills, and auto-detect — its "App screens" group still shows Plans as a
tab and has no Bills tab, no streak surface, and no detection settings. This
feature builds the designed flow **and** extends it to cover what the app
actually does now:

| Design assumes | Reality |
|---|---|
| Welcome sells balance / budgets / **plans** | Plans was demoted from a tab to the menu sheet (`04-...md`); **Bills** took its slot |
| Reminders = bill reminders + a nightly nudge | The nightly nudge exists to serve the **streak** (`05-koban-engagement.md`) — without that framing it's just nagging |
| — (nothing) | **Transaction auto-detect** (`06-...md`) — needs `NOTIFICATION_LISTENER` access, granted only via a system screen with no callback. The single strongest argument for having an onboarding flow at all |

Two decisions taken with the user before writing this doc:

1. **Completion flag lives in the DB** (`profiles.onboarded_at`), not
   AsyncStorage — it follows the user, not the device, and doesn't re-trigger
   on every dev-build reinstall.
2. **The first-expense step is a real screen with the stepper**, an inline
   composer as drawn in the design — *not* the existing `AddTransactionSheet`
   opened over the step. This is a deliberate, user-chosen deviation from the
   skill's "quick create = bottom sheet" convention: onboarding is a linear
   stepper, and a modal sheet over a stepper step breaks that reading. It
   duplicates amount/type/category entry — see §2.2 for exactly how far the
   duplication goes and what is deliberately *not* duplicated.

---

## Phase Overview

```
Phase 1 — Spine
  DB flag, the routing gate, the shared stepper scaffold, and the three
  screens that need no permissions: Welcome, Name your account, All set.
  End state: a new signup walks a real, skippable onboarding into Home.

Phase 2 — First expense + Reminders & streak
  The inline transaction composer step (design 03), and the notifications
  step (design 04) reframed around the streak — real OS permission request,
  bill-reminder and nightly-nudge toggles.

Phase 3 — Auto-detect + replay
  The new Android-only auto-detect step (notification-access grant → enable
  detection), and a "Replay onboarding" row in Settings.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Spine ✅ Complete

### Goal

A user who signs up is taken to `/onboarding/welcome` instead of Home, walks
Welcome → Name your account → All set, and lands on Home with their default
account renamed and recoloured to their choice. Skipping from any step goes
straight to Home. Once complete, onboarding never appears again — including
after a reinstall or on a second device. Existing users (i.e. the user's own
account) are never shown the flow.

### Before Starting — Confirm With Codebase

1. **`profiles` columns** — confirm `id` / `full_name` / `currency` /
   `avatar_url` / `created_at` are the current set, and that `onboarded_at`
   doesn't already exist. Use the Supabase MCP (`list_tables`), not memory.
2. **`handle_new_user`'s INSERT column list** — read the live function. The new
   column must be safe to leave NULL on signup (that's what triggers onboarding
   for a new user). If the trigger enumerates columns explicitly, adding a
   nullable one is a no-op; confirm rather than assume.
3. **`AccountContext`** (`lib/AccountContext.js`) — confirm `activeAccount`,
   `activeAccountId`, `loading` are the exported shape, and that
   `handle_new_user` still auto-creates the "Personal" account (this step
   *renames* that row; it must not insert a second account).
4. **`AddAccountSheet.js`** — the account update payload
   (`{ name, description, color }` → `.update().eq('id', editingId)`) and the
   `CATEGORY_COLORS` swatch grid. Phase 1's account step reuses both.
5. **`app/_layout.js`'s provider nest** — confirm `ShareIntentHandler` is still
   rendered as a sibling of `<Stack>` *inside* the providers. The onboarding
   gate must sit in exactly that position and for exactly that reason (below).

### 1.1 Database

One nullable column on `profiles`. No new table, no view, no RLS change —
`profiles`' existing `(select auth.uid()) = id` policy already covers it.

The backfill is the load-bearing half: without it, the user's own existing
account would be dragged through onboarding on next launch.

```sql
-- 07-onboarding.md Phase 1 — first-run onboarding completion flag.
-- NULL = has not finished onboarding. Set once, on completion or skip.
-- Deliberately nullable with no default: handle_new_user() doesn't set it,
-- so every new signup gets NULL and onboards. Timestamptz rather than a
-- boolean so "when did this user first finish setup" stays answerable.
alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- Every profile that exists right now predates onboarding — mark them done
-- so no existing user is forced through a flow they don't need. New rows
-- (created by handle_new_user after this migration) get NULL and onboard.
update public.profiles
  set onboarded_at = now()
  where onboarded_at is null;
```

Migration name: `add_profiles_onboarded_at`. Apply via the Supabase MCP
(`apply_migration`) — **before** any component code in this phase is written.
This block is the durable record; keep it in sync with what's live.

### 1.2 Data Layer

**`lib/onboarding.js`** (new) — the step registry and the completion mutation.
Pure logic + one Supabase write; no component owns this because Phase 3's
auto-detect step makes the step list *conditional*, and both the gate and every
step's progress dots need to agree on what the list is.

```js
// Ordered step list. `detect` is filtered out where unsupported (iOS /
// Expo Go / no native module) — see isSupported() in lib/detect.js. The
// progress dots and the "next step" routing both derive from this, so a
// dropped step renumbers everything automatically instead of leaving a
// dead dot or routing into a screen that can't work.
export const ONBOARDING_STEPS = [...]   // [{ key, route }]
export function getSteps()              // → steps, minus unsupported ones
export function getStepPosition(key)    // → { index, total } for the dots
export function getNextRoute(key)       // → route string, or null at the end
```

- **Welcome is not a dot.** The design shows dots starting on screen 02 with
  4 total. `getSteps()` returns the dotted steps only (`account`, `expense`,
  `reminders`, `detect`, `done`); Welcome routes into the first of them.
- **Completion** — `completeOnboarding()` writes
  `profiles.onboarded_at = new Date().toISOString()` via
  `useProfile().updateProfile({ onboarded_at })`, which already calls
  `notifyChanged()` on success. That version bump is what makes the gate
  re-evaluate and stop redirecting. Skip and Finish both call it — a skip is a
  completion, not a deferral.

**No new read hook.** The gate consumes the existing `useProfile()`
(`profile.onboarded_at`, `loading`); the account step consumes the existing
`useAccount()`.

**Account rename mutation** — inline in the account step component, matching
`AddAccountSheet.js`:

```js
await supabase.from('accounts')
  .update({ name: name.trim(), color })
  .eq('id', activeAccountId);
notifyChanged();
```

`.update()`, never `.insert()` — the "Personal" row already exists from
`handle_new_user`. Inserting here would leave the user with two accounts on day
one.

### 1.3 Components

```
app/onboarding/
  _layout.js        Stack, headerShown: false, gestureEnabled: false
  welcome.js        Design 01 — brand, 3 feature rows, Get Started / Skip intro
  account.js        Design 02 — name + colour for the default account
  done.js           Design 05 — "You're all set, {firstName}" → Start tracking

components/
  OnboardingScaffold.js   Shared frame: dots, title, subtitle, body, footer
  OnboardingProgress.js   The dot row (pill-shaped, active = brand lime)
```

**`OnboardingScaffold.js`** — every step is the same skeleton (safe area, dot
row, big title, muted subtitle, flexible body, primary button pinned to the
bottom, optional muted skip line beneath it). Props:
`{ stepKey, title, subtitle, primaryLabel, onPrimary, primaryDisabled, skipLabel, onSkip, children }`.
Pass `stepKey={null}` on Welcome and `done` to hide the dots.

Design-to-token mapping (the design's HTML uses raw hex; none of it goes into
the code):

| Design | Token |
|---|---|
| `--flo-primary` `#BBDC12` | `colors.brand` |
| `--flo-ink` | `colors.ink` |
| `--flo-primary-tint` (pale lime tiles) | `colors.incomeBg` |
| `--flo-primary-ink` (readable lime) | `colors.incomeAccent` |
| `#8a8e84` / `#9a9e94` / `#6b6f66` | `colors.muted` / `colors.mutedMid` / `colors.mutedDarker` |
| 58px button, radius 16 | `radii.button` |
| Screen bg `#FFF` / `#F6F7F3` | `colors.surface` / `colors.bg` |

**`welcome.js`** — the design's three feature rows sell balance, **budgets**,
and **plans**. Plans is no longer a tab. Re-cut to what the app actually leads
with, keeping the same 3-row layout and lime icon tiles:

| Row | Icon (`lucide-react-native`) | Copy |
|---|---|---|
| In-hand balance | `Wallet` | Always up to date |
| Budgets & bills | `Target` | Get warned before you overspend |
| Auto-detect | `Zap` | FLO reads your bank alerts and offers to log them |

The third row is a promise Phase 3 has to keep — if Phase 3 is cut, this row
must change with it.

**`account.js`** — pre-filled with the existing account's name ("Personal"), a
selected-by-default colour, and `CATEGORY_COLORS` swatches from
`components/CategoryIcon.js` (14 swatches, wrapped) — **not** the design's
ad-hoc six hex values. Primary "Continue" saves; skip line ("Keep as Personal")
advances without writing. Guard on `useAccount().loading` — this screen cannot
render its input until `activeAccountId` resolves.

**`done.js`** — greets by first name from
`profile.full_name ?? session.user.user_metadata.full_name`, split on the first
space. Primary "Start tracking" → `completeOnboarding()` → `router.replace('/')`.

**`components/Confetti.js`** (new) — the design's `@keyframes flo-confetti`
(fall + rotate + fade), built on **`react-native-reanimated`**, which is already
a dependency (`~4.1.1`, pulled in by `@gorhom/bottom-sheet`). An earlier draft
of this doc cut the animation for lack of an animation library; that was wrong —
there is one, and it's already in the bundle.

- ~40 pieces, each a small `Animated.View` (mixed rects/circles) with a random
  x, size, colour, delay, rotation speed and horizontal drift.
- Colours: `colors.brand` plus the accent swatches already in the palette
  (`CATEGORY_COLORS`) — no new hex values.
- One `withTiming` fall per piece (`translateY` from above the screen to past
  the bottom), `withDelay` staggered, `rotate` interpolated from the same
  progress value, opacity fading at the tail. Fires once on mount; **does not
  loop** — it's a celebration, not a background.
- `pointerEvents="none"`, absolutely positioned behind the content, and
  respects `AccessibilityInfo.isReduceMotionEnabled()` (render nothing when
  reduce-motion is on).

### 1.4 Navigation / Integration

**`OnboardingGate`** — new component in `app/_layout.js`, rendered as a sibling
of `<Stack>` alongside `ShareIntentHandler` / `NotificationSync` /
`DetectedTransactionHandler`. It returns `null` and only runs an effect.

This placement is forced, not stylistic: the gate needs `useProfile()`, which
needs `useDataRefresh()` — and `RootNavigator` *defines* `DataRefreshProvider`,
so it is not a descendant of it and cannot consume it. This is the exact
constraint documented for `ShareIntentHandler` in `00-index.md`'s Shared
Infrastructure Notes. Do not try to put this logic in `RootNavigator`.

```js
function OnboardingGate() {
  const { session } = useAuth();
  const { profile, loading } = useProfile();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!session || loading) return;
    // profile can be briefly null right after signUp — handle_new_user's
    // trigger row may not have landed yet. Waiting is correct; treating a
    // null profile as "not onboarded" would redirect on a race.
    if (!profile) return;

    const inOnboarding = segments[0] === 'onboarding';
    if (!profile.onboarded_at && !inOnboarding) {
      router.replace('/onboarding/welcome');
    } else if (profile.onboarded_at && inOnboarding) {
      router.replace('/');
    }
  }, [session, loading, profile?.onboarded_at, segments]);

  return null;
}
```

**Known cosmetic behaviour, accept and verify on device**: `RootNavigator`'s
existing effect already does `router.replace('/')` when a session appears on
the sign-in screen, so a fresh signup will paint one frame of Home before the
gate replaces it with onboarding. The gate cannot pre-empt that from where it
must live. If it reads badly on device, the fix is a follow-up (hold the
redirect in `RootNavigator` until the profile resolves) — do not pre-emptively
build that in this phase.

### 1.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| `app/_layout.js` | +1 sibling component (`OnboardingGate`) inside the provider nest | Must be *inside* the providers, not in `RootNavigator` — see §1.4 |
| `profiles` / `useProfile` | +1 nullable column, read by the gate | `updateProfile()` already calls `notifyChanged()`; nothing else to wire |
| `AccountContext` | None — the account step consumes it read-only and updates the row by id | The rename must be an UPDATE; a second account would break the "≥1 account" invariant's spirit and confuse the switcher |
| Sign-in / sign-up | None functionally; a new signup now diverts to onboarding | The signup → Home → onboarding frame flash above |
| Existing user (the user's own account) | Backfilled to `now()` — never sees the flow | If the backfill is skipped, the user gets dragged through onboarding on next launch |

### 1.6 What This Phase Does NOT Include

- The first-expense step, the reminders/streak step, the auto-detect step
  (Phases 2–3). `getSteps()` ships with all of them registered but only the
  Phase 1 routes existing — **register steps as their screens land**, not
  up-front, or the dots will count screens that 404.
- "Replay onboarding" in Settings (Phase 3) — until then, the only way to see
  the flow again is a fresh signup or nulling `onboarded_at` by hand.
- Any change to `handle_new_user`.

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] `add_profiles_onboarded_at` migration applied; `onboarded_at` exists on
      `profiles`, and both existing rows are non-NULL (backfilled)
- [x] `lib/onboarding.js` exports the step registry, `getStepPosition`,
      `getNextRoute`, and the completion mutation (`useOnboarding().finish`)
- [x] `app/onboarding/_layout.js` renders a headerless Stack with the back
      gesture disabled
- [x] Welcome / Account / Done screens exist and match the design's structure,
      using only `theme/tokens.js` values — no raw hex, no magic numbers
- [x] Welcome's three feature rows say balance / budgets & bills / auto-detect
      (not Plans)
- [x] The account step **updates** the existing default account (code: a single
      `.update().eq('id', activeAccountId)`, no insert path)
- [x] Colour swatches come from `CATEGORY_COLORS`, not local hex values
- [x] `OnboardingGate` is a sibling of `<Stack>` inside the providers and
      returns `null`
- [x] `npx expo export --platform android` bundles clean
- [ ] **On device**: fresh signup routes into onboarding; account rename leaves
      exactly one account row; skip from Welcome lands on Home; killing and
      reopening after completing does not show onboarding again; an existing
      (backfilled) user signs straight into Home with no flicker
- [ ] **On device**: confetti fires once, doesn't loop, doesn't block the
      button, and is skipped when reduce-motion is on

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes

- **Migration applied via the Supabase MCP** (`add_profiles_onboarded_at`), not
  hand-pasted. Verified after: `profiles` has `onboarded_at`; both existing
  rows (`Admin One`, `Chris Austin A`) backfilled to `now()`, so neither is
  dragged through the flow. `handle_new_user` was read live and confirmed to
  insert only `(id, full_name)` — new signups get NULL and onboard, with no
  trigger change needed.
- **Contradiction in the plan, resolved toward §1.3.** The Phase 1 checklist
  originally said skipping from *both* Welcome and Account sets `onboarded_at`,
  while §1.3 said Account's skip ("Keep as Personal") merely advances. §1.3 is
  right and is what's built: "Keep as Personal" is a secondary *action* on that
  step (accept the default name), not an exit from the flow. Only Welcome's
  "Skip intro" and Done's "Start tracking" call `finish()`.
- **Confetti is real, not cut.** The original doc dropped it for lack of an
  animation library; that was wrong — `react-native-reanimated ~4.1.1` is
  already a dependency via `@gorhom/bottom-sheet`. `components/Confetti.js`
  ports the design's `@keyframes flo-confetti` (fall + spin + fade) with 40
  staggered pieces, one shared value each, firing once. Honours reduce-motion
  by rendering nothing.
- **Dot count is 2 this phase**, not the design's 4 — `ONBOARDING_STEPS` holds
  only `welcome` and `account` until Phase 2's screens exist. Registering them
  early would render dots that route to 404s. Phase 2 takes it to 4.
- **Welcome counts as a dot but renders none of its own** — matching the
  design, where screen 02 shows two filled pills.
- **Not verified on device** — no Android SDK/device in this environment, same
  constraint as `03`/`05`/`06`. Everything above marked `[x]` is verified by
  reading code, the live DB, or a clean bundle; the runtime behaviour of the
  gate (especially the signup → one-frame-of-Home → onboarding transition
  called out in §1.4) is genuinely unverified and is the first thing to look at
  on device.

---

## Phase 2 — First Expense + Reminders & Streak ✅ Complete

### Goal

The two value-carrying steps from the design. The user logs a real first
expense from inside the stepper (or skips), then turns on notifications with a
clear reason to: bill reminders so nothing is missed, and a nightly nudge that
is explicitly framed as what keeps their streak alive.

### Before Starting — Confirm Phase 1 is Approved

Then verify against the codebase:

1. **`AddTransactionSheet.js`'s save payload** — the exact insert shape
   (`{ type, amount, category_id, plan_id, note, occurred_at }` +
   `account_id: activeAccountId`) and its post-save behaviour. The composer
   here must produce an identical row.
2. **`useCategories()`** — returns `expenseCategories` / `incomeCategories`;
   confirm the shape and that it's the session-dependency-fixed version (see
   `00-index.md`'s standing rule).
3. **`lib/notifications.js`** — `requestPermission()`'s return shape
   (`{ granted, canAskAgain, unsupported }`), `setNotificationEnabled`,
   `setDailyReminderSettings`, `setBillReminderSettings`, `rescheduleAll`.
   Note the **persist-then-`rescheduleAll`** ordering rule documented on
   `rescheduleAll` — violating it silently wipes the schedule.
4. **`hooks/useStreak.js` / `lib/koban.js`** — what a zero-streak user actually
   returns. This screen shows a *static explainer*, not a live streak.

### 2.1 Database

No database changes in this phase.

### 2.2 Data Layer

Notification prefs stay in **AsyncStorage** (`lib/notifications.js`) — that is
device state, correctly scoped, and this step just writes it through the
existing setters. Do not move them to `profiles`.

**The expense step's insert is inline in the component**, matching
`AddTransactionSheet`:

```js
await supabase.from('transactions').insert({
  type: 'expense',
  amount: Number(amount),
  category_id: categoryId,
  plan_id: null,
  note: null,
  occurred_at: format(new Date(), 'yyyy-MM-dd'),
  account_id: activeAccountId,
});
notifyChanged();
```

**How far the duplication goes** (the honest cost of the no-sheet decision):
duplicated = the amount input, the expense/income segment, and the category
chip row. **Not** duplicated, and deliberately absent from this step: plan
linking, the note field, the date picker, edit/delete, the account switcher,
and the post-save budget-warning toast. This step is "log one expense, today,
in a category" — nothing more. If it starts growing toward parity with
`AddTransactionSheet`, that is the signal the decision was wrong; raise it
rather than porting features across.

### 2.3 Components

```
app/onboarding/
  expense.js      Design 03 — segment, big amount, category chips
  reminders.js    Design 04 — bell hero, two toggle cards, streak explainer
```

**`expense.js`** — design 03, inside `OnboardingScaffold`. Type segment
(Expense selected; Income available), a large centred `₹` + amount, and a
horizontally-scrolling category chip row (`CategoryIcon` + `category.color`
for the selected tile). Primary "Add & Continue" is disabled until amount > 0
and a category is picked; skip line ("I'll do this later") advances without
writing. Amount formats through `formatMoney` (`lib/money.js`) wherever it's
displayed rather than typed.

**`reminders.js`** — design 04, with the streak framing the design lacks:

- Bell hero tile + "Never miss a bill".
- **Bill reminders** card → `setBillReminderSettings({ enabled, daysBefore: 2 })`.
- **Nightly nudge** card → `setDailyReminderSettings({ enabled, hour: 20, minute: 0 })`,
  labelled with the streak: a `Flame` tile and one line — log something each
  day and the streak grows; the nudge is what keeps it alive. Static copy, not
  a live `useStreak()` read (a brand-new user's streak is 0 and rendering that
  sells nothing).
- Primary "Enable Notifications" calls `requestPermission()` **first**. Only on
  `granted` do the toggles persist and `setNotificationEnabled(true)` run,
  followed by `rescheduleAll({ bills, userId })` — in that order.
- `unsupported` (Expo Go): show the existing "needs a development build" copy
  and let the step be skipped. Denied + `!canAskAgain`: show the same
  "blocked, open system settings" hint Settings uses (`Linking.openSettings()`).
  Neither case may block the user in the flow.

### 2.4 Navigation / Integration

Register `expense` and `reminders` in `ONBOARDING_STEPS`. The dot count moves
from 2 to 4. No other screen changes.

### 2.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| `transactions` | A real row, from onboarding | Must carry `account_id`; must be identical in shape to a sheet-created row |
| `lib/notifications.js` | New caller of the existing setters | The persist-then-`rescheduleAll` ordering rule |
| Home / Budgets / streak | Pick the first transaction up automatically | `notifyChanged()` is what makes this true — don't omit it |
| `AddTransactionSheet` | Untouched | Do not refactor it to share code with the composer this phase |

### 2.6 What This Phase Does NOT Include

- Plan/note/date/account fields in the composer (§2.2).
- Any refactor extracting shared UI out of `AddTransactionSheet`.
- Live streak state on the reminders screen.
- Battery-optimisation deep-link (it lives in Settings and is a
  troubleshooting affordance, not a first-run one).

### 2.7 Phase 2 Checklist — Before Marking Complete

- [x] The expense step inserts a row indistinguishable from an
      `AddTransactionSheet`-created one — same six columns plus `account_id`,
      checked line-by-line against `handleSave` in `AddTransactionSheet.js`
- [x] `notifyChanged()` fires on successful insert
- [x] Skipping the expense step writes nothing (the secondary action only
      navigates)
- [x] "Enable Notifications" requests the real OS permission via
      `requestPermission()`; every failure path (`unsupported`, denied,
      denied-permanently) toasts and returns without trapping the user — the
      "Maybe later" secondary is always live
- [x] Toggles persist through the existing `lib/notifications.js` setters, and
      `rescheduleAll` runs *after* the persist
- [x] Expo Go path shows the unsupported message rather than failing silently
- [x] Dots read 4 total; `expense` is 3/4 and `reminders` 4/4
- [x] `npx expo export --platform android` bundles clean (3,985 modules)
- [ ] **On device**: the first-expense row lands with the right `account_id` /
      `type` / `occurred_at`, and Home's balance reflects it on arrival
- [ ] **On device**: a scheduled nudge appears in Settings → "Show scheduled"
      after completing this step with the nudge on

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes

- **The nightly nudge defaults to ON**, where the design drew it off. The
  design's version was an unexplained "daily log reminder"; this one is framed
  as the thing that keeps the streak alive, which is a reason to say yes. Both
  toggles are visible and flippable *before* the permission is requested, so
  this is a visible default, not a dark pattern. Bill reminders default on
  (2 days before), matching both the design and
  `DEFAULT_BILL_REMINDERS`.
- **Time and days-before are not editable in the flow** — the nudge is fixed at
  8:00 PM and bills at 2 days before, matching `lib/notifications.js`'s own
  defaults. A time picker mid-onboarding is a decision the user has no basis to
  make yet, and Settings already exposes both.
- **The expense step's category selection self-heals** rather than being seeded
  once: an effect re-picks the first category whenever the current selection
  isn't in the active list. That covers both "categories hadn't loaded yet at
  mount" and "the type segment flipped to income", which are the same bug
  wearing two hats.
- **Scope held exactly as specified in §2.2** — no plan link, note, date
  picker, account switcher, or post-save budget toast crept into the composer.
- **Not verified on device** (no Android SDK/device here, same as Phase 1). The
  notification path in particular is only bundle-verified: `requestPermission()`
  can't be exercised without a real OS prompt.

---

## Phase 3 — Auto-Detect + Replay ✅ Complete

### Goal

The step the design has no answer for, and the reason onboarding earns its
keep: walk the user through granting notification access and enabling
auto-detection, in the one moment they're already saying yes to setup — rather
than hoping they find it buried in Settings. Plus a "Replay onboarding" row so
the flow is reachable again without a fresh signup.

### Before Starting — Confirm Phase 2 is Approved

Then verify:

1. **`lib/detect.js`** — `isSupported()`, `hasNotificationAccess()`,
   `openNotificationAccessSettings()`, `setDetectionEnabled()`,
   `setAllowedPackages()`, `DEFAULT_ALLOWED_PACKAGES`.
2. **`app/settings.js`'s detection card** — its `AppState`-based re-check on
   foreground, and `handleToggleDetect`'s
   `setAllowedPackages(DEFAULT_ALLOWED_PACKAGES)`-then-`setDetectionEnabled`
   ordering. Mirror it exactly; do not invent a second enabling path.
3. **`WATCHED_APP_LABELS`** — currently a private const in `app/settings.js`.

### 3.1 Database

No database changes in this phase.

### 3.2 Data Layer

**Move `WATCHED_APP_LABELS` from `app/settings.js` into `lib/detect.js`** and
import it in both places. This is the only refactor in this feature, and it's
justified: that list is the *consent disclosure* — it states which apps FLO
reads. Onboarding and Settings must never be able to disagree about it, and
`lib/detect.js` already owns `DEFAULT_ALLOWED_PACKAGES`, which it must stay in
sync with. Keep the existing comment about the personal-use-only `Messages`
entry with it.

No new hook. The screen holds two pieces of local state (`access`, `enabled`)
sourced from the synchronous `hasNotificationAccess()` / `isDetectionEnabled()`.

### 3.3 Components

```
app/onboarding/
  detect.js       Zap hero, plain-English disclosure, grant → enable
```

Flow, mirroring Settings' proven sequence:

1. Not granted → primary button "Grant access" calls
   `openNotificationAccessSettings()` (deep-links to the system screen; **no
   callback exists**).
2. Re-check `hasNotificationAccess()` on `AppState` → `active`, exactly as
   `app/settings.js` does — a pushed screen doesn't remount when the app
   backgrounds to system settings and comes back.
3. Granted → `setAllowedPackages(DEFAULT_ALLOWED_PACKAGES)` then
   `setDetectionEnabled(true)`, the card flips to a granted state, primary
   becomes "Continue".
4. Skip line ("Not now") always available.

**The disclosure is load-bearing, not decorative.** Render the watched-app list
from the shared `WATCHED_APP_LABELS` and state plainly that FLO reads *only*
those apps' notifications and nothing else on the device. This is the same
promise Settings makes; it must be true and identical in both places.

**Unsupported platforms**: `getSteps()` already filters `detect` out where
`isSupported()` is false (iOS, Expo Go) — verify the dots renumber and
`getNextRoute('reminders')` skips straight to `done`. The screen should never
be reachable on a platform where it can't work.

### 3.4 Navigation / Integration

- Register `detect` in `ONBOARDING_STEPS` (conditional — see above).
- **Settings → "Replay onboarding"** row, in the existing first `rowsCard`
  (with Currency / Manage Categories / Appearance), using the same `Pressable`
  + `rowIcon` + `ChevronRight` shape. Sets `onboarded_at` to `null` via
  `updateProfile({ onboarded_at: null })` → `notifyChanged()` → the gate
  redirects into the flow. No confirmation dialog: it's non-destructive, and
  every step is skippable.

### 3.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| `app/settings.js` | Imports `WATCHED_APP_LABELS` instead of defining it; +1 row | The disclosure text must not change meaning in the move |
| `lib/detect.js` | +1 export | Keep the personal-use-only warning attached to the `Messages` entry |
| Detection itself | A second entry point to the same enable path | Both paths must set the allowlist *before* enabling |

### 3.6 What This Phase Does NOT Include

- A user-editable allowlist (still out of scope, per `06-...md` Phase 3).
- Any change to the native module or the parser.
- Battery-optimisation guidance in the flow (stays in Settings).
- Removing the personal-use `Messages` package — that remains a tracked
  pre-store-submission task in `06-...md`, untouched here.

### 3.7 Phase 3 Checklist — Before Marking Complete

- [x] `WATCHED_APP_LABELS` lives in `lib/detect.js`; `app/settings.js` imports
      it; the rendered disclosure text in Settings is byte-for-byte unchanged.
      A repo-wide grep confirms one definition, two consumers
- [x] The detect step deep-links via `openNotificationAccessSettings()` and
      re-checks on `AppState` → `active` (not mount-only) — the only way to
      observe a grant that has no callback
- [x] Enabling sets the allowlist before `setDetectionEnabled(true)` — same
      order as Settings' `handleToggleDetect`
- [x] The step is registered with `supported: isDetectSupported`, so it's
      filtered out of the flow (not stubbed) on iOS/Expo Go
- [x] Settings → "Replay onboarding" nulls `onboarded_at`; the gate does the
      redirect, so no navigation call is needed at the call site
- [x] `npx expo export --platform android` bundles clean (3,986 modules)
- [ ] **On device**: the grant round-trip works (leave to system settings,
      come back, screen shows Granted without a remount)
- [ ] **On device**: a real bank/UPI notification after onboarding produces a
      detection — the only end-to-end proof
- [ ] **On device**: full fresh-signup flow — signup → 5 steps → Home, account
      named, one transaction logged, nudge scheduled, detection live

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes

- **`WATCHED_APP_LABELS` moved to `lib/detect.js`** — the one refactor this
  feature allowed itself, and it earns its place: that list is the consent
  disclosure, it's now rendered in two screens, and a drifted copy wouldn't be
  untidy so much as untrue. It sits directly beneath `DEFAULT_ALLOWED_PACKAGES`
  (the list it describes) with the personal-use `Messages` caveat carried
  across intact.
- **Two-state primary button** rather than a switch: "Grant access" before the
  OS grant, "Turn on detection" after. The Settings card uses a `Switch`, but a
  switch mid-stepper implies you can proceed with it either way, when in fact
  the grant has to happen in a different app first. The button reflects what
  the single next action actually is.
- **"Replay onboarding" needs no navigation.** It nulls the column and lets
  `OnboardingGate` do the redirect — the same code path a genuinely new user
  takes, so there's no second, subtly-different way into the flow to keep
  working.
- **Not verified on device**, same constraint as Phases 1–2. This phase is the
  most exposed to that: the grant round-trip and the detection itself are
  precisely the things a bundle check cannot see. Note also `00-index.md`'s
  standing rule — a fresh install declaring `NOTIFICATION_LISTENER` will hit
  Android's "Restricted settings" block, fixable per-install via App Info →
  ⋮ → "Allow restricted settings". That's expected, not an onboarding bug.

---

## Post-Build Fixes — First On-Device Round (2026-07-13)

First real run, in Expo Go. Five findings; all fixed.

### 1. Onboarding never appeared at all — stale Metro route tree

**Symptom**: created a new account, landed on Home. No onboarding, no error, no
unmatched-route screen.

**Not** a gate bug: the DB was correct (the new profile had `onboarded_at =
NULL`), the gate was mounted, and its logic was sound. `app/onboarding/` was a
**new directory**, and Expo Router builds its route tree from a Metro
`require.context` over `app/` — a dev server started *before* those files
existed keeps serving a tree with no `/onboarding/welcome` in it.
`router.replace()` to a route the tree doesn't know about doesn't crash and
doesn't render the unmatched screen; it warns to the console and leaves you
where you were.

**Fix**: `npx expo start -c`. **Standing lesson**: after adding a new route
*directory*, restart the dev server with `-c` before concluding anything about
the navigation code. This will bite again on the next feature that adds routes.

### 2. Home flashed for a split second before onboarding

The flash §1.4 predicted, now actually fixed rather than accepted. It was
caused by **two** components both owning post-auth routing: `RootNavigator`
redirected any signed-in user on `/sign-in` to `/`, then `OnboardingGate`
redirected a non-onboarded user from `/` to onboarding a moment later, once the
profile it depends on had loaded.

**Fix**: `RootNavigator` now owns only the signed-OUT rule (`!session` →
`/sign-in`). `OnboardingGate` owns *all* authenticated routing, including the
sign-in → Home hop for an already-onboarded user. One component decides, so
there's no intermediate destination to paint. **Rule**: don't split a routing
decision across two effects when one of them has to wait for data.

### 3. Confetti invisible — render order, not Reanimated

`<Confetti />` was rendered *before* `<OnboardingScaffold />` inside `done.js`.
The scaffold's `SafeAreaView` has an opaque background, and among siblings the
later one paints on top — so forty pieces of confetti were animating perfectly,
underneath a solid white sheet. **Fix**: render `<Confetti />` *after* the
scaffold. It's `pointerEvents="none"`, so sitting above the button costs
nothing.

### 4. Screens read as disconnected slabs

`OnboardingScaffold`'s body was `justifyContent: 'center'`, floating each
screen's content into the middle of the viewport with dead bands above and
below it — the title, the content, and the button looked like three unrelated
blocks. **Fix**: the body is top-aligned and flows out of the subtitle; only
the button is pinned. Added a `scrollable` prop (+ `KeyboardAvoidingView`) for
the expense step, which now overflows once the keyboard is up. Also dropped the
Logo from Welcome — the design doesn't have one there, and it was adding to the
disjointed feel.

### 5. The expense step now has full field parity — §2.2 is superseded

The user asked for every `AddTransactionSheet` field. `app/onboarding/expense.js`
now has type, amount, category, **date, plan and note**, producing an identical
row. Left out only what makes no sense in a first-run flow: edit/delete (nothing
exists to edit) and the account switcher (the account was named on the previous
step — a static "Adding to X" line states where the row lands).

**This voids the bounded-duplication argument in §2.2.** There are now two full
implementations of transaction entry. That was the tradeoff of the no-sheet
decision and it has now landed in full. **If a third entry point ever appears,
extract a shared form component rather than copying this a third time** — and
the same applies if these two start drifting in behaviour.

### 6. Party popper is now the design's coloured mark

`components/PartyPopper.js` — the design's own multi-colour SVG (coloured
streamers + sparks), replacing Lucide's single-colour `PartyPopper`, which
can't express it. The design's raw hex values are remapped onto
`CATEGORY_COLORS` so the popper and the confetti read as one system rather than
introducing a fourth palette.

---

## Post-Build Fixes — Second On-Device Round (2026-07-13)

### 7. Vertical rhythm — third attempt, and the one that's right

Two wrong versions preceded this, worth recording so it isn't re-litigated:
- **v1** centred the *body* while the header stayed pinned to the top → each
  screen read as disconnected slabs (the user's "it is separated").
- **v2** top-aligned everything → the dots jammed up against the status bar and
  every screen's whitespace pooled at the bottom.
- **v3 (current)**: the entire group — dots, hero, title, subtitle, body — is
  vertically **centred** as one unit in the space above the button. Only the
  button is pinned. `scrollable` steps use `flexGrow: 1` +
  `justifyContent: 'center'`, so they centre while short and scroll once tall.

### 8. `hero` slot renders above the title

The reminders and detect steps had their icon tile *below* the subtitle; the
design puts it above the heading. `OnboardingScaffold` now takes a `hero` prop
rendered ahead of the title.

### 9. Exit flash: the first onboarding screen reappeared before Home

Leaving the flow from the done screen briefly showed **Welcome** again. Cause:
the steps were `router.push`ed, so the whole flow was a *stack*. Replacing the
top of it with `/` unwound that stack, and the screen underneath — Welcome, the
stack's root — painted for a frame during the transition.

**Fix**: every step now `router.replace`s the next one instead of pushing it.
The onboarding stack is never more than one screen deep, so there is nothing
underneath to reveal on the way out. Back navigation between steps is not lost
(there was none — `gestureEnabled: false`, and every step's only backwards
affordance is its skip line).

### 10. Streak celebration never fired for a new account — a pre-existing bug

**Not an onboarding bug.** `StreakCelebration`'s "already celebrated today"
guard used a bare AsyncStorage key, `flo.streak.lastCelebrated` — **not scoped
to a user**. Any account that had celebrated on that device that day suppressed
the celebration for *every other account* on the same device. Onboarding merely
exposed it: a brand-new signup logged its first transaction on a phone where an
existing account had already celebrated, and got nothing.

**Fix**: key by user — `flo.streak.lastCelebrated.${userId}`
(`components/StreakCelebration.js`). This is a real fix to
`05-koban-engagement.md`'s Phase 4, not to this feature.

### 11. Streak celebration copy and title size

- Title dropped from `fontSize.amountLg` (44) to `fontSize.hero` (30) — the
  recap titles are long enough to wrap badly at 44.
- **In/out totals removed from the `new_streak` recap tier** (`lib/koban.js`).
  On the day of your first-ever entry there is no day to summarise, and
  "₹450 out, ₹0 in" reads as a bleak balance sheet at the moment the app should
  be congratulating you. **Scoped to that tier only** — `ongoing` and
  `milestone` keep their totals, where the number has earned its place.
  Verified by running `pickRecap` directly: `new_streak` → "Day 0 of something
  new."; `ongoing` → "₹450 out · ₹0 in."
  Note this pool also feeds the scheduled *recap notification* via
  `buildReminderPlan`, so the first-day notification loses the totals too —
  intentional, same reasoning.

### 12. Expense step

Title → "Add your first **transaction**" (it always accepted income too — the
old title was simply wrong). The amount is now truly centred: the row centred
`[₹][input]` as a unit, which pushed the digits right of the centred "Amount"
label; a fixed-width spacer mirroring the ₹ slot on the input's right puts the
digits on the centre line.

### 13. Streak celebration reads as a streak screen, and asks for something

Three changes to `StreakCelebration.js` + `lib/koban.js` (this is
`05-koban-engagement.md`'s surface, edited from here):

- **Eyebrow pill** — `recapEyebrow()` renders `STREAK STARTED` (day 0) or
  `{n}-DAY STREAK` above the title, every time. The title pools *rotate*, so
  "the streak is mentioned somewhere in the pool" was worth nothing: a user
  could draw a playful Koban line and have no idea what the screen was. The
  eyebrow is the one element that always says it. Not used by the recap
  notification — a notification has no room for one, and its title carries the
  context instead.
- **Every `new_streak` copy variant now says a streak started, in plain words.**
  Previously only some did ("Paw's up" tells you nothing on its own).
- **CTA is `recapCta()`**: "Lock it in" (day 0) / "Lock in day {n}". "Nice!" was
  a dismissal — it asked nothing of the user at the exact moment they're most
  willing to give something.

`recapCta`/`recapEyebrow` are deliberately **separate functions**, not extra
keys on `pickRecap`'s return: that object is spread straight into
expo-notifications' `content`, and unexpected keys there are asking for trouble.

Mascot art is still pending (`05-...md` Phase 5) — the 🐱 emoji stands in, as
before.

### 14. Exit flicker, actually fixed — a stale-read race, not a stack unwind

Fix #9 (`push` → `replace`) was necessary but **not sufficient**; the Welcome
flash on exit survived it, because the real cause was elsewhere.

`useOnboarding().finish()` wrote `onboarded_at` and then immediately
`router.replace('/')`. But `updateProfile()`'s `notifyChanged()` triggers an
**asynchronous** refetch — so for one tick the gate saw us on a non-onboarding
route with `onboarded_at` still reading `null`, and correctly did what it's told
to do: redirect to `/onboarding/welcome`. The refetch then landed and bounced us
to Home. Welcome, then Home — exactly the reported flash, and it was the gate
doing its job on stale data.

**Fix**: `finish()` no longer navigates at all. It writes the column and stops;
the gate moves the user once the refetched profile genuinely says onboarded.
There is no window in which we're outside onboarding with a stale flag. It
returns `working` so the button can spin across the round trip.

**Generalised lesson** (this is the second bug of this exact shape in this
feature): when a redirect is driven by fetched state, never *also* navigate
imperatively at the moment you mutate that state. One of the two will be
working from a stale read. Pick the declarative one and let it fire.

### 15. "You're all set" text vanished

`done.js`'s content wrapper had `flex: 1` inside the scaffold's body — which
sizes to its content, since the scaffold centres the whole group itself. A
`flex: 1` child of a content-sized parent resolves to **zero height**, silently
swallowing the popper and both lines of text. Removed the `flex: 1`.

### 16. All transaction data removed from every recap tier

Fix #11 removed money from the `new_streak` tier only. The user extended it to
**all** tiers, and was right to — there's a correctness argument the first pass
missed:

The recap **notification** is composed at *schedule* time (`buildReminderPlan`),
not at delivery time. Its totals are a snapshot from whenever `rescheduleAll`
last ran, so the copy could confidently announce numbers that no longer matched
the day by the time it arrived. Copy that quotes data must be generated at the
moment it's shown, and this isn't.

`pickRecap` no longer takes `todayTotals` at all, and `formatMoney` is no longer
imported by `lib/koban.js`. The numbers live on Home/Analytics/Transactions,
computed live; this surface is fun only. Verified by running all four tiers
through an assertion that no `₹`, entry count, or "out ·" fragment survives.

### 17. One CTA everywhere: "Let's go"

`recapCta()` takes no arguments now. "Lock in day 7" was clever but it's the
moment the user closes the app and gets on with their day; one warm line fits
day 0, day 8 and day 100 without sounding smug.

**Milestones were already `[7, 30, 100]`** in both `lib/streak.js` and
`lib/koban.js` — the "day 5" the user saw was a test *input* of mine, not a
configured milestone. No change needed; recorded here so it isn't "fixed" later
by someone reading the same confusion.

### 18. Negative amounts are red all the way through

`AmountText`'s `muteCurrency` greyed the ₹ regardless of sign, leaving a grey ₹
glued to a red figure. The ₹ now takes the amount's own colour when the value is
negative; muting still applies to healthy figures, which is what it was for.

---

## Data Model Summary (Final State After All Phases)

```
profiles
  id            uuid  PK = auth.users.id
  full_name     text
  currency      text  default 'INR'
  avatar_url    text  storage object path (private bucket)
  created_at    timestamptz
  onboarded_at  timestamptz  ← NEW. NULL = onboarding not finished.
                              Read by OnboardingGate; written once by
                              completeOnboarding() (or nulled by Settings →
                              Replay onboarding).

No other schema change. Onboarding writes to existing tables through
existing paths:
  accounts      ← account step UPDATEs the default "Personal" row (name, color)
  transactions  ← expense step INSERTs one row (same shape as AddTransactionSheet)
  (AsyncStorage) ← reminders step writes notification prefs via lib/notifications.js
  (native prefs) ← detect step writes allowlist + enabled via lib/detect.js
```

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `app/_layout.js` | New `OnboardingGate` sibling inside the provider nest | Must not go in `RootNavigator` — it can't consume `DataRefreshProvider` |
| `profiles` / `useProfile` | +1 column | Migration + backfill |
| `app/settings.js` | +1 row; `WATCHED_APP_LABELS` moves out | Phase 3 |
| `lib/detect.js` | +1 export | Phase 3 |
| `AddTransactionSheet` | None | Explicitly do not refactor it to share code with the onboarding composer |
| Sign-up | Diverts to onboarding | Expect one frame of Home first (§1.4) |

---

## Out of Scope (All Phases)

- **Onboarding for the SMS share-import feature** (`03-...md`) — it's a passive
  Android share target with nothing to grant or configure; a first-run screen
  would be teaching a gesture the user will discover in context.
- **Analytics / Plans / Budgets tours** — Welcome name-checks them; walking
  through screens with no data yet teaches nothing.
- **Re-running onboarding automatically after an update** ("what's new" flow) —
  different feature, different flag.
- **Mascot art in onboarding** — Koban's mascot icon (`05-...md` Phase 5) is
  still blocked on user-supplied art. The streak explainer uses a `Flame` icon;
  if the mascot lands later, the reminders step is the natural first place for
  it.
- **iOS parity for auto-detect** — impossible (no notification-listener
  equivalent); the step is filtered out, not stubbed.
