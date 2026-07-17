# Feature: Subscription — FLO Pro (gating + upsell, no payment yet)
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/14-subscription-pro.md`
**Status**: Planned — awaiting confirmation before implementation
**Last Updated**: July 2026

---

## Context

Graduates `IDEAS-subscription-and-store.md` (Parts 2–3) into a real build: a
single **Pro** tier, with the free/Pro split live so that *limits that exist
from day one never take anything away from anyone* (the doc's core reason to
ship the structure before revenue). New signups land on **Free**; every
existing user is **grandfathered to Pro** (founder status — done via MCP as
part of this feature, see §Grandfathering).

**No payment is integrated in this feature.** RevenueCat / Play Billing is a
later step in the master sequence (pricing can't be set until real AI cost is
measured). Everything here is the *structure*: the entitlement the client
reads, the gates, the upsell surfaces, the Pro identity badges, and a
**placeholder paywall screen** where the real purchase flow will later live.
The `entitlements` table + server-side `is_pro` check already exist (built in
`13-ai-features.md` Phase 1 for the AI gate) — this feature is the client-side
half plus the two non-AI gate surfaces.

**The one principle that governs every decision here** (from the idea doc):
*never gate the ledger — gate the leverage.* Logging, viewing history, streaks,
reminders, the app lock, and exporting the view you're looking at stay free
forever. Pro is automation, scale, and depth.

---

## Product decisions (settled — from the approved list, 2026-07-17)

### The tier split

**Free** (new signups):
- **1 account · 2 budgets · 1 plan**
- Calendar-week / calendar-month budget periods
- The basic Reports screen at its default cadence, active-account only
- Everything in the never-gate list: unlimited transactions, full history,
  streaks, reminders, app lock, Analytics' own export button

**Pro** (single tier):
- **Unlimited accounts / budgets / plans**
- **Custom budget period** (`period_type: 'custom'`)
- **Report extras**: custom date range, all-accounts scope, CSV export *from the
  Report screen*
- **AI receipt scan** (already server-gated in `13`)
- The Pro identity: crown badge on Home + "Pro" badge in Settings

> **The CSV carve-out** (resolves the tension between the idea doc's Part 2
> "never gate export" and Part 3 "CSV is a report extra"): **Analytics' own
> Export button stays free** — that's "you're not trapped here," exporting the
> view you're already looking at. What's Pro is the **Report screen's** extra
> *scope* (custom range, all-accounts) which happens to include an export. It's
> the report scope that's Pro, not export itself.

### Pricing (placeholder — displayed, non-functional)

Priced for India, annual-forward, with a lifetime option (indie apps here
convert well on "buy once"). **Provisional** until real AI unit cost is measured
(master sequence step 3) — shown on the paywall screen, not yet chargeable:

| Plan | Price |
|---|---|
| Monthly | ₹99 / month |
| Annual | ₹699 / year (~₹58/mo) |
| Lifetime | ₹1,499 once |

### Grandfathering

Every existing user → `is_pro = true` (founder status, `IDEAS-subscription-and-store.md`
Part 3 grandfathering doctrine). Done via MCP as part of shipping this — see
§Grandfathering below. New signups get **no** entitlement row, which reads as
Free (see §Data model).

---

## Phase Overview

```
Phase 1 — Pro identity + surfaces (additive, restricts nothing)
  useEntitlement hook, the shared lib/pro.js constants, the ProUpsellSheet
  (Strava-style contextual bottom sheet), the app/pro.js screen (paywall
  placeholder + the menu destination), the "Upgrade to Pro" menu row, the
  crown badges (Home avatar + Settings profile), and the onboarding copy fix.
  Nothing is gated yet — Pro users just see their badge; free users can still
  do everything. Safe to ship and verify on its own.

Phase 2 — The gates (introduces the actual free limits)
  Create-time gates on accounts / budgets / plans, the custom-period gate,
  the report-extras gate, and routing the AI-receipt-scan 403 to the upsell
  instead of a silent error. Each gate opens the ProUpsellSheet at the moment
  of desire. This is the phase that makes Free actually limited.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Pro identity + surfaces

### Goal

A Pro user sees a crown on Home and a "Pro" badge in Settings. A free user sees
an "Upgrade to Pro" row in the menu that opens a warm Pro screen (benefits +
pricing) whose "Upgrade to Pro" button opens a placeholder paywall. The
contextual upsell bottom sheet exists and is openable from anywhere (Phase 2
wires it to the gates). Onboarding no longer promises "no subscription ever."
**Nothing is restricted yet** — this phase only adds identity and surfaces.

### 1.1 Database

