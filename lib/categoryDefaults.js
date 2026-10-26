// The Add sheet's default category and grid order (36-add-sheet-3-tap.md).
// Pure: everything comes in as arguments, so it's easy to reason about and
// reuse (spec 40's share-import passes its remembered merchant category).
//
// `history` is the user's recent transactions of one type, each with
// `category_id` and `created_at` (when it was logged, which is when the habit
// shows: occurred_at is a date with no time).

const DAY_MS = 24 * 60 * 60 * 1000;
export const RECENT_DAYS = 30;
export const GRID_SIZE = 8;

// A brand-new user's grid, before any history exists. Names match what
// handle_new_user seeds; Rent (also seeded) sits under More.
const STARTING_ORDER = {
  expense: ['Food', 'Groceries', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other'],
  income: ['Salary', 'Freelance', 'Other'],
};
const FALLBACK_NAME = { expense: 'Food', income: 'Salary' };

// Time-of-day windows, by local hour. Night wraps past midnight.
function windowOf(hour) {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

function countBy(rows, validIds) {
  const counts = new Map();
  for (const row of rows) {
    if (!validIds.has(row.category_id)) continue;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return counts;
}

function topOf(counts) {
  let best = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

function startingRank(type, name) {
  const index = (STARTING_ORDER[type] ?? []).indexOf(name);
  return index === -1 ? Infinity : index;
}

// Every category of the type, most useful first: by use in the last 30 days,
// then by use over all the given history, then the starting order, then name.
export function rankCategories(categories, history, type, now = new Date()) {
  const ids = new Set(categories.map((c) => c.id));
  const since = now.getTime() - RECENT_DAYS * DAY_MS;
  const recent = countBy(history.filter((t) => new Date(t.created_at).getTime() >= since), ids);
  const allTime = countBy(history, ids);
  return [...categories].sort(
    (a, b) =>
      (recent.get(b.id) ?? 0) - (recent.get(a.id) ?? 0) ||
      (allTime.get(b.id) ?? 0) - (allTime.get(a.id) ?? 0) ||
      startingRank(type, a.name) - startingRank(type, b.name) ||
      a.name.localeCompare(b.name)
  );
}

// The category to pre-select, in priority order: a remembered merchant's
// category; the most used in this time-of-day window over the last 30 days;
// the most used overall; Food (Salary for income); else the first by rank.
export function defaultCategoryId(categories, history, type, { now = new Date(), merchantCategoryId = null } = {}) {
  if (!categories.length) return null;
  const ids = new Set(categories.map((c) => c.id));
  if (merchantCategoryId && ids.has(merchantCategoryId)) return merchantCategoryId;

  const since = now.getTime() - RECENT_DAYS * DAY_MS;
  const window = windowOf(now.getHours());
  const inWindow = history.filter((t) => {
    const at = new Date(t.created_at);
    return at.getTime() >= since && windowOf(at.getHours()) === window;
  });
  const byWindow = topOf(countBy(inWindow, ids));
  if (byWindow) return byWindow;

  const overall = topOf(countBy(history, ids));
  if (overall) return overall;

  const fallback = categories.find((c) => c.name === FALLBACK_NAME[type]);
  return fallback?.id ?? rankCategories(categories, history, type, now)[0]?.id ?? null;
}

// The grid's 8: the top of the ranking, with the selected category swapped
// into the last slot if it isn't already there (picked from More, or an
// edited transaction's own), so the selection is always visible.
export function gridCategories(ranked, selectedId) {
  const top = ranked.slice(0, GRID_SIZE);
  if (!selectedId || top.some((c) => c.id === selectedId)) return top;
  const selected = ranked.find((c) => c.id === selectedId);
  if (!selected) return top;
  return [...top.slice(0, GRID_SIZE - 1), selected];
}
