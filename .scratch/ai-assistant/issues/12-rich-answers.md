# 12: Rich answers in Ask FLO

Spec: .claude/features/44-ai-assistant.md (§3.3, "Rich answers")

**What to build:** Answers stop being one paragraph. The model may write a small set of formatting (bold, bullet and numbered lists, a short heading), and the app draws it with FLO's fonts and colours using a small formatter of its own, with no library. A breakdown is shown as a table: day, week, month or category, the amount right-aligned, the count, a thin bar for each row, and a total. The table is drawn from the tool's own result, which the function attaches to the reply, never from numbers the model typed. The model writes only the sentence around it. Past answers draw their tables again from what's stored.

**Blocked by:** 06

**Status:** ready-for-agent

- [x] "Food this month by day" shows a table whose rows and total match the database
- [x] A category breakdown shows a table sorted biggest first, matching Insights' list
- [x] A short question still gets a short answer, with no heading or list it doesn't need
- [x] Bold and lists render; unsupported markdown (links, code, model-written tables) shows as plain text, never raw symbols
- [x] Stored answers draw the same table after leaving the chat and coming back
- [x] Light and dark, on Pixel_API_36

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

**2026-11-09: built, deployed and checked on Pixel_API_36.**
- **Formatting:** `components/RichText.js` is FLO's own parser for bold, "- " and "1. " lists, and one "### " heading. Links keep their text, `code` loses its ticks, and a table the model writes anyway becomes "a · b" lines. A lone "*", snake_case and "2026." at the start of a line are left alone. These cases were checked in Node.
- **Tables:** `components/BreakdownTable.js` draws every `by_day`, `by_week`, `by_month` or `by_category` list from the stored tool log (`ai_messages.tool_calls`). Each row has the function's label, the entry count, the ₹ string and a bar sized by a numeric `value`, with the tool's total underneath. Every row is returned, so the table adds up; more than 62 rows is refused with a hint to go coarser.
- **Layout (the person's call):** answers sit on the page with no bubble, as in other AI chats, and each table is on its own card.
- **Several categories:** `spend_summary` takes `category_ids`, which the function adds up. A multi-category total breaks down by category unless another breakdown is asked for. A supplied but empty or malformed list is an error, never a silent total over all categories. The prompt's category rules map a word like "food" onto the person's own category names, leave arguable ones out and name them, and always say what was counted.
- **Emulator:**
  - Food by day: Sun 8 Nov ₹570, Mon 9 Nov ₹380, total ₹950.
  - Spending by category: Food ₹950, Groceries ₹250, total ₹1,200, matching Insights, in light and dark.
  - Then, on the test account with Food renamed to Lunch and Breakfast, Dinner and Snacks added: "how much did I spend on food this month?" → ₹1,430 across Breakfast, Lunch, Dinner and Snacks, with "I left out Groceries".
  - "Yes include groceries" → ₹1,680.
  - "Expand lunch by day" → Sun 8 Nov ₹570, Mon 9 Nov ₹380.
  All match the database.
- **Stored tables:** after each turn the screen reloads the conversation from `ai_messages` (tool_calls included), and the tables stayed. Reopening an old chat can only be checked once ticket 08's past-chats screen exists.
- **Review fixes:**
  - An answer interrupted mid-reveal now shows in full.
  - No layout spring runs on each revealed word.
  - A marker-only last line waits for its first word.
  - The function's labels are used, so the table and the sentence agree.
  - Duplicate tables are dropped.
  - Old rows without values draw no bars.
- **Test data left on the test account:** the Lunch rename, plus Breakfast, Dinner and Snacks with one entry each.
