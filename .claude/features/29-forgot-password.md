# Feature: Forgot Password (email OTP reset)
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/29-forgot-password.md`
**Status**: 📋 Planned — **BLOCKED on custom SMTP** (see below). App-side plan is
final and approved; not started. The 6-digit code cannot be delivered until
custom SMTP is configured, because Supabase locks email-template editing behind
custom SMTP and the default recovery template sends a magic *link*, never a
code. User chose to **pause** rather than build the fallback magic-link/deep-link
version (2026-07-26).
**Last Updated**: 2026-07-26

---

## Context

The Sign In screen already renders a **"Forgot password?"** link
(`app/sign-in.js`, ~line 241) but it is a dead `Pressable` with no `onPress` —
tapping it does nothing. A user who forgets their password today has no
recovery path at all and is locked out permanently.

This feature makes it live: request a reset → receive a **6-digit code** by
email → enter it in a 6-box code input alongside a new password → on success,
return to Sign In and log in fresh.

**It is built entirely on Supabase Auth's native recovery OTP** — no Edge
Function, no custom mail server, no custom code table. `resetPasswordForEmail`
sends the email; the same recovery email can carry a **6-digit token**
(`{{ .Token }}`) instead of (or alongside) a magic link; `verifyOtp({ type:
'recovery' })` validates that code and returns a short-lived session;
`updateUser({ password })` sets the new password under that session. This is
deliberately the OTP path and **not** the magic-link path: magic links require
deep-link plumbing into the auth layer, and this codebase runs
`detectSessionInUrl: false` with implicit flow on purpose (see the long
comments in `lib/supabase.js` and `AuthContext.signInWithGoogle` — that redirect
path is fragile; PKCE was tried and reverted). The OTP keeps the whole flow
in-app and touches none of it.

**No database changes.** This is pure Supabase Auth API + one new screen + one
reusable component + wiring the existing dead link.

### Two product decisions settled during planning

1. **6-digit code, not magic link** — more robust on mobile, entirely in-app,
   and avoids the fragile deep-link/redirect machinery. (Answer to "do we even
   need an email code": yes, and it's Supabase's built-in recovery OTP — we
   don't build our own.)
2. **Force re-login after the change, do NOT auto-login.** `verifyOtp` already
   creates a live session (that's how `updateUser` is authorised), so after the
   password change the user is technically signed in. We explicitly `signOut()`
   and send them to Sign In. Rationale: FLO is finance software; re-login after
   a password reset is the expected, reassuring pattern, and it confirms the new
   password actually works. The cost is one `signOut()` call.

### HARD PREREQUISITE — custom SMTP (the current blocker)

**Confirmed 2026-07-26 in the dashboard**: on this project's default email
service, the "Reset Password" template's Subject and Body are **read-only** —
Supabase shows *"Set up custom SMTP to edit templates"* and the default recovery
template sends only a magic **link** (`{{ .ConfirmationURL }}`), with **no
6-digit code anywhere**. The 6-digit code (`{{ .Token }}`) only appears if the
template can be edited, and the template can only be edited with **custom SMTP**
configured.

So the dependency chain is: **6-digit code → edit template → custom SMTP.**
There is no no-SMTP way to deliver the code. The MCP cannot help either — it
exposes no auth-config / email-template tooling (`execute_sql`,
`apply_migration`, `deploy_edge_function`, etc. only).

**Decision (2026-07-26)**: the user chose to **pause** this feature until SMTP
is set up, rather than build the fallback magic-link/deep-link version (which
would need `flo://` deep-link handling + redirect-URL config — the fragile
implicit-flow redirect path this codebase deliberately avoids; see Context).

**To unblock**: configure custom SMTP (e.g. Resend, ~15 min), then do the
template edit in **§Dashboard Setup** below. Nothing in the app-side plan
changes when SMTP lands — the screen, `CodeInput`, and the two `AuthContext`
methods are identical regardless of email provider.

---

## Phase Overview

```
Phase 1 — Forgot-password OTP flow (the whole feature)
  New /reset-password screen (request email → enter code + new password →
  back to Sign In), a reusable CodeInput component, two new AuthContext
  methods, the dead "Forgot password?" link wired up, and the reset-password
  route allowlisted in RootNavigator so it isn't bounced. No DB changes.
```

