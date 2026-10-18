// Pure split math — no Supabase, no React, no formatting decisions beyond the
// one summary builder at the bottom. This file is the correctness core of
// 31-split-expenses.md: every rupee figure the Split screens print comes out
// of here, and two invariants have to hold or the feature is silently wrong.
//
//   1. Σ shares === entry.amount   (also enforced server-side in save_split_entry)
//   2. Σ net    === 0              across every member of a split
//
// Neither is decoration. Money between friends is the one place a rounding
// drift is unforgivable — a split whose balances don't net to zero looks
// perfectly plausible on screen and is wrong. See the doc's Decision 12.
//
// Everything computes in integer paise internally and converts back to rupees
// once, at the edge. Adding rupee floats (0.1 + 0.2 !== 0.3) is exactly how
// the sums stop closing.

const PAISE = 100;

function toPaise(amount) {
  return Math.round(Number(amount ?? 0) * PAISE);
}

function fromPaise(paise) {
  return paise / PAISE;
}

// Largest-remainder distribution: give everyone the floor, then hand the
// leftover paise out one each until they're gone. ₹100 across 3 people is
// 33.34 + 33.33 + 33.33, never 33.33 × 3 = ₹99.99.
//
// Ordering is a LEXICOGRAPHIC SORT OF THE MEMBER IDS, deliberately — not
// insertion order. Recomputing the same entry has to produce the identical
// assignment every time, or the extra paisa wanders between renders and
// between the client's preview and what the server stored.
export function resolveEqualShares(amount, memberIds) {
  const ids = [...memberIds].sort();
  const n = ids.length;
  const out = {};
  if (n === 0) return out;

  const total = toPaise(amount);
  const base = Math.floor(total / n);
  const remainder = total - base * n;

  ids.forEach((id, i) => {
    out[id] = fromPaise(base + (i < remainder ? 1 : 0));
  });
  return out;
}

// Does this shares map close against the entry total? The sheet blocks Save on
// this before the RPC ever gets a chance to reject it — same check, friendlier
// place to fail.
export function sharesBalance(amount, sharesByMemberId) {
  const target = toPaise(amount);
  const sum = Object.values(sharesByMemberId).reduce((acc, v) => acc + toPaise(v), 0);
  return { balanced: sum === target, remaining: fromPaise(target - sum) };
}

// net > 0  => this member is OWED money
// net < 0  => this member OWES money
//
// A settlement from X to Y is X handing over cash, which REDUCES X's debt, so
// it raises X's net and lowers Y's. Settlements are not consumption and never
// touch `owed` — conflating the two double-counts, which is why the schema
// keeps them in separate tables.
export function computeBalances({ members, entries, settlements }) {
  const paid = {};
  const owed = {};
  const settledIn = {};
  const settledOut = {};

  members.forEach((m) => {
    paid[m.id] = 0;
    owed[m.id] = 0;
    settledIn[m.id] = 0;
    settledOut[m.id] = 0;
  });

  entries.forEach((entry) => {
    if (entry.payerMemberId in paid) paid[entry.payerMemberId] += toPaise(entry.amount);
    (entry.shares ?? []).forEach((share) => {
      if (share.memberId in owed) owed[share.memberId] += toPaise(share.amount);
    });
  });

  settlements.forEach((s) => {
    if (s.fromMemberId in settledOut) settledOut[s.fromMemberId] += toPaise(s.amount);
    if (s.toMemberId in settledIn) settledIn[s.toMemberId] += toPaise(s.amount);
  });

  return members.map((m) => ({
    memberId: m.id,
    paid: fromPaise(paid[m.id]),
    owed: fromPaise(owed[m.id]),
    settledIn: fromPaise(settledIn[m.id]),
    settledOut: fromPaise(settledOut[m.id]),
    net: fromPaise(paid[m.id] - owed[m.id] + settledOut[m.id] - settledIn[m.id]),
  }));
}

