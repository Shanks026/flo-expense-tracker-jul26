// Transaction detail's rules (spec 46, ticket 11): what to call an entry's
// source, and its History timeline. Pure, with no React Native imports, so
// scripts/ledger-check.mjs checks them under node.

// `transactions.source` → the line in Details and the sub on "Created".
// Null (entries from before ticket 07) and anything unknown get no label,
// so the screen shows no source line rather than a guess.
const SOURCE_LABELS = {
  manual: 'Added by you',
  quick_add: 'Quick add',
  voice: 'Voice',
  ai: 'Ask FLO',
  share: 'Shared to FLO',
  auto_detect: 'Auto-detected',
  bill: 'Bill paid',
  split: 'Split entry',
  transfer: 'Transfer',
};

export function sourceLabel(source) {
  return SOURCE_LABELS[source] ?? null;
}

// The History steps, oldest first: [{ key, title, sub?, at }].
// - "Created" at created_at, with the source label as the sub;
// - "Edited" at updated_at, only when it's later than created_at (the
//   trigger sets it on an update; an equal stamp isn't an edit);
// - "Added to <split>" at the live split entry's created_at.
// Undo isn't a step: an undone entry no longer exists.
export function buildHistory(tx, splitEntry = null) {
  const steps = [{ key: 'created', title: 'Created', sub: sourceLabel(tx.source) ?? undefined, at: tx.created_at }];
  if (tx.updated_at && Date.parse(tx.updated_at) > Date.parse(tx.created_at)) {
    steps.push({ key: 'edited', title: 'Edited', at: tx.updated_at });
  }
  if (splitEntry?.created_at) {
    const name = splitEntry.split?.name;
    steps.push({ key: 'split', title: name ? `Added to ${name}` : 'Added to a split', at: splitEntry.created_at });
  }
  return steps.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