Single phase — every piece is interdependent and there is no schema migration
to gate a phase boundary on. **Stop for approval when it's done.**

---

## Phase 1 — Forgot-password OTP flow

### Goal

A signed-out user can tap "Forgot password?", enter their email, receive a
6-digit code, enter that code with a new password + confirmation, and — on
success — land back on Sign In where the new password works. A wrong or expired
code, a too-short password, or a mismatched confirmation each show a clear
inline error without leaving the screen.

### Before Starting — Confirm With Codebase

Verify these by reading the actual files (they may have moved since this was
written):

- **`app/sign-in.js`** — the "Forgot password?" `Pressable` is at ~line 241,
  currently `<Pressable style={styles.forgotRow}>` with **no `onPress`**. It
  imports `useLocalSearchParams` from `expo-router` but **not** `useRouter` —
  that import must be added. Confirm the screen pins to the fixed default
  palette (`resolveColors(DEFAULT_ACCENT_ID, DEFAULT_MODE_ID)`, ~line 41) — the
  reset screen copies this exact pinning (see 1.3 for why it matters here too).
- **`lib/AuthContext.js`** — the `value` object (~line 159) exposes
  `signUp/signIn/signOut/signInWithGoogle/deleteAccount/verifyUser`. The two new
  methods follow the same shape (plain async fn, `throw error` on failure) and
  get added to that object. Note `signOut()` already exists and does a normal
  (session-scoped) sign-out — reuse it.
- **`app/_layout.js` `RootNavigator`** — the signed-out redirect effect
  (~lines 352-358): while `!session`, any route whose `segments[0]` is not
  `'sign-in'` or `'onboarding'` is `router.replace`'d away. **`'reset-password'`
  must be added to that allowlist**, or the screen is bounced to Sign In the
  instant it mounts. Confirm the exact condition string before editing.
- **`app/_layout.js` `OnboardingGate`** — confirm it only redirects a
  signed-in user when they're on `sign-in` or `onboarding` (it does, ~line 180).
  This is why the transient recovery session created by `verifyOtp` does **not**
  yank the user off `/reset-password`: that segment is neither. No change needed
  here — just confirm the assumption holds.
- **`theme/tokens.js`** (`radii`, `spacing`, `fontFamily`, `fontSize`) and
  **`theme/themes.js`** (`resolveColors`, `DEFAULT_ACCENT_ID`, `DEFAULT_MODE_ID`)
  — the reset screen and CodeInput style from these, same as `sign-in.js`.
- **`components/Button.js`** — reused for the primary actions, same
  `style={{ backgroundColor: colors.brand }}` override sign-in.js uses to force
  the fixed brand fill on a pre-auth screen.

### 1.1 Database

**No database changes in this phase.** The entire flow uses Supabase Auth's
built-in recovery OTP. No new table, column, view, index, RLS policy, or RPC.

### 1.2 Data Layer

**Two new methods on `AuthContext`** (`lib/AuthContext.js`), added to the
exported `value` object. No new hook — auth state is already a context.

```js
// Sends the recovery email. Supabase's recovery email carries a 6-digit OTP
// ({{ .Token }}) once the dashboard template surfaces it — see the doc's
// Dashboard Setup. No redirectTo is passed: we use the code, not the link.
//
// NOTE ON ENUMERATION PROTECTION: resetPasswordForEmail does NOT error for a
// non-existent email (Supabase deliberately hides whether an account exists),
// so a successful return does NOT mean an account was found. The UI must not
// claim it did — copy says "If an account exists for that email, a code is on
// its way." A real error here is a rate-limit (429) or transport failure, both
// worth surfacing.
async function sendResetCode(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) throw error;
}

// Verifies the 6-digit recovery code, sets the new password, then FORCES A
// SIGN-OUT (product decision: re-login, not auto-login). verifyOtp establishes
// a live session — that session is what authorises updateUser — so without the
// final signOut the user would be silently logged in. All three run in one
// call so the recovery session never outlives this function: the user is never
// left parked on the app in a half-authenticated recovery state.
async function confirmPasswordReset(email, token, newPassword) {
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token,
    type: 'recovery',
  });
  if (verifyError) throw verifyError;            // wrong / expired code

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) throw updateError;            // e.g. weak / same-as-old password

  await supabase.auth.signOut();                 // re-login, don't auto-login
}
```

