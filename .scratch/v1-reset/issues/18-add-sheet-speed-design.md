# Add sheet speed design (3-tap logging)

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 

## Question

How does the Add sheet get an expense logged in about 3 taps? It is the core loop and the first-expense step of onboarding ([03](03-onboarding-target-flow.md)), and it follows the design language from [04](04-design-language-direction.md).

Grill:
- **Smart default category:** last used? Most used at this time of day? A fixed default?
- **The category grid:** how many tiles (the audit says a top 8, onboarding a top 6), in what order, and whether it learns.
- **Saving:** a pinned Save button, and what the keyboard does on Save.
- **Defaults:** date defaults to today and the account defaults to the active one. How are they changed without adding taps?
- **Note and merchant:** optional, and where they sit.
- **Share-import:** how the sheet looks when pre-filled from share-import ([09](09-share-import-v1-scope.md)).
- **After Save:** what happens next. The streak moment and the "Nice one" Koban go through the moment queue from [02](02-gamification-scope.md).

Refs: audit §1 P0 "Make logging take 3 taps", §5 P0 "Speed up the Add sheet".

## Answer

Grilled with the user on 2026-10-18.

**1. Default category:**
1. On a share-import, the **merchant memory** from [09](09-share-import-v1-scope.md) wins.
2. Otherwise, the most-used category **at this time of day** over the last 30 days.
3. Otherwise, the most-used category overall.
4. For a brand-new user, **Food**.

**2. Category grid:**
- a **4×2 grid of the top 8**, directly under the amount, ordered by frequency;
- a **"More"** tile opens the full list;
- new users start with Food, Groceries, Transport, Shopping, Bills, Health, Fun and Other;
- onboarding's first expense uses the same grid.

**3. Entering and saving:**
- the amount is focused as soon as the sheet opens, on a **decimal keypad**;
- **Save is pinned above the keyboard** and enabled once the amount is above 0;
- the target is **+ → digits → Save = 3 taps** when the default is right;
- no "Save & add another" in v1.

**4. Layout:**
- a 2-way **Expense | Income** toggle, with Expense as the default;
- one collapsed **Details** row holding:
  - the date: **Today** and **Yesterday** chips plus a picker;
  - a note or merchant;
  - the account (only with 2+ accounts);
  - a split (only once a split exists).

Plans are gone, and Transfer is no longer on the toggle ([07](07-v1-scope-plans-splits-currency.md)).

**5. After Save:**
- the sheet closes with a light haptic;
- a toast reads **"Logged ₹X · Food"** with **Undo** (5 s);
- then the moment queue ([02](02-gamification-scope.md)) may show the streak moment or the "Nice one" Koban;
- no reward burst, and budget warnings go to the bell ([05](05-home-ia-and-tabs.md)).

**6. Measurement:** `seconds_to_save` (sheet open → Save) is a property on `expense_logged` ([17](17-analytics-event-plan-and-consent.md)). Timing only. The target is a median under 5 s.
