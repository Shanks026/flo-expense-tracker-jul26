# 01: Smart default category and the 4×2 grid

Spec: .claude/features/36-add-sheet-3-tap.md

**What to build:** When the Add sheet opens for a new expense, the category most likely to be right is already selected, and the user's top 8 categories sit in a 4×2 grid directly under the amount. Nothing is hidden in a sideways scroll any more. A 9th **More** tile opens the full category list, picker-style.

The default comes from one small, pure module, worked out from the user's own transactions. In priority order:
1. a remembered merchant's category, a slot that spec 40 fills later;
2. the most-used category in the current time-of-day window over the last 30 days;
3. the most-used category overall;
4. Food.

The same usage ranking orders the grid: 30 days first, falling back to all time. A new user with no history sees Food, Groceries, Transport, Shopping, Bills, Health, Entertainment, Other. Income uses the same ranking over income categories.

An explicit `categoryId` in the opener's payload still wins, and editing an existing transaction keeps its own category.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] With lunch-time Food history, opening the sheet at noon has Food selected
- [ ] With no history, Food is selected and the grid shows the starting 8 in order
- [ ] The grid shows the top 8 by use, 4×2, with no horizontal scroll
- [ ] More opens every category for the current type, and picking one selects it
- [ ] Switching to Income re-ranks and re-defaults from income categories
- [ ] Editing a transaction keeps its category; a payload `categoryId` is honoured

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-26: Built.
  - **`lib/categoryDefaults.js`** (pure):
    - `rankCategories`: by 30-day use, then use across the fetched history, then the starting order, then name.
    - `defaultCategoryId`: the merchant slot (spec 40), then the most used in the time-of-day window over 30 days, then the most used overall, then Food (Salary for income).
    - `gridCategories`: the top 8, with the selected category swapped into the last slot when it isn't already there.
    - Time-of-day windows by local hour of `created_at`: 5–11, 11–15, 15–18, 18–22, night.
  - **`hooks/useCategoryUsage.js`:** the newest 500 expense and income rows with a category, across accounts, refetched on `version`.
  - **Add sheet:**
    - A 4×2 grid replaces the horizontal chip scroll.
    - More (shown only when there are more than 8 categories) expands every category in place, and picking one collapses the grid with that category swapped in. The spec suggested the manage-categories screen in picker mode; expanding in place avoids pushing a route on top of a bottom sheet.
    - A payload `categoryId` wins over the default. Switching type re-defaults.
    - A new entry opened before categories load gets its default once they arrive.
- **Checks:**
  - A node run of the pure module passed 10 cases: starting order, no history gives Food, the time-of-day window, the overall fallback, merchant first, ranking by recent use, the all-time fallback, the selected category swapped into the grid, and grid size.
  - An esbuild bundle of `app/` passes.
- Code review, left: `useCategories` returns new arrays every render, so the ranking memo re-sorts on each render. It's cheap at today's sizes.
- Open emulator checks (paused): every acceptance line.