// Greedy netting: biggest creditor against biggest debtor, repeatedly. Produces
// at most n-1 payments.
//
// There is deliberately NO "simplify" toggle. Paying a small amount doesn't
// make you a creditor — on the trip this feature was built for, three people
// paid money and only ONE ended up owed anything, so every sensible algorithm
// returns the same list ("everyone pays Abishek"). A control that changes
// nothing in the overwhelming majority of real splits is worse than no
// control. See the simplify-debts note in the doc's Research section.
export function suggestPayments(balances) {
  const creditors = balances
    .filter((b) => toPaise(b.net) > 0)
    .map((b) => ({ memberId: b.memberId, left: toPaise(b.net) }))
    .sort((a, b) => b.left - a.left || (a.memberId < b.memberId ? -1 : 1));
  const debtors = balances
    .filter((b) => toPaise(b.net) < 0)
    .map((b) => ({ memberId: b.memberId, left: -toPaise(b.net) }))
    .sort((a, b) => b.left - a.left || (a.memberId < b.memberId ? -1 : 1));

  const payments = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].left, debtors[di].left);
    if (amount > 0) {
      payments.push({
        fromMemberId: debtors[di].memberId,
        toMemberId: creditors[ci].memberId,
        amount: fromPaise(amount),
      });
    }
    creditors[ci].left -= amount;
    debtors[di].left -= amount;
    if (creditors[ci].left === 0) ci += 1;
    if (debtors[di].left === 0) di += 1;
  }
  return payments;
}

// EVERY debt, traced to whoever actually paid — not collapsed into the fewest
// payments. This is the honest answer to "who owes whom", and it exists because
// `suggestPayments` alone hid something real: on a trip with three payers, the
// two who fronted small amounts are still NET debtors, so greedy netting quietly
// absorbed the money they were owed into their own debt and never mentioned it.
// You fronted a ₹51 auto for three people; Maaz and Srijish each owe you ₹17,
// and no amount of netting makes that untrue.
//
// Each participant owes the entry's payer their share of that entry. Mutual
// debts between the same two people are netted against each other (if A owes B
// ₹100 and B owes A ₹30, that's A owes B ₹70 — two people don't hand each other
// cash both ways), and settlements cancel debt in the direction they were paid.
export function computeDirectDebts({ members, entries, settlements = [] }) {
  const memberIds = new Set(members.map((m) => m.id));
  const pair = {}; // "from->to" -> paise

  const add = (from, to, paise) => {
    if (from === to || !paise) return;
    if (!memberIds.has(from) || !memberIds.has(to)) return;
    const k = `${from}->${to}`;
    pair[k] = (pair[k] ?? 0) + paise;
  };

  entries.forEach((e) => {
    (e.shares ?? []).forEach((s) => add(s.memberId, e.payerMemberId, toPaise(s.amount)));
  });

  // A settlement is money already handed over, so it reduces debt in the
  // direction it was paid. Overshooting flips the sign, which the pair-netting
  // below turns into a debt the other way — correct: overpay and you're owed.
  settlements.forEach((s) => add(s.fromMemberId, s.toMemberId, -toPaise(s.amount)));

  const seen = new Set();
  const debts = [];
  const offsets = [];

  Object.keys(pair).forEach((key) => {
    const [a, b] = key.split('->');
    const pairKey = [a, b].sort().join('|');
    if (seen.has(pairKey)) return;
    seen.add(pairKey);

    const ab = pair[`${a}->${b}`] ?? 0;
    const ba = pair[`${b}->${a}`] ?? 0;
    // Worth surfacing separately: a pair who owed each other in BOTH directions
    // is the case where a bare net figure is least self-explanatory.
    if (ab > 0 && ba > 0) {
      offsets.push({ aMemberId: a, bMemberId: b, aOwed: fromPaise(ab), bOwed: fromPaise(ba) });
    }
    const net = ab - ba;
    if (net > 0) debts.push({ fromMemberId: a, toMemberId: b, amount: fromPaise(net) });
    else if (net < 0) debts.push({ fromMemberId: b, toMemberId: a, amount: fromPaise(-net) });
  });

  return { debts, offsets };
}

