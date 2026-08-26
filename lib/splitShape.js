// One place that turns Supabase's snake_case rows into the camelCase shapes
// lib/splitMath.js expects. Both split hooks run the same embedded select, so
// without this the normalisation would be duplicated and could drift — and a
// drift here is a wrong balance, not a cosmetic bug.
//
// Kept out of splitMath.js on purpose: that file stays pure and knows nothing
// about the database.

// The single embedded select both hooks use. Shares hang off entries, members
// carry their person, settlements come flat.
export const SPLIT_SELECT = `
  id, user_id, account_id, name, icon, occurred_on, plan_id, status, closed_at, created_at,
  split_members ( id, person_id, is_self, role, member_user_id, display_name,
                  split_people ( id, name, color, phone ) ),
  split_entries ( id, description, amount, occurred_on, payer_member_id, strategy,
                  transaction_id, created_at, updated_at, deleted_at,
                  split_entry_shares ( member_id, amount ) ),
  split_settlements ( id, from_member_id, to_member_id, amount, occurred_on,
                      transaction_id, note, created_at )
`;

// `myUserId` is REQUIRED once splits can be shared (Phase 3), and getting this
// wrong is not a cosmetic bug — it decides whose balance the screen calls
// "yours".
//
// `is_self` was a single-user flag meaning "the row that represents me on my
// device". In a shared split the member rows are global and read by several
// people, so identity has to be viewer-relative: I am the member whose
// `member_user_id` is my auth id. `is_self` survives only as a fallback for
// rows written before Phase 3, and even then only when I'm the split's creator
// — otherwise the organizer's own `is_self` row would read as "You" on
// everybody else's phone.
export function normalizeSplit(row, myUserId = null) {
  const iOwnThisSplit = !!myUserId && row.user_id === myUserId;

  const members = (row.split_members ?? [])
    .map((m) => {
      const isSelf = myUserId
        ? m.member_user_id === myUserId || (m.is_self && iOwnThisSplit && !m.member_user_id)
        : m.is_self;
      // A ghost is known by its contact name; a member who joined by link (and
      // the creator) carries the display_name projected onto the row, because
      // `profiles` is owner-only and must stay that way. `split_people`
      // resolves to null for anyone but the split's owner — that IS the privacy
      // boundary — hence display_name as the shared fallback.
      const rawName = isSelf
        ? m.display_name
        : (m.split_people?.name ?? m.display_name ?? 'Someone');

      return {
        id: m.id,
        personId: m.person_id,
        memberUserId: m.member_user_id,
        isSelf,
        role: m.role,
        // Your own row reads "Chris (You)", not a bare "You". In a list of five
        // names, an unnamed "You" is the one row you can't cross-check against
        // what the group already calls you — and the shared summary text has to
        // match what everyone else sees. Falls back to plain "You" only when no
        // name is stored (a split created before the backfill).
        name: isSelf ? (rawName ? `${rawName} (You)` : 'You') : rawName,
        // The undecorated name, for avatar initials and anywhere the "(You)"
        // suffix would be noise.
        shortName: rawName ?? 'You',
        // Only the owner can read their own contacts, so these are null for
        // everyone else — never treat them as present.
        color: m.split_people?.color ?? null,
        phone: m.split_people?.phone ?? null,
        // A joined FLO user vs. a name someone typed. Drives nothing yet
        // beyond a badge, but the distinction matters for removal rules.
        isGhost: !m.member_user_id,
      };
    })
    // Self first, then alphabetical — a stable order so chip rows and balance
    // lists don't reshuffle between renders.
    .sort((a, b) => (a.isSelf ? -1 : b.isSelf ? 1 : a.name.localeCompare(b.name)));

  // Soft-deleted entries are filtered here rather than in the query: the
  // embedded select can't express "only non-deleted children", and every
  // consumer wants them gone. deleted_at is still available on the raw row if
  // an audit view ever needs it.
  const entries = (row.split_entries ?? [])
    .filter((e) => !e.deleted_at)
    .map((e) => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      occurredOn: e.occurred_on,
      payerMemberId: e.payer_member_id,
      strategy: e.strategy,
      // Phase 2: the transaction in the user's own ledger this entry came from
      // (or produced). NULL is the norm — most entries are other people's
      // spending, which never touches the ledger.
      transactionId: e.transaction_id ?? null,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
      deletedAt: e.deleted_at,
      shares: (e.split_entry_shares ?? []).map((s) => ({
        memberId: s.member_id,
        amount: Number(s.amount),
      })),
    }))
    .sort((a, b) => (a.occurredOn === b.occurredOn
      ? new Date(a.createdAt) - new Date(b.createdAt)
      : a.occurredOn.localeCompare(b.occurredOn)));

  const settlements = (row.split_settlements ?? [])
    .map((s) => ({
      id: s.id,
      fromMemberId: s.from_member_id,
      toMemberId: s.to_member_id,
      amount: Number(s.amount),
      occurredOn: s.occurred_on,
      transactionId: s.transaction_id,
      note: s.note,
      createdAt: s.created_at,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    split: {
      id: row.id,
      userId: row.user_id,
      iOwnThisSplit,
      accountId: row.account_id,
      name: row.name,
      icon: row.icon,
      occurredOn: row.occurred_on,
      planId: row.plan_id,
      status: row.status,
      closedAt: row.closed_at,
      createdAt: row.created_at,
    },
    members,
    entries,
    settlements,
  };
}
