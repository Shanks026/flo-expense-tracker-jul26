// Where a transaction came from: `transactions.source` (spec 46, ticket 07).
// Pure, no React Native imports: scripts/ledger-check.mjs checks it.
//
// The database's check constraint allows exactly these values; null means
// "from before this was recorded" (there's no backfill).
export const ENTRY_SOURCES = ['manual', 'quick_add', 'voice', 'ai', 'share', 'auto_detect', 'bill', 'split', 'transfer'];

// The Add sheet's draft → its source on insert.
// - `source` is the sheet's analytics source for `expense_logged` (spec 33):
//   'manual', 'onboarding', 'quick_local', 'quick_ai', 'share', 'assistant'.
//   Those values stay as they are; this only translates them.
// - `origin` is for an opener the analytics source can't tell apart
//   (auto-detect). A known value wins.
// - `spoken` is true when the quick-add line was filled by voice.
// bill, split and transfer are written by their own mutations in lib/.
export function entrySource({ source, origin, spoken = false } = {}) {
  if (origin && ENTRY_SOURCES.includes(origin)) return origin;
  switch (source) {
    case 'quick_local':
    case 'quick_ai':
      return spoken ? 'voice' : 'quick_add';
    case 'assistant':
      return 'ai';
    case 'share':
      return 'share';
    default:
      return 'manual';
  }
}