// The traced debts, grouped under the person who owes them — which is how you'd
// actually read a statement: one block per debtor, each debt listed, a total.
//
// This replaced a second "simplest way to settle" section that sat alongside the
// flat list. The two were never identical — the flat list carries the small
// inter-person debts (Maaz owes Stephin ₹28.67) that greedy netting dissolves —
// but on a one-creditor trip they look near enough the same to read as a bug,
// and showing one pair two different amounts on one screen is worse than showing
// one. So each group now carries BOTH: the debts as they really are, and the net
// after what that person is owed back, which is the figure they'd actually pay.
//
// Only DEBTORS get a group, so every debt appears exactly once. Someone who is
// purely owed money shows up inside other people's groups.
// `selfName` is how the viewer should be referred to, and it differs by
// surface — which is the whole reason it's a parameter rather than a constant:
//   in-app  -> "Chris (You)"  (member.name), so your own row is identifiable
//              in a list of five names
//   exports -> "Chris"        (member.shortName), because a shared PDF saying
//              "You owe ₹1,367.60" tells the recipient nothing about WHO owes it
// Either way the grammar is third person, since the subject is a name.
export function groupDebtsByDebtor({ members, debts, selfName }) {
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const labelOf = (m) =>
    m?.isSelf ? (selfName ?? 'You') : (m?.shortName ?? m?.name ?? 'someone');

  return members
    .map((m) => {
      const owes = debts
        .filter((d) => d.fromMemberId === m.id)
        .sort((a, b) => toPaise(b.amount) - toPaise(a.amount));
      if (!owes.length) return null;

      const owesTotal = owes.reduce((a, d) => a + toPaise(d.amount), 0);
      const owedTotal = debts
        .filter((d) => d.toMemberId === m.id)
        .reduce((a, d) => a + toPaise(d.amount), 0);

      return {
        memberId: m.id,
        isSelf: !!m.isSelf,
        name: labelOf(m),
        // For the avatar tile — the same colour and initial the People table
        // uses, so a person is recognisable in both places.
        shortName: m.shortName ?? m.name,
        color: m.color ?? null,
        // Third person whenever the subject is a NAME. Only the bare-pronoun
        // fallback (no selfName supplied) takes a first-person verb — without
        // this the default renders "You owes".
        verb: m.isSelf && !selfName ? 'owe' : 'owes',
        owes: owes.map((d) => ({
          toMemberId: d.toMemberId,
          toName: labelOf(memberById[d.toMemberId]),
          amount: d.amount,
        })),
        owesTotal: fromPaise(owesTotal),
        owedTotal: fromPaise(owedTotal),
        // What they'd hand over once what they're owed is taken off. Equals
        // owesTotal for anyone who isn't owed anything, which is most people.
        net: fromPaise(owesTotal - owedTotal),
      };
    })
    .filter(Boolean)
    // Me first — the number you opened the screen for — then biggest debt down.
    .sort((a, b) => (a.isSelf ? -1 : b.isSelf ? 1 : toPaise(b.owesTotal) - toPaise(a.owesTotal)));
}

