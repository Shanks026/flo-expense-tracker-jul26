# 03: Quiet save with Undo

Spec: .claude/features/archive/36-add-sheet-3-tap.md

**What to build:** Saving feels instant and calm. On Save:
- the transaction is inserted and `notifyChanged()` runs;
- the sheet closes with a light haptic (`expo-haptics`);
- a "Logged ₹250 · Food" toast shows with **Undo** for 5 seconds. Undo deletes the row and runs `notifyChanged()`.

**Removed from the save path:**
- the reward burst;
- the budget and plan warning toasts (blown budgets already show in the bell's alerts);
- rank and trophy checks triggered from the sheet.

The daily claim may still record silently.

**Full-screen moments** (the streak celebration and the others registered in `lib/moments.js`) wait while the sheet is open and show after it closes. Spec 34's moment queue later replaces this.

Edits keep a plain "Transaction updated" toast, with no Undo.

**Blocked by:** 02 (The slimmer sheet layout)

**Status:** ready-for-agent

- [ ] Save closes the sheet with a haptic and the "Logged ₹X · Category" toast
- [ ] Undo within 5 s deletes the transaction, and Home and the list update
- [ ] No reward burst or budget/plan toast after a save; an over-budget category shows in the bell
- [ ] A day-one streak celebration appears only after the sheet has closed
- [ ] `expo-haptics` is added through `npx expo install` and the app rebuilds

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-26: Built.
  - **`expo-haptics`** (~15.0.8) was added with `npx expo install`. It's a native module, so rebuild before the next emulator pass.
  - **After a new save:** `notifyChanged()`, close, a light impact haptic, then "Logged ₹X · Category" (`formatMoney` with the account's currency) with **Undo** for 5 s. Undo deletes the row and calls `notifyChanged()`.
    - A save that also created a split entry gets no Undo, because the split entry is shared and would outlive the deleted transaction (`split_entries.transaction_id` is `ON DELETE SET NULL`, checked via MCP).
    - Edits show "Transaction updated".
  - **Removed:** the RewardBurst and the budget and plan toasts. The daily claim still records silently. Blown budgets already appear in the bell (`useAlerts`).
  - **Moments:** the open sheet registers as an `add-sheet` moment. StreakCelebration and RankUpCelebration now wait while any *other* moment is showing (the new `useOtherMomentActive` in `lib/moments.js`), so they appear after the sheet closes. Coach marks already waited on any moment.
  - **Onboarding:** its special cases in the sheet are gone, since the burst and toasts are gone for everyone.
- Code review, left:
  - Undo doesn't remove the `expense_logged` event or the day's claim.
  - `planToastForSave` in `lib/alerts.js` is now unused. PayBillSheet still uses `budgetToastForSave`, which is out of scope here.
- Open emulator checks (paused): every acceptance line, after a rebuild for the haptics module.
