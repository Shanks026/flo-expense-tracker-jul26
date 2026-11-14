# 10: Budget proposals

Spec: .claude/features/archive/44-ai-assistant.md (Phase 4)

**What to build:** "Set a ₹6,000 food budget for this month" gives a budget proposal card. Review opens the Add Budget sheet filled in as a **new** budget; until now that sheet could only open an existing one for editing. Save creates it, and the free-plan budget gate still runs at Save. A category the person doesn't have gets a question back ("which category did you mean?"), not a guess.

**Blocked by:** 09

**Status:** done

- [x] Review opens a new, fully filled budget; Save creates one row
- [x] Editing an existing budget works as before
- [x] The gate code path still runs at Save (with billing flagged off, it passes)
- [x] A missing category gets a question, not a guess

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

2026-11-09, emulator (Pixel_API_36), function deployed:
- **`propose_budget`** checks the amount (within ₹1 crore), the category (one of their expense categories, or "all" for all spending), `period_type` (`calendar_week`, `calendar_month` or `custom`, the values the sheet writes) and the account. A custom budget needs both dates, a range that hasn't already ended, and at most 366 days. A category that isn't theirs goes back to the model as "do not guess: ask".
- **`AddBudgetSheet.open()`** takes an object without `id` as a new budget, filled in (amount, category, period, custom dates, account), with `onDone({ saved })`. An object with `id` is still an edit, and no argument is still a blank new budget.
- **Gate at Save:** for a new budget, Save runs the custom-period gate and `budgetLimitReached(hasPro)` (new in `lib/budgets.js`, also used by the Budgets screen's New Budget button) before inserting. With `FLAGS.billing` off, `hasPro` is true and both pass. Over the limit, the sheet closes and the upsell opens.
- **"Set a 6000 food budget for this month"** (the test account has no Food category) got a question back, not a guess: all spending, Groceries, or one of Breakfast, Lunch, Dinner and Snacks. Answering "Snacks" gave a card reading ₹6,000 · Snacks · Every month · Personal. Review opened "New Budget" with ₹6000, Month and Snacks; Create Budget made it ("Budget created"), and the card turned to "Saved ✓". Budgets now lists one Snacks ₹6,000 budget beside the earlier two.
- **Editing:** Lunch → edit opened "Edit Budget" (₹800, Month, Lunch, Delete) as before, and Save Budget updated it. As always, saving renames a budget to its category, so "Lunch budget" is now "Lunch". New Budget on the Budgets screen still opens a blank sheet.
- **Fixed during the check:**
  - The model had offered "a combination" of categories, so the prompt now says a budget is exactly one category or all spending.
  - **Chat answers were being cut off.** The logs showed `finish_reason: 'length'` from Haiku 5.5 on a 25-word answer, so the 500-token cap was being used up by the model's own reasoning. This also explains the list answer that stopped partway in ticket 09. The cap is now 1,500, and the answer is still cut to 2,000 characters.
- Test data added: the Snacks ₹6,000 monthly budget.
