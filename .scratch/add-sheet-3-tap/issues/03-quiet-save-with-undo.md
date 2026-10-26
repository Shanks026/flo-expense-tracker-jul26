# 03: Quiet save with Undo

Spec: .claude/features/36-add-sheet-3-tap.md

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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
