// Split settlements in the ledger. Deliberately mirrors lib/transfers.js in
// both shape and reasoning — a reader who knows that file will recognise this
// one by analogy (31-split-expenses.md §2.4, option B).
//
// `settle_in` / `settle_out` are transaction types that MOVE in_hand_balance but
// are excluded from every spent/earned total, budget, plan, analytics function
// and the streak, because all of those filter on the exact strings 'income' /
// 'expense'. That exact-type discipline is the whole safety property: an
// aggregation nobody remembered to update simply doesn't match these types,
// which is the correct outcome.
//
//   settle_in   money received that is NOT income — someone repaid what you
//               fronted for them. Your balance rises; your earnings don't.
//   settle_out  money paid that is NOT your own consumption — you fronted it
//               for other people. Your balance falls; your spending doesn't.
//
// WHAT WRITES THEM TODAY: only `settle_in`, from SettleUpSheet when someone
// pays you back. A settlement where YOU pay stays a plain `expense`, because
// that genuinely is your own consumption — the asymmetry is the point. You pay
// your share (spending); you get back what you over-paid (not earnings).
//
// `settle_out` has no writer yet. It's declared so the balance formula, the
// display layer and the CSV export all handle it from day one, which makes the
// refinement it exists for (splitting a fronted payment into your share plus
// the part you're owed) a client-only change with no further migration. See the
// doc's §2.4 for that, and for the one residual case it would close.

export function isSettlement(tx) {
  return tx?.type === 'settle_in' || tx?.type === 'settle_out';
}

// Short enough for a transaction row's title. Direction is carried by
// AmountText's ± sign rather than repeated in words.
export function settlementLabel() {
  return 'Split settlement';
}

export function settlementCsvLabel(tx) {
  return tx?.type === 'settle_in' ? 'Settlement In' : 'Settlement Out';
}
