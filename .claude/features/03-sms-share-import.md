# Feature: SMS Share Import
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/03-sms-share-import.md`
**Status**: Planned
**Last Updated**: July 2026

---

## Context

Logging a transaction after a bank SMS arrives is still a fully manual round trip: open FLO, tap ⊕, read the amount back off the SMS, type it in. This feature lets the user long-press a bank SMS in their Messages app, hit **Share → FLO**, and land directly in the existing Add Transaction sheet with the amount and expense/income direction already filled in — category, plan, and account stay manual, exactly as discussed and agreed.

This is the deliberately smaller alternative to a fuller idea discussed and rejected: automatically reading all SMS in the background and showing a Truecaller-style overlay. That approach needs `READ_SMS`/`RECEIVE_SMS` and `SYSTEM_ALERT_WINDOW` — both Android "restricted" permissions Google Play has locked down hard for non-default SMS/dialer apps since 2019 (several Indian budgeting apps had this exact feature pulled around 2020–2021) — plus real native Android engineering (broadcast receiver, foreground service, overlay window) and is impossible on iOS entirely (no SMS access, no overlay API, full stop). **The share-intent approach needs neither restricted permission** — registering as a share target for `text/plain` is the same unrestricted mechanism Twitter, Notion, or any note-taking app uses; the user is the one who explicitly chooses to share. It's still Android-only (iOS's equivalent is a separate Share Extension target — materially bigger effort, out of scope here) and it still requires leaving Expo Go for a custom dev client, since registering a share target means adding a native Android manifest entry — but that's a one-time workflow change, not an ongoing one, and this project has never needed a custom native config until now.

---

## Phase Overview

```
Phase 1 — Native plumbing: share-target registration + raw receive
  Get FLO into Android's share sheet and prove the native→JS bridge works,
  isolated from any parsing or UI work. Highest-uncertainty phase, kept
  small on purpose.

Phase 2 — SMS parser (pure JS)
  A standalone function that turns raw SMS text into a best-effort
  { amount, type } guess, or null if it can't tell confidently. Zero
  native risk, testable against real SMS samples independent of Phase 1.

Phase 3 — Wire into Add Transaction + active-account awareness
  Sharing a parsed SMS opens the existing Add Transaction sheet
  pre-filled. Every entry point into that sheet (not just this one) also
  gains a small "Adding to: {account}" row so it's always clear which
  account a transaction lands in, without adding a picker.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Native plumbing: share-target registration + raw receive 🚧 Implementation done — awaiting on-device verification

### Goal
Sharing plain text from another Android app (e.g. long-press an SMS in Messages → Share) shows **FLO** in the share sheet. Tapping it opens FLO and displays the raw shared text (a simple `Alert.alert`, nothing fancier) — proving the native manifest registration and the native-to-JS bridge both work, before any parsing or sheet-integration code depends on them.