**No schema change.** `entitlements` (`user_id` PK, `is_pro` bool, `created_at`,
`updated_at`) already exists from `13-ai-features.md`. `handle_new_user` is
**not** changed: a new signup gets no `entitlements` row, and a missing row
reads as Free everywhere (client + the existing AI Edge Function both treat
absent/`false` identically). This is deliberate — no migration, and the free
tier is simply "no row."

### 1.2 Data layer

- **`lib/pro.js`** (new) — the single source of truth so gates, sheet, and
  screen never drift:
  ```js
  export const FREE_LIMITS = { accounts: 1, budgets: 2, plans: 1 };
  export const PRO_PRICING = {
    monthly:  { label: 'Monthly',  price: '₹99',    sub: 'per month' },
    annual:   { label: 'Annual',   price: '₹699',   sub: 'per year · save 41%' },
    lifetime: { label: 'Lifetime', price: '₹1,499', sub: 'one-time' },
  };
  export const PRO_BENEFITS = [
    { icon: 'layers',  title: 'Unlimited accounts', body: 'Personal, family, business — as many ledgers as you need.' },
    { icon: 'target',  title: 'Unlimited budgets & plans', body: 'Track every goal, not just a couple.' },
    { icon: 'calendar',title: 'Custom budget periods', body: 'Any date range, not just weekly or monthly.' },
    { icon: 'fileText',title: 'Full reports', body: 'Custom ranges, all accounts at once, CSV export.' },
    { icon: 'scan',    title: 'AI receipt scan', body: 'Snap a receipt, we fill in the rest.' },
  ];
  ```
  (Icon keys map to `lucide-react-native` components inside the components that
  render them — not through `CategoryIcon`, since these aren't categories.)
- **`hooks/useEntitlement.js`** (new) — the client's Pro truth. Reads the
  current user's `entitlements` row (`select is_pro ... eq user_id ... maybeSingle`),
  subscribes to `useDataRefresh().version`, depends on `session?.user?.id` (same
  auth-timing fix as `useCategories`/`AccountContext`). **A missing row → `isPro:
  false`.** Returns `{ isPro, loading }`. This is read-only client state — the
  real enforcement that costs money (AI) stays server-side; these client checks
  only gate cheap create actions, and someone decompiling the app to make a
  third budget "defrauds themselves of ₹99" (idea doc's exact framing).

### 1.3 Components / screens

```
lib/pro.js                       NEW — FREE_LIMITS, PRO_PRICING, PRO_BENEFITS
hooks/useEntitlement.js          NEW — { isPro, loading }
components/ProBadge.js           NEW — crown badge; variants: 'overlay' | 'pill'
components/ProBenefits.js        NEW — the shared benefits list (used by sheet + screen)
components/ProUpsellSheet.js     NEW — the Strava-style contextual bottom sheet
app/pro.js                       NEW — the Pro screen = paywall placeholder
```

- **`components/ProBadge.js`** — a filled `Crown` (lucide). Two variants:
  - `overlay` — a small crown in a lime badge, absolutely positioned on a
    corner; used on the Home avatar. Mirrors the existing camera-badge overlay
    in `EditProfileSheet.js` (same `position:absolute` + brand circle + border
    pattern) — this is an established codebase pattern, not a new one.
  - `pill` — `[👑 Pro]` chip (filled crown + "Pro" text) for the Settings
    profile card.
  Renders nothing when the user isn't Pro (caller passes `isPro`, or the badge
  no-ops — decide at build; simplest is caller-gated).

- **`components/ProUpsellSheet.js`** — the contextual **"there's more to FLO"**
  bottom sheet (the Strava drawer). Provider + Context + `forwardRef`/
  `useImperativeHandle` + `useSheetBackHandler` — the standard sheet pattern,
  mounted once in `app/_layout.js`. `useProUpsellSheet().openProUpsell(reason?)`
  where `reason` is an optional short string the caller passes to tailor the
  subtitle to the moment (e.g. `"You've used your 2 free budgets"`), defaulting
  to a generic line when omitted.
  - Content: warm title (**"There's more to FLO"** / "Unlock the full potential
    of the app — and yourself."), the top ~4 `PRO_BENEFITS` via `ProBenefits`,
    a compact pricing line (e.g. "From ₹58/month"), and a primary **"Level up"**
    button → `router.push('/pro')` then dismiss. Dark (`colors.ink`) sheet
    background, matching the app's other dark sheets.

- **`app/pro.js`** — the full Pro screen, which **doubles as the paywall
  placeholder** (one screen, two roles): reached from the menu's "Upgrade to
  Pro" row *and* from the upsell sheet's "Level up" button. Warm hero title,
  the full `PRO_BENEFITS` list, all three `PRO_PRICING` options as selectable
  cards (visual only), and a primary **"Upgrade to Pro"** button. Because no
  payment exists yet, that button opens a **placeholder** — a simple modal /
  toast: *"Payments aren't live yet — you'll be the first to know when Pro
  launches."* (No external links, no fake checkout.) A Pro user who somehow
  reaches this screen sees a "You're on Pro 👑 — thanks for being here early"
  state instead of the purchase CTA.

### 1.4 Navigation / integration

- **`components/MenuSheet.js`** — add an **"Upgrade to Pro"** row (crown icon)
  that `router.push('/pro')`. Shown **only to non-Pro users** (MenuSheet reads
  `useEntitlement`); a Pro user's crown already lives on Home, so the row would
  be noise for them. Placed at the top of `ITEMS` or just above the divider —
  decide for visual weight at build.
- **`app/(tabs)/index.js`** — when `isPro`, render `<ProBadge variant="overlay" />`
  over the header avatar (the `headerLeft` avatar `Pressable`). **Deviation from
  the request's "logo top-right":** the Home header has no logo — it's the
  avatar (identity) on the left and the streak/bell on the right. The avatar is
  the correct identity anchor for a Pro marker, and the camera-badge overlay
  pattern already exists there to copy. Flagging so it's a conscious choice, not
  a miss.
- **`app/settings.js`** — when `isPro`, render `<ProBadge variant="pill" />` in
  the profile card (`profileCard`), next to the name. Free users' card is
  unchanged (their upgrade path is the menu row).
- **`app/_layout.js`** — mount `ProUpsellSheetProvider` alongside the other
  sheet providers.
- **`app/onboarding/journey.js`** — **copy fix.** Current subtitle *"No
  subscription. No trial. No card, ever."* becomes false the moment Pro exists.
  The title's "For free" can **stay** (the core experience genuinely is free —
  the never-gate list). Change only the subtitle to something warm and still
  true, with **no price tag and no "Pro" mention** (the idea doc is explicit:
  don't put the paywall in onboarding). Recommended: **"No card to start. No
  catch."** — true for the free tier, keeps the welcoming tone. (Alternative if
  preferred: "The essentials are free, always.")

### 1.5 Impact on existing features

| Area | Impact | Watch for |
|---|---|---|
| `MenuSheet` | +1 conditional row; now reads `useEntitlement` | Row hidden for Pro users |
| Home header | Crown overlay on avatar when Pro | Must not shift layout when absent |
| Settings profile card | Pro pill when Pro | Free card unchanged |
| `journey.js` | Subtitle copy only | Title's "For free" retained deliberately |
| Everything else | **None** — nothing is gated this phase | Free users still unrestricted until Phase 2 |

### 1.6 What this phase does NOT include

- **No gates** — no limit is enforced yet; this phase is identity + surfaces only.
- **No payment** — the "Upgrade to Pro" button is a placeholder.
- **No `handle_new_user` change** — missing entitlement row = Free.

### 1.7 Phase 1 checklist

- [ ] `lib/pro.js`, `hooks/useEntitlement.js` created; missing row → `isPro:false`.
- [ ] `ProBadge` (overlay + pill), `ProBenefits`, `ProUpsellSheet`, `app/pro.js` created.
- [ ] Menu shows "Upgrade to Pro" for free users only; opens `/pro`.
- [ ] Home avatar shows the crown for Pro users; Settings profile shows the Pro pill.
- [ ] `/pro`'s "Upgrade to Pro" button shows the placeholder (no fake checkout, no external link).
- [ ] `journey.js` subtitle no longer claims "no subscription ever"; title unchanged.
- [ ] `ProUpsellSheetProvider` mounted; `openProUpsell()` opens the sheet and "Level up" routes to `/pro`.
- [ ] On-device: a grandfathered (Pro) account shows badges + no menu upsell row; a Free test account shows the menu row + no badges.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — The gates

### Goal

Free limits become real. A free user hitting the 2nd account, 3rd budget, 2nd
plan, a custom budget period, a report extra, or the AI receipt scan gets the
`ProUpsellSheet` at that exact moment, with a reason line naming what they hit.
Pro users are unaffected. Enforcement is **create-time only, never access-time**
— existing rows stay fully viewable/editable/deletable (keep-what-you-have, so a
future downgrade never destroys data).

### 2.1 Database

None.

### 2.2 The gate shape

A tiny helper reads Pro state + the relevant **user-wide** count and decides.
Counts are **not** taken from the account-scoped `useBudgets`/`usePlans` hooks
(those filter by active account) — the free limit is global, so the gate issues
a direct RLS-scoped count (`supabase.from('budgets').select('id', { count:
'exact', head: true })`, no account filter → counts all of the user's budgets).
Accounts come from `useAccount().accounts.length` (already user-wide).

Gate at the **create action**, before the create sheet opens, so a gated free
user gets the upsell instead of a form they can't submit:

```js
// pattern per surface (screen-level, where the + lives)
if (!isPro && count >= FREE_LIMITS.x) { openProUpsell(`reason`); return; }
openAddX();
```

### 2.3 Gate sites

| Gate | Where | Reason line |
|---|---|---|
| Accounts | `AccountSwitcherSheet` "add account" action (and any other `openAddAccount` call site) | "Free includes 1 account" |
| Budgets | Budgets tab `+` (`app/(tabs)/budgets.js`) | "Free includes 2 budgets" |
| Plans | Plans screen `+` (`app/plans.js`) | "Free includes 1 plan" |
| Custom budget period | **Inside** `AddBudgetSheet` — the `custom` period option is crown-marked; selecting it while free opens the upsell (can't be a call-site gate since it's a field choice) | "Custom periods are a Pro feature" |
| Report extras | `app/report.js` — custom range picker, all-accounts toggle, and the Report-screen Export button each crown-marked; tapping while free opens the upsell | "Full reports are a Pro feature" |
| AI receipt scan | `AddTransactionSheet.captureAndScan` — check `isPro` **before** calling `scanReceipt`; if free, `openProUpsell` instead. (Server still enforces via 403; this just replaces the silent "couldn't read receipt" with the real upsell.) | "Receipt scanning is a Pro feature" |

### 2.4 Impact on existing features

| Area | Impact | Watch for |
|---|---|---|
| Budgets tab / Plans screen / AccountSwitcher | `+` becomes conditional for free users | Editing/deleting existing rows must stay open (create-time only) |
| `AddBudgetSheet` | `custom` period gated | Calendar week/month always free; existing custom budgets still editable |
| `app/report.js` | 3 extras gated | Basic cadence report stays fully free |
| `AddTransactionSheet` | Scan checks `isPro` first | Manual entry entirely unaffected |
| Grandfathered users | None — all Pro | The only real user is Pro, so gates won't bite in practice |

### 2.5 What this phase does NOT include

- No access-time gating (never hide/lock *existing* data).
- No server-side enforcement of the account/budget/plan counts (client-side is
  sufficient per the idea doc — only AI needs hard server enforcement, and it
  already has it).
- No payment (still the master sequence's later step).

### 2.6 Phase 2 checklist

- [ ] Free user: 2nd account / 3rd budget / 2nd plan each open the upsell with the right reason; Pro user unaffected.
- [ ] Custom budget period opens the upsell for free; calendar week/month don't.
- [ ] Report custom-range / all-accounts / export open the upsell for free; basic report works.
- [ ] AI scan opens the upsell for a free user instead of the "couldn't read" error.
- [ ] Editing/deleting *existing* accounts/budgets/plans works for a free user (create-time only).

**→ Stop here. Show the result and wait for approval.**

---

## How to update a user's subscription in the DB (you asked)

There's no payment flow yet, so Pro is set by hand. In the Supabase SQL editor
(or via MCP):

**Make one user Pro (by email):**
```sql
insert into public.entitlements (user_id, is_pro)
select id, true from auth.users where email = 'someone@example.com'
on conflict (user_id) do update set is_pro = true, updated_at = now();
```

**Revoke Pro (back to Free):**
```sql
update public.entitlements set is_pro = false, updated_at = now()
where user_id = (select id from auth.users where email = 'someone@example.com');
```
(Or just `delete from public.entitlements where user_id = …` — a missing row
also reads as Free.)

**Check who's Pro:**
```sql
select u.email, coalesce(e.is_pro, false) as is_pro
from auth.users u left join public.entitlements e on e.user_id = u.id
order by u.created_at;
```

The client picks the change up on its next `useEntitlement` refetch (any
`notifyChanged()`, or app relaunch). When RevenueCat lands later, its webhook →
Edge Function writes this exact same row — the manual SQL is the stand-in for
that webhook, nothing else changes.

---

## Grandfathering (done as part of this feature)

All existing users are set to `is_pro = true` via MCP when this feature is
picked up (founder status). One statement, idempotent:
```sql
insert into public.entitlements (user_id, is_pro)
select id, true from auth.users
on conflict (user_id) do update set is_pro = true, updated_at = now();
```

---

## Out of scope (all phases)

- **Payment / RevenueCat / Play Billing** — later master-sequence step; this
  feature is structure + placeholder only.
- **`handle_new_user` creating an entitlement row** — unnecessary; missing = Free.
- **Server-side count enforcement** for accounts/budgets/plans — client-side is
  sufficient (only AI needs the hard server gate, already built).
- **Founder trophy / permanent discount / "announce before enforcing"** —
  gamification-adjacent, deferred to that track.
- **A trial** — no free-trial mechanics until payment exists.