Add both to `value`:
`{ ..., sendResetCode, confirmPasswordReset }`.

**Why verify-and-update are one call, not two screens.** The screen reveals the
password fields client-side once six digits are entered (nice UX, matches the
"enter code → then set password" feel), but does **not** hit the network until
final submit. Verifying the code as a separate earlier step would create the
recovery session while the user is still typing their new password — during
which any navigation reaction (or abandoning the screen) leaves them in a
weird logged-in-via-recovery state. Doing verify→update→signOut atomically on
submit means the session exists only for the few milliseconds inside
`confirmPasswordReset`, and `OnboardingGate` never acts on it (the reset route
is neither `sign-in` nor `onboarding`).

### 1.3 Components

**New reusable component: `components/CodeInput.js`**

A row of 6 single-character boxes for the OTP.

- **Props**: `value` (string, the current code), `onChange(next)` (called with
  the full string on every edit), `length` (default `6`), `colors` (the theme
  colors object — passed in rather than read via `useTheme()` so the caller
  controls theming; the reset screen passes its **fixed default palette**, see
  below), `autoFocus` (default `true`), `editable` (default `true`).
- **Behaviour**:
  - `keyboardType="number-pad"`, one digit per box, auto-advance to the next box
    on entry, backspace on an empty box moves focus to the previous box and
    clears it.
  - **Paste support**: if a box receives more than one character (a pasted
    code), distribute the digits across the boxes from that position — users
    routinely copy the code out of the email. Strip non-digits.
  - Boxes render from `value` (controlled), so a parent reset (e.g. clearing on
    error) reflects immediately.
  - Filled boxes get a brand-accented border; the focused box is highlighted;
    an `editable={false}` state dims them (used while the submit is in flight).
- Styled from `theme/tokens.js` + the passed `colors`. No business logic — it's
  a dumb controlled input.

**New screen: `app/reset-password.js`** (an `expo-router` route, pushed from
Sign In).

- **Pins to the fixed default palette**, exactly like `sign-in.js`
  (`resolveColors(DEFAULT_ACCENT_ID, DEFAULT_MODE_ID)`, `makeStyles(colors)`).
  This matters *more* here than on sign-in: `verifyOtp` briefly creates a real
  session, which wakes `ThemeProfileSync` to load the user's saved
  accent/mode — reading the active theme would repaint the reset screen into
  the account's colours mid-submit. A pinned palette means it never re-themes.
  The shared `<Button>` fill is forced with `style={{ backgroundColor:
  colors.brand }}`, same override sign-in.js uses.