### Before Starting — Confirm With Codebase
- Confirm no `android/`/`ios/` native folders exist yet in this repo (they don't, as of this doc) — this phase triggers this project's **first-ever native prebuild**. Check `.gitignore` already excludes `android/`/`ios/` (standard Expo default) once they're generated; add if missing.
- Confirm `app.json`'s current `plugins` array before adding to it: `["expo-router", "expo-font", "expo-asset", "expo-web-browser", "@react-native-community/datetimepicker"]`.
- Research the exact current API/config shape of whichever share-intent library is used (candidate: `expo-share-intent`) against Expo SDK 54 at implementation time — do not assume the config shown below is exact; verify against the library's own docs first, since this doc was written without running it.

### 1.1 Database
No database changes in this phase — this feature has no database footprint at all, in any phase.

### 1.2 Data Layer
- **`hooks/useIncomingShare.js`** — new. Thin wrapper around the chosen library's share-receiving hook, so the rest of the app depends on FLO's own hook shape, not the third-party library's exact API (worth the small extra layer here specifically because this is an external dependency of unproven fit for this project). Returns the raw shared text (or `null`) and a way to acknowledge/clear it once handled.

### 1.3 Components
None yet — Phase 1 proves plumbing only, via `Alert.alert(text)` when a share is received.

### 1.4 Navigation / Integration
- `app.json`: add the share-intent plugin to `plugins`, configured for `text/plain` `ACTION_SEND` on Android only (no iOS config).
- First native prebuild: `npx expo prebuild` (or `npx expo run:android` does this implicitly) generates `android/` for the first time.
- `app/_layout.js`: mount `useIncomingShare()` at the root (alongside the other providers) so it's active regardless of which screen is showing when a share arrives.
- Building and testing this phase requires a custom dev client (`npx expo run:android` locally, or an EAS dev-client build) — Expo Go cannot pick up the native manifest change. Expo Go continues to work normally for every other feature in the app; only this one requires the dev client.

### 1.5 Impact on Existing Features
| Existing Feature | Impact | Watch for |
|---|---|---|
| Local/EAS build workflow | First native prebuild for this project | Confirm `.gitignore` covers the generated native folders before committing anything |
| Every other feature | None functionally | Still fully testable in Expo Go |

### 1.6 What This Phase Does NOT Include
- SMS parsing (Phase 2)
- Any Add Transaction integration (Phase 3)
- iOS share support

### 1.7 Phase 1 Checklist — Before Marking Complete
- [x] `app.json` includes the share-intent plugin with valid Android-only config
- [ ] `npx expo run:android` (or an EAS dev-client build) succeeds and produces an installable app — **not run from this environment, no device/emulator attached; needs you**
- [ ] FLO appears in Android's share sheet when sharing plain text (e.g. from the Messages app) — **on-device, needs you**
- [ ] Tapping FLO in the share sheet opens the app and shows the raw shared text via `Alert.alert` — **on-device, needs you**
- [ ] Expo Go still works normally for every other feature in the app after this change — **needs your confirmation; see note below on `expo start` behavior**

### Implementation Notes

- Installed `expo-share-intent@5.0.0` (confirmed via web research as the version compatible with Expo SDK 54; `expo-linking` was already a dependency, satisfying its peer requirement). `npx expo install` auto-added a bare `"expo-share-intent"` plugin entry to `app.json` — replaced with the array form actually needed: `{ "disableIOS": true, "androidIntentFilters": ["text/*"] }`.
- `hooks/useIncomingShare.js` wraps `expo-share-intent`'s `useShareIntent()` as planned, returning `{ sharedText, clearSharedText }`.
- `app/_layout.js`: `useIncomingShare()` mounted in `RootNavigator`; a `useEffect` shows `Alert.alert('Shared text received', sharedText, [{ text: 'OK', onPress: clearSharedText }])` — the Phase 1 proof-of-concept exactly as scoped.
- Ran `npx expo prebuild --no-install --clean` — succeeded, generated `android/` (iOS skipped per `disableIOS`). **Verified directly in the generated `android/app/src/main/AndroidManifest.xml`** that the correct intent-filter landed on `MainActivity`: `action=android.intent.action.SEND`, `data mimeType=text/*`, `category=DEFAULT` — this is the actual mechanism that makes FLO show up in the Android share sheet, confirmed present rather than assumed from the plugin's log output alone.
- **Investigated and ruled out a false alarm**: the generated manifest also contains `SYSTEM_ALERT_WINDOW` — the exact "draw over other apps" permission this feature was designed specifically to avoid. Traced it via `grep` across `node_modules` to `react-native/ReactAndroid/.../debug/AndroidManifest.xml` — it's React Native core's own **debug-build-only** manifest entry (powers the dev tools overlay/LogBox), present in every RN app's debug variant regardless of this feature, not something `expo-share-intent` or this implementation added. Not a regression from this feature's stated goal.
- `expo prebuild` also rewrote `package.json`'s `android`/`ios` npm scripts from `expo start --android`/`--ios` to `expo run:android`/`expo run:ios` — this is standard once native folders exist, and matches the doc's plan (those two scripts are now dev-client launchers). **`npm start` / `npx expo start` is untouched** and should still work for Expo Go.
- **One nuance to verify on your end**: with native `android/`/`ios/` folders now present, `npx expo start` may change its default QR/menu behavior (some Expo CLI versions prioritize dev-client launch options once native folders exist). If plain Expo Go scanning stops being the obvious default, `npx expo start --go` forces the old Expo-Go-only behavior. Please confirm which happens for you — I can't observe this from here.
- **Nothing was run against a real device or emulator from this environment** — there isn't one attached. Everything above is verified as far as static analysis (config, generated manifest, `prebuild` exit code) can go; the actual share-sheet appearance and text hand-off need your phone.

**→ Stop here for your on-device test. Report back what you see, then we'll mark Phase 1 complete and move to Phase 2.**

---

## Phase 2 — SMS parser (pure JS) ✅ Complete (sanity-checked against constructed samples, not yet real device SMS)

### Goal
A standalone, dependency-free function that takes raw SMS text and returns a best-effort `{ amount, type }` guess — or `null` when it can't tell confidently, rather than guessing wrong. Fully testable on its own, with zero relationship to Phase 1's native plumbing.

### Before Starting — Confirm Phase 1 is Approved
- Confirm the exact string shape Phase 1's `useIncomingShare()` actually delivers (plain text, any wrapping/trimming already applied by the library) before writing the parser against it.

### 2.1 Database
No database changes.

### 2.2 Data Layer
**`lib/smsParser.js`** — new, pure functions, no Supabase/React:
- `parseTransactionSms(text)` → `{ amount: number, type: 'income' | 'expense' } | null`
- Amount: regex over common Indian bank notations — `Rs.`, `Rs`, `INR`, `₹`, comma-grouped thousands, optional paise (`₹12,345.67`).
- Direction: keyword scan — expense: `debited`, `spent`, `withdrawn`, `paid`, `purchase`; income: `credited`, `received`, `deposited`, `refund`.
- Returns `null` if amount can't be found, or if no direction keyword matches — an ambiguous or non-transaction message (OTP, promo text) should fall through to manual entry, not produce a wrong guess.

### 2.3 Components
None.

### 2.4 Navigation / Integration
None — pure library code, not yet wired into anything.

### 2.5 Impact on Existing Features
None — new, isolated file.

### 2.6 What This Phase Does NOT Include
- Wiring into the Add Transaction sheet (Phase 3)
- A bank-specific format database or fuzzy/ML matching — plain regex heuristics only, refined later against real samples if particular banks' formats don't parse well
- Category or merchant detection

### 2.7 Phase 2 Checklist — Before Marking Complete
- [x] Correctly extracts amount + type — checked against 10 constructed sample SMS texts covering common Indian bank formats (debit/credit, UPI, card spend, salary/NEFT, comma+decimal amounts, `Rs.`/`INR`/`₹` notations). **Not yet checked against real SMS from your actual bank(s)** — the real test is your device.
- [x] Returns `null` for non-transaction text — verified against a constructed OTP message and a promotional message
- [x] Handles comma-formatted amounts and `Rs.`/`INR`/`₹` notations — verified

### Implementation Notes

- `lib/smsParser.js` built as planned: `parseTransactionSms(text)`, two internal helpers (`findAmount`, `findDirection`), no dependencies.
- **`findAmount`** skips any currency match immediately preceded by balance-context wording ("Avl Bal:", "Available Balance:", "Bal:") within a short lookback window — real bank SMS almost always state the transaction amount before the balance, and without this check the parser would frequently grab the wrong number.
- **`findDirection`** takes whichever of the expense/income keyword sets appears **earlier** in the string, not just "any match" — handles the common "A/c debited by Rs.X; MERCHANT credited" phrasing correctly (the user's own account action is stated first).
- **Bug caught before it shipped**: the initial expense-keyword list included `purchase`, which false-positived on a constructed promotional message ("...on your next purchase with XYZ card") that has no actual transaction. Removed it — `debited`/`spent`/`withdrawn`/`paid`/`debit` are all far less ambiguous as standalone signals than "purchase," which shows up constantly in non-transactional marketing copy.
- **Verification method**: this project has no test framework (no Jest anywhere in the codebase), so — consistent with how every other phase in this project gets verified — I wrote a throwaway `.mjs` script with 10 constructed sample SMS texts (covering debit/credit/UPI/card/salary/OTP/promo/no-amount/decimal cases), ran it with plain `node`, fixed the one failure it caught, reran to confirm 10/10, then deleted the script. It was never committed.
- **Real bank SMS from your own accounts may not match these constructed samples exactly** — different banks phrase things differently. If Phase 3's on-device testing shows misparses, the fix is almost always tuning `EXPENSE_PATTERN`/`INCOME_PATTERN`/`CURRENCY_PATTERN` in this one file, not a structural change.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Wire into Add Transaction + active-account awareness

### Goal
Sharing a bank SMS to FLO opens the existing Add Transaction sheet pre-filled with the parsed amount and type, ready for category/plan selection and Save. Separately — and visible from **every** entry point into that sheet, not just this one — a small non-editable row shows which account the transaction will land in, so the "whichever account is active" model (confirmed, no picker) doesn't leave you guessing.

### Before Starting — Confirm Phase 2 is Approved
- Re-read `AddTransactionSheet.js`'s actual `open(payload)` and `handleSave` as currently built — it already supports `open({ plan_id })` for Plan Detail's pre-linked "Add Expense"; this phase extends the same pattern, don't assume the code hasn't shifted since this doc was written.
- Re-read `AccountSwitcherSheet.js`'s `useAccountSwitcherSheet().openAccountSwitcher` hook signature and `lib/AccountContext.js`'s `useAccount()` shape (`activeAccount.name`, `.color`).

### 3.1 Database
No database changes.

### 3.2 Data Layer
No new hooks — `app/_layout.js`'s share handler (from Phase 1) now calls `parseTransactionSms(text)` (Phase 2) and either `openAdd({ amount, type })` on a successful parse, or `openAdd({ note: text })` on `null` (raw text preserved in the note field rather than silently dropped) — instead of Phase 1's placeholder `Alert.alert`.

### 3.3 Components
- **`AddTransactionSheet.js`**:
  - `open(payload)`'s new-transaction branch (no `payload.id`) additionally reads `payload.amount`/`payload.type` and pre-fills the amount field + type segment (currently only reads `payload.plan_id`).
  - New small header row: color dot + `activeAccount.name`, e.g. "Adding to: Personal" — always rendered, regardless of entry point (⊕ tab, Plan Detail, or this feature). Tapping it dismisses the sheet and calls `openAccountSwitcher()` (matching the existing dismiss-then-open pattern already used between `MenuSheet` and other sheets).

### 3.4 Navigation / Integration
`app/_layout.js`'s share handler is updated as described in 3.2. No new routes.

### 3.5 Impact on Existing Features

| Existing Feature | Impact | Watch for |
|---|---|---|
| Add Transaction sheet (⊕ tab, Plan Detail's "Add Expense") | Gains the "Adding to: {account}" row | Existing create/edit flows otherwise unchanged — verify the row doesn't show when editing an existing transaction (it stays in its original account, unaffected either way) |

### 3.6 What This Phase Does NOT Include
- An account picker inside the sheet — explicitly rejected; "whichever account is active" plus this awareness row is the agreed design
- Category or plan auto-fill from the SMS text

### 3.7 Phase 3 Checklist — Before Marking Complete
- [ ] Sharing a real bank SMS to FLO opens Add Transaction pre-filled with the correct amount and expense/income
- [ ] Sharing text that fails to parse still opens Add Transaction, with the raw text in the note field — not a dead end
- [ ] The "Adding to: {account}" row shows the correct active account on every entry point into the sheet
- [ ] Tapping the row opens the account switcher; after switching, the next transaction opened (any entry point) reflects the new active account
- [ ] ⊕ tab and Plan Detail's "Add Expense" still work exactly as before, just with the new row visible

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

No new tables, columns, or views — this feature has zero database footprint. Everything lives in `app.json` config, `lib/smsParser.js`, `hooks/useIncomingShare.js`, and an extension to `AddTransactionSheet.js`.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Add Transaction sheet | Gains optional `amount`/`type` prefill support + an always-visible active-account row | Phase 3 |
| Project build workflow | First native prebuild; this feature specifically needs a custom dev client to test, everything else stays Expo-Go-testable | Phase 1 |

---

## Out of Scope (All Phases)

- **iOS support** — no equivalent low-effort mechanism; would need a separate native Share Extension target, materially bigger than this whole feature. Future consideration only.
- **Full SMS auto-read / background listening / overlay UI** — the originally-discussed, larger idea. Rejected: needs `READ_SMS`/`RECEIVE_SMS` + `SYSTEM_ALERT_WINDOW`, both Google Play "restricted" permissions with real rejection history for exactly this use case, plus a much bigger native engineering surface (broadcast receiver, foreground service, overlay window). This feature is the deliberately smaller, permission-free alternative.
- **Automatic category or account detection** — always manual, per explicit decision.
- **Bank-specific format database or ML-based parsing** — plain regex heuristics, refined over time against real samples.
- **Sharing images/MMS** — `text/plain` only.
- **An account picker inside Add Transaction** — explicitly rejected in favor of "whichever account is active" + the awareness row.