// The mirror of groupDebtsByDebtor: grouped under the person who COLLECTS.
//
// Added because "who owes whom" grouped only by debtor answered "what do I pay"
// and never "what am I owed". Abishek — owed ₹5,470.40, the largest fact in the
// whole split — had no block of his own at all, appearing only as rows inside
// other people's cards; and Stephin's ₹57.33 survived solely as a muted aside.
// Both directions are real questions and each deserves its own section.
//
// Yes, every debt appears in both views. That is the point: one is a bill, the
// other is a receipt.
export function groupCreditsByCreditor({ members, debts, selfName }) {
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const labelOf = (m) =>
    m?.isSelf ? (selfName ?? 'You') : (m?.shortName ?? m?.name ?? 'someone');

  return members
    .map((m) => {
      const owed = debts
        .filter((d) => d.toMemberId === m.id)
        .sort((a, b) => toPaise(b.amount) - toPaise(a.amount));
      if (!owed.length) return null;

      const owedTotal = owed.reduce((a, d) => a + toPaise(d.amount), 0);
      const owesTotal = debts
        .filter((d) => d.fromMemberId === m.id)
        .reduce((a, d) => a + toPaise(d.amount), 0);

      return {
        memberId: m.id,
        isSelf: !!m.isSelf,
        name: labelOf(m),
        shortName: m.shortName ?? m.name,
        color: m.color ?? null,
        // Same rule as groupDebtsByDebtor's: "You are owed" vs "Chris is owed".
        verb: m.isSelf && !selfName ? 'are owed' : 'is owed',
        // Who owes them, biggest first.
        owedBy: owed.map((d) => ({
          fromMemberId: d.fromMemberId,
          fromName: labelOf(memberById[d.fromMemberId]),
          amount: d.amount,
        })),
        owedTotal: fromPaise(owedTotal),
        owesTotal: fromPaise(owesTotal),
        net: fromPaise(owedTotal - owesTotal),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.isSelf ? -1 : b.isSelf ? 1 : toPaise(b.owedTotal) - toPaise(a.owedTotal)));
}

// Plain-language arithmetic for one person: what they owe, what's owed to them,
// and the net. A money app shouldn't make someone reverse-engineer why their
// number is ₹1,333.60 and not the ₹1,367.60 their share came to.
// Two voices, chosen by whether `selfName` is supplied:
//
//   OMITTED (in-app)  -> first person. "You pay ₹1,367.60 … and are owed ₹34
//                        back … — ₹1,333.60 out of pocket." The app is talking
//                        to the person reading it, so it should address them.
//   SUPPLIED (exports) -> third person with that name. "Chris pays …". A shared
//                        PDF or WhatsApp message is read by four other people,
//                        for whom "you" means someone else entirely.
//
// Note this differs from groupDebtsByDebtor, which is third person in BOTH
// cases — there the subject is a NAME ("Chris (You) owes 3 people"), and a name
// takes a third-person verb wherever it appears.
export function explainBalances({ members, debts, formatAmount, selfName }) {
  const firstPerson = !selfName;
  const labelOf = (m) => (m?.isSelf ? (selfName ?? 'you') : (m?.shortName ?? m?.name ?? 'someone'));
  const nameOf = (id) => labelOf(members.find((x) => x.id === id));

  return members
    .map((m) => {
      const owes = debts.filter((d) => d.fromMemberId === m.id);
      const owed = debts.filter((d) => d.toMemberId === m.id);
      const owesTotal = owes.reduce((a, d) => a + toPaise(d.amount), 0);
      const owedTotal = owed.reduce((a, d) => a + toPaise(d.amount), 0);
      if (!owesTotal && !owedTotal) return null;

      // "You" capitalised at the head of a sentence; `labelOf`'s lowercase
      // "you" is for mid-sentence use inside the lists below.
      const isMe = !!m.isSelf && firstPerson;
      const who = isMe ? 'You' : labelOf(m);
      const pays = isMe ? 'pay' : 'pays';
      const isOwed = isMe ? 'are owed' : 'is owed';
      const net = owedTotal - owesTotal;
      const list = (ds) =>
        ds
          .map(
            (d) =>
              `${nameOf(d.fromMemberId === m.id ? d.toMemberId : d.fromMemberId)} ${formatAmount(d.amount)}`
          )
          .join(', ');

      // Both directions — the case that actually needed explaining.
      if (owesTotal && owedTotal) {
        return {
          memberId: m.id,
          text:
            `${who} ${pays} ${formatAmount(fromPaise(owesTotal))} (${list(owes)}) ` +
            `and ${isOwed} ${formatAmount(fromPaise(owedTotal))} back (${list(owed)}) — ` +
            `${formatAmount(fromPaise(Math.abs(net)))} ${net < 0 ? 'out of pocket' : 'owed overall'}.`,
        };
      }
      if (owesTotal) {
        return {
          memberId: m.id,
          text: `${who} ${pays} ${formatAmount(fromPaise(owesTotal))} in total (${list(owes)}).`,
        };
      }
      return {
        memberId: m.id,
        text: `${who} ${isOwed} ${formatAmount(fromPaise(owedTotal))} in total (${list(owed)}).`,
      };
    })
    .filter(Boolean);
}

// Which members have already handed money over, but whose share has moved
// since — because an entry was added, edited or deleted after they settled.
//
// This is the visible half of Decision 7: settling never LOCKS a split (the
// commonest reason to edit is that the settlement itself was wrong), so the
// price of staying editable is saying loudly when someone's number changed
// under them. Compares each member's latest settlement against the latest
// change to any entry that touches them.
export function membersChangedAfterSettling({ members, entries, settlements }) {
  const lastSettledAt = {};
  settlements.forEach((s) => {
    [s.fromMemberId, s.toMemberId].forEach((id) => {
      const at = new Date(s.createdAt).getTime();
      if (!lastSettledAt[id] || at > lastSettledAt[id]) lastSettledAt[id] = at;
    });
  });

  const changed = new Set();
  members.forEach((m) => {
    const settledAt = lastSettledAt[m.id];
    if (!settledAt) return;
    const touched = entries.filter(
      (e) => e.payerMemberId === m.id || (e.shares ?? []).some((s) => s.memberId === m.id)
    );
    const moved = touched.some((e) => {
      const stamps = [e.createdAt, e.updatedAt, e.deletedAt]
        .filter(Boolean)
        .map((d) => new Date(d).getTime());
      return stamps.some((t) => t > settledAt);
    });
    if (moved) changed.add(m.id);
  });
  return [...changed];
}

// One place that decides how a payment is worded, so the on-screen rows and
// the shared text can never disagree. Second person for anything involving
// you, third person for everyone else.
export function describePayment(payment, memberById, { formatAmount }) {
  const from = memberById[payment.fromMemberId];
  const to = memberById[payment.toMemberId];
  const amount = formatAmount(payment.amount);

  if (from?.isSelf) {
    return { text: `You owe ${to?.name ?? 'someone'} ${amount}`, involvesMe: true, iAmPayer: true };
  }
  if (to?.isSelf) {
    return { text: `${from?.name ?? 'Someone'} owes you ${amount}`, involvesMe: true, iAmPayer: false };
  }
  return {
    text: `${from?.name ?? 'Someone'} owes ${to?.name ?? 'someone'} ${amount}`,
    involvesMe: false,
    iAmPayer: false,
  };
}

// Plain text for React Native's Share. The whole point of Phase 1's sharing
// (Decision 11): the user is the group's record-keeper, so the output is for
// four people who don't have the app. No markdown, no emoji — this gets pasted
// into WhatsApp and has to read cleanly there.
export function buildSummaryText({
  split,
  members,
  entries,
  balances,
  // No `payments` parameter, deliberately. Greedy fewest-transfer netting is no
  // longer rendered anywhere — its answer is the per-group net line now, and
  // showing both lists meant one pair appeared with two different amounts.
  // suggestPayments stays exported and tested in case that view is wanted again.
  settlements = [],
  directDebts = [],
  // Optional: the caller usually has these already, so accept them rather than
  // recomputing. Falls back to computing when omitted.
  debtGroups,
  creditGroups,
  // Required in practice: see nameOf below.
  selfName,
  formatAmount,
  dateLabel,
  formatDay,
}) {
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  // NOBODY is "you" in this document. It gets pasted into a group chat and read
  // by four other people, for whom "You paid ₹51" is unattributable. The caller
  // passes its own name and every line becomes third person.
  const nameOf = (m) => (m?.isSelf ? (selfName ?? 'You') : (m?.shortName ?? m?.name ?? 'someone'));
  const total = entries.reduce((acc, e) => acc + toPaise(e.amount), 0);
  const perHead = members.length ? Math.round(total / members.length) : 0;

  const lines = [];
  lines.push(`${split.name}${dateLabel ? ` · ${dateLabel}` : ''}`);
  lines.push(
    `Total ${formatAmount(fromPaise(total))} · ${formatAmount(fromPaise(perHead))} each · ` +
      `${members.length} ${members.length === 1 ? 'person' : 'people'}`
  );

  // The itemised list. This is what makes the message checkable by the four
  // people who don't have the app — "total ₹7,070" is a claim, the entry list
  // is the evidence. Each line names who paid and how many ways it split, since
  // an uneven entry is exactly the thing someone will query.
  if (entries.length) {
    lines.push('');
    lines.push('WHAT WE SPENT');
    entries.forEach((e) => {
      const payer = memberById[e.payerMemberId];
      const day = formatDay ? formatDay(e.occurredOn) : e.occurredOn;
      const ways = e.shares.length;
      lines.push(
        `${day} · ${e.description} — ${formatAmount(e.amount)} · ` +
          `${nameOf(payer)} paid · ${ways} ${ways === 1 ? 'way' : 'ways'}`
      );
    });
  }

  lines.push('');
  lines.push('WHO PAID');
  balances
    .filter((b) => toPaise(b.paid) > 0)
    .sort((a, b) => toPaise(b.paid) - toPaise(a.paid))
    .forEach((b) => {
      const m = memberById[b.memberId];
      lines.push(`${nameOf(m)} paid ${formatAmount(b.paid)}`);
    });

  // The full working, not just the collapsed answer. This is a money document
  // going to people who will check it, so it shows every debt traced to its
  // payer AND the arithmetic in words.
  if (directDebts.length) {
    lines.push('');
    lines.push('WHO PAYS WHAT');
    // Grouped by debtor, same as the app: one block per person, each debt
    // listed, a total, and the net where they're owed money back. Far easier to
    // check against your own memory than a flat run of sentences — and it folds
    // in what a separate "fewest payments" list used to say.
    (debtGroups ?? groupDebtsByDebtor({ members, debts: directDebts })).forEach((g) => {
      lines.push('');
      lines.push(`${g.name} ${g.verb} ${formatAmount(g.owesTotal)}`);
      // "to"/"from" prefixes, because plain text has no column headers and a
      // bare name beside an amount doesn't say which way the money moves.
      g.owes.forEach((d) => lines.push(`   to ${d.toName} — ${formatAmount(d.amount)}`));
      // No "also owed" aside — WHO IS OWED below is that fact's proper home.
    });

    // The mirror section — who collects, and from whom. Without it the document
    // only ever answered "what do I pay".
    const credits = creditGroups ?? groupCreditsByCreditor({ members, debts: directDebts, selfName });
    if (credits.length) {
      lines.push('');
      lines.push('WHO IS OWED');
      credits.forEach((c) => {
        lines.push('');
        lines.push(`${c.name} ${c.verb} ${formatAmount(c.owedTotal)}`);
        c.owedBy.forEach((d) => lines.push(`   from ${d.fromName} — ${formatAmount(d.amount)}`));
      });
    }

    // selfName MUST be forwarded — without it this block reverted to "You pays
    // ₹180", which is both unattributable to a reader and ungrammatical.
    const explained = explainBalances({ members, debts: directDebts, formatAmount, selfName });
    if (explained.length) {
      lines.push('');
      lines.push("EACH PERSON'S POSITION");
      explained.forEach((e) => lines.push(e.text));
    }
  }

  if (directDebts.length === 0) {
    lines.push('');
    lines.push('WHO OWES WHOM');
    lines.push('All settled up.');
  }

  // Money that has already changed hands, so nobody is asked twice for it.
  if (settlements.length) {
    lines.push('');
    lines.push('ALREADY SETTLED');
    settlements.forEach((s) => {
      const from = memberById[s.fromMemberId];
      const to = memberById[s.toMemberId];
      const day = formatDay ? formatDay(s.occurredOn) : s.occurredOn;
      lines.push(
        `${day} · ${nameOf(from)} paid ${nameOf(to)} ${formatAmount(s.amount)}`
      );
    });
  }

  return lines.join('\n');
}