- **Two internal steps via local state** (`step: 'request' | 'reset'`), one
  screen — not two routes:
  - **`request`**: heading ("Reset your password"), an email `TextInput`
    (reuse sign-in's `inputRow`/`Mail`-icon styling), a "Send code" `<Button>`
    (loading while the email sends). On success → set `step='reset'` and show a
    subtle confirmation line ("If an account exists for **{email}**, a code is
    on its way."). Prefill the email from `?email=` route param if passed (see
    1.4) so a user who already typed it on Sign In doesn't retype it.
  - **`reset`**: the `<CodeInput>` (6 boxes) + a "Resend code" text link
    (calls `sendResetCode` again, with a short cooldown to respect rate
    limits), then — revealed once all 6 digits are entered — a **new password**
    field and a **confirm password** field (reuse sign-in's `Lock`-icon
    `inputRow` + show/hide eye toggle), and a "Reset password" `<Button>`.
    On submit: client-validate (password ≥ 6 chars, matches confirm), then call
    `confirmPasswordReset(email, code, password)`. On success →
    `router.replace('/sign-in')` and a success toast. On error → inline
    `errorText` (reuse sign-in's error style): map `verifyOtp` failure to
    "That code is invalid or has expired", update failure to its message.
- **Back**: a header back affordance / the OS back returns to Sign In (it was
  pushed, so `router.back()` works; the RootNavigator allowlist keeps it from
  being bounced while it's open).

**Password rules**: minimum **6 characters** (Supabase's default
`updateUser` minimum — a shorter one errors server-side anyway) and must equal
the confirm field. Both checked client-side before the network call, shown as
inline errors. Do not invent stronger rules than the backend enforces.

File tree for the phase:

```
app/reset-password.js          (new — the flow screen)
components/CodeInput.js         (new — reusable 6-box OTP input)
lib/AuthContext.js             (edit — +2 methods)
app/sign-in.js                 (edit — wire the dead link, import useRouter)
app/_layout.js                 (edit — allowlist 'reset-password' in RootNavigator)
```

### 1.4 Navigation / Integration

- **`app/sign-in.js`** — wire the existing dead link:
  `onPress={() => router.push({ pathname: '/reset-password', params: { email } })}`
  (passing the currently-typed email so it prefills). Add `useRouter` to the
  existing `expo-router` import and call `const router = useRouter();`.
- **`app/_layout.js` `RootNavigator`** — add `'reset-password'` to the
  signed-out allowlist so the screen isn't redirected away:
  ```js
  if (first === 'sign-in' || first === 'onboarding' || first === 'reset-password') return;
  ```
  This is **required**, not optional — without it a signed-out user is bounced
  to `/sign-in` the moment `/reset-password` mounts.
- No new tab, no menu entry, no change to `OnboardingGate` (confirmed in
  "Before Starting" — the transient recovery session doesn't trigger it).

### 1.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| `app/sign-in.js` | Dead "Forgot password?" link becomes a real push; +`useRouter` import | The link only shows in sign-in mode (`!isSignUp`) — that's already the case, leave it |
| `app/_layout.js` `RootNavigator` | +1 route in the signed-out allowlist | The exact condition string must match; a typo silently bounces the screen |
| `lib/AuthContext.js` | +2 methods on `value` | Follow the existing `throw error` shape; don't swallow the rate-limit error |
| `OnboardingGate` | None (confirmed) | The recovery session is transient and on a non-gated route — verify on device it doesn't flash Home |
| `ThemeProfileSync` | Fires briefly when `verifyOtp` creates a session | The reset screen's pinned palette makes this invisible — confirm no colour flash on submit |
| Google-only accounts | A Google user *can* reset and thereby gain a password (both auth methods coexist) | Acceptable, out of scope to block — note it, don't special-case it |

### 1.6 What This Phase Does NOT Include

- **No magic-link path** — OTP only, deliberately (see Context).
- **No custom SMTP setup** — uses Supabase's built-in email sender. Fine for
  development and low volume; production deliverability/rate-limits are a
  separate ops task (see Dashboard Setup note).
- **No password-strength meter or rules beyond the backend minimum** (≥6 chars).
- **No "change password while logged in"** flow (Settings) — this is the
  *forgot* path only. A logged-in change is a separate, smaller feature
  (`updateUser` under the existing session, no OTP).
- **No rate-limit UI beyond a resend cooldown** — a 429 surfaces as an inline
  error message; we don't build a countdown timer.
- **No email enumeration reveal** — the UI never confirms whether an account
  exists (Supabase's own protection is preserved).

### 1.7 Phase 1 Checklist — Before Marking Complete

Dashboard prerequisite:

- [ ] The "Reset Password" email template surfaces `{{ .Token }}` (a real test
      email arrives showing a 6-digit code, not only a link).
- [ ] Auth email OTP length is 6 (matches the 6 boxes) and expiry is ≤ 1 hour.

Flow — happy path:

- [ ] "Forgot password?" on Sign In pushes `/reset-password` with the typed
      email prefilled.
- [ ] Entering an email + "Send code" advances to the code step and a real
      6-digit code arrives by email.
- [ ] Entering the correct code reveals the password fields; a valid new
      password + matching confirm + "Reset password" succeeds.
- [ ] On success the app returns to `/sign-in` and the **new** password logs in;
      the **old** password no longer works.
- [ ] After a successful reset the user is **signed out** (not auto-logged-in) —
      they land on Sign In, not Home.

Flow — errors & edges:

- [ ] A wrong or expired code shows "invalid or expired" inline and does not
      leave the screen or sign the user in.
- [ ] A password < 6 chars, or a confirm mismatch, is caught client-side with
      an inline error before any network call.
- [ ] "Resend code" sends a fresh code and respects a short cooldown.
- [ ] A non-existent email still advances to the code step (no enumeration
      leak); no code arrives; a wrong code there just fails verification.
- [ ] Rate-limit (429) from too many requests surfaces as a readable inline
      error, not a crash or silent no-op.

Navigation & theming:

- [ ] `/reset-password` is **not** bounced to `/sign-in` when opened while
      signed out (the allowlist entry works).
- [ ] No colour flash on the reset screen when the code is submitted (the
      transient recovery session doesn't repaint it — pinned palette holds).
- [ ] OS back / header back from `/reset-password` returns to Sign In cleanly.

CodeInput component:

- [ ] Typing auto-advances; backspace on an empty box moves back and clears.
- [ ] Pasting a 6-digit code fills all boxes and strips non-digits.
- [ ] Non-digit input is rejected.

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

**No data model changes.** This feature adds no table, view, column, or RPC —
it is built entirely on Supabase Auth's existing recovery-OTP endpoints
(`resetPasswordForEmail`, `verifyOtp` with `type: 'recovery'`, `updateUser`).

```
Sign In  ──"Forgot password?"──►  /reset-password
                                      │
                 sendResetCode  ──────┤  resetPasswordForEmail(email)  ──►  email w/ 6-digit code
                                      │
        confirmPasswordReset  ────────┤  verifyOtp({type:'recovery'})  ──►  transient session
                                      │  updateUser({password})        ──►  password changed
                                      │  signOut()                     ──►  session cleared
                                      ▼
                                   /sign-in  (log in with new password)
```

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Sign In (`app/sign-in.js`) | Dead link becomes live; +`useRouter` | Phase 1 |
| RootNavigator (`app/_layout.js`) | +1 signed-out allowlist route | Phase 1 (required) |
| AuthContext (`lib/AuthContext.js`) | +2 methods | Phase 1 |
| Supabase Auth email template | Must surface `{{ .Token }}` | Manual (dashboard) |

---

## Dashboard Setup (manual — do this before testing)

**This cannot be done via the Supabase MCP** — no MCP tool edits auth config or
email templates. Do it in the dashboard for project `uergtlcfpwajztqgncim`:

0. **Configure custom SMTP first (required — this is the blocker).**
   Dashboard → **Authentication → Emails → SMTP Settings** → enable custom SMTP
   with a provider's credentials (Resend recommended for ease: 3,000/mo free;
   Brevo/SES are alternatives). Until this is done, steps 1–2 are locked
   (Subject/Body read-only) and no 6-digit code can be sent. A from-address is
   the one real requirement — a provider test domain works to get going; verify
   your own domain (SPF/DKIM) before real launch for deliverability.

1. **Surface the code in the recovery email.**
   Dashboard → **Authentication** → **Emails** (Email Templates) →
   **"Reset Password"** template. The default body uses
   `{{ .ConfirmationURL }}` (the magic link). Add the 6-digit token so the user
   sees a code, e.g.:

   ```html
   <h2>Reset your FLO password</h2>
   <p>Enter this code in the app to reset your password:</p>
   <p style="font-size:28px; font-weight:bold; letter-spacing:4px;">{{ .Token }}</p>
   <p>This code expires shortly. If you didn't request it, ignore this email.</p>
   ```

   You can keep the link too if you like, but the code (`{{ .Token }}`) is what
   this flow uses. Save.

2. **Confirm OTP length + expiry.**
   Dashboard → **Authentication** → **Providers** → **Email** (or
   Authentication → **Sign In / Providers**). Ensure **Email OTP length = 6**
   (matches the 6-box input) and **Email OTP expiration ≤ 3600s** (1 hour; the
   security advisor recommends ≤ 1 hour).

3. **Deliverability (before real launch).** Whatever provider you chose in
   step 0, verify your own sending domain (SPF/DKIM) rather than relying on a
   provider test domain, so reset emails don't land in spam. Not needed to get
   the flow working in development.

Once step 1 is done, a real reset email will show the 6-digit code and Phase 1
can be verified end-to-end.

---

## Out of Scope (All Phases)

- **Magic-link recovery** — deliberately rejected for the deep-link fragility
  it would add; OTP only.
- **In-app "change password" (logged-in)** from Settings — a separate, simpler
  feature (`updateUser` under the live session, no OTP). Future build.
- **Custom SMTP / branded email domain** — an ops task, not app code.
- **Password-strength rules beyond the backend's ≥6-char minimum** — no meter,
  no complexity policy.
- **Blocking password reset for Google-only accounts** — allowed to proceed;
  it simply adds a password to that account.
</content>
</invoke>
