import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { isTransfer, transferLabel } from './transfers';
import { isSettlement, settlementLabel, settlementCsvLabel } from './settlements';

// 11-reports.md Phase 3. expo-file-system@19 rewrote its whole API around
// File/Directory classes — the old string-path functions (writeAsStringAsync
// etc.) still exist as exports but are deprecated stubs that THROW at
// runtime unless imported from 'expo-file-system/legacy' (confirmed by
// reading this installed version's actual type defs, not assumed). Using the
// current File/Paths API here, not the legacy one.

// A field containing a comma, double-quote, or newline must be quoted, with
// internal double-quotes doubled — standard CSV escaping (RFC 4180).
function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// One row per transaction. Amount is exported as a PLAIN number, not
// lib/money.js's formatMoney (which adds a ₹ symbol and thousands commas) —
// a spreadsheet needs a real numeric value to sum/chart; a display string
// would import as text and silently break every formula. Same reasoning for
// occurred_at: the raw yyyy-MM-dd is more useful to a spreadsheet (sortable,
// parseable) than a formatted date. Transfers carry no category, so their
// transferLabel takes that column instead — the same substitution the UI
// itself already makes everywhere a transfer row is shown.
export function buildTransactionsCsv(transactions, accounts) {
  const header = ['Date', 'Type', 'Amount', 'Category', 'Account', 'Plan', 'Note'];
  const rows = transactions.map((tx) => {
    const transfer = isTransfer(tx);
    const settlement = isSettlement(tx);
    const account = accounts.find((a) => a.id === tx.account_id);
    const typeLabel = transfer
      ? tx.type === 'transfer_out'
        ? 'Transfer Out'
        : 'Transfer In'
      : settlement
        ? settlementCsvLabel(tx)
        : tx.type === 'income'
          ? 'Income'
          : 'Expense';
    // Settlements carry no category for the same reason transfers don't — and
    // a settle_in carries none by design (it's excluded from every category
    // total, so asking for one would imply it counted somewhere). The note
    // holds the split name and who it was with, and gets its own column below.
    const categoryLabel = transfer
      ? transferLabel(tx, accounts)
      : settlement
        ? settlementLabel(tx)
        : (tx.category?.name ?? 'Uncategorized');
    return [tx.occurred_at, typeLabel, tx.amount, categoryLabel, account?.name ?? '', tx.plan?.name ?? '', tx.note ?? ''];
  });
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

// A split as a spreadsheet (31-split-expenses.md). Lives here rather than in
// lib/splitMath.js so it can share csvEscape with the transactions export, and
// because CSV is an export concern, not a maths one.
//
// Shape is a MATRIX, deliberately: one row per entry, one column per person
// holding that person's share. That's the layout someone actually checks the
// arithmetic in — you can see at a glance that the zoo ticket has a blank in
// Srijish's column — and it's the thing a plain list of entries can't show.
// Amounts stay raw numbers (no currency symbol) so a spreadsheet parses them
// rather than importing text, same reasoning as buildTransactionsCsv.
//
// Several blocks in one file, separated by blank lines. Excel and Sheets both
// handle that fine, and it keeps the whole split in one attachment.
export function buildSplitCsv({
  split, members, entries, balances, payments,
  settlements = [], directDebts = [], explanations = [],
}) {
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const balanceByMember = Object.fromEntries(balances.map((b) => [b.memberId, b]));
  const total = entries.reduce((sum, e) => sum + Number(e.amount), 0);
  const perHead = members.length ? total / members.length : 0;
  const label = (m) => m?.shortName ?? m?.name ?? '';
  const names = members.map(label);

  const rows = [];
  rows.push([split.name, split.occurredOn]);
  rows.push(['Total', total, 'Per head', Math.round(perHead * 100) / 100, 'People', members.length]);
  rows.push([]);

  rows.push(['ENTRIES']);
  rows.push(['Date', 'Description', 'Amount', 'Paid by', ...names]);
  entries.forEach((e) => {
    const shareOf = Object.fromEntries(e.shares.map((s) => [s.memberId, s.amount]));
    const payer = memberById[e.payerMemberId];
    rows.push([
      e.occurredOn,
      e.description,
      Number(e.amount),
      label(payer),
      // Blank, not 0, for someone who wasn't in this entry at all — a ₹0 share
      // and no share are different facts, and the blank is what makes an uneven
      // entry visible when scanning the column.
      ...members.map((m) => (m.id in shareOf ? Number(shareOf[m.id]) : '')),
    ]);
  });
  rows.push([]);

  rows.push(['BALANCES']);
  rows.push(['Person', 'Paid', 'Their share', 'Settled out', 'Settled in', 'Net']);
  members.forEach((m) => {
    const b = balanceByMember[m.id];
    rows.push([
      label(m),
      Number(b?.paid ?? 0),
      Number(b?.owed ?? 0),
      Number(b?.settledOut ?? 0),
      Number(b?.settledIn ?? 0),
      Number(b?.net ?? 0),
    ]);
  });
  rows.push([]);

  // Every debt traced to its payer, before any netting-down. The full working
  // belongs in a finance export — someone checking this needs to see that
  // Maaz owes Chris ₹17 for the auto Chris fronted, which the fewest-payments
  // block below collapses out of existence.
  rows.push(['WHO OWES WHOM — every debt, traced to whoever paid']);
  rows.push(['From', 'To', 'Amount']);
  if (directDebts.length === 0) {
    rows.push(['All settled up']);
  } else {
    directDebts.forEach((d) => {
      rows.push([label(memberById[d.fromMemberId]), label(memberById[d.toMemberId]), Number(d.amount)]);
    });
  }
  rows.push([]);

  if (explanations.length) {
    rows.push(['HOW THAT WORKS OUT']);
    explanations.forEach((e) => rows.push([e.text]));
    rows.push([]);
  }

  rows.push(['SIMPLEST WAY TO SETTLE — fewest payments, same money']);
  rows.push(['From', 'To', 'Amount']);
  if (payments.length === 0) {
    rows.push(['All settled up']);
  } else {
    payments.forEach((p) => {
      rows.push([
        label(memberById[p.fromMemberId]),
        label(memberById[p.toMemberId]),
        Number(p.amount),
      ]);
    });
  }

  if (settlements.length) {
    rows.push([]);
    rows.push(['ALREADY SETTLED']);
    rows.push(['Date', 'From', 'To', 'Amount', 'Note']);
    settlements.forEach((s) => {
      rows.push([
        s.occurredOn,
        label(memberById[s.fromMemberId]),
        label(memberById[s.toMemberId]),
        Number(s.amount),
        s.note ?? '',
      ]);
    });
  }

  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

// A split as a one-page statement, for the case the CSV doesn't serve: sending
// it to four people who don't have FLO and won't open a spreadsheet on their
// phone. Rendered from HTML by expo-print (bundled in Expo Go — no development
// build, no config plugin, no permission).
//
// Self-contained inline CSS, no webfonts and no images: this has to render the
// same in whatever PDF viewer the recipient happens to have, and a font that
// fails to load would reflow the whole table. System font stack only.
//
// Amounts arrive PRE-FORMATTED via `formatAmount` — unlike the CSV, this is a
// document for humans, so the currency symbol and grouping belong in it.
export function buildSplitHtml({
  split, members, entries, balances, payments,
  settlements = [], directDebts = [], explanations = [],
  formatAmount, formatDay,
}) {
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const balanceByMember = Object.fromEntries(balances.map((b) => [b.memberId, b]));
  const total = entries.reduce((sum, e) => sum + Number(e.amount), 0);
  const perHead = members.length ? total / members.length : 0;
  const nameOf = (id) => memberById[id]?.shortName ?? memberById[id]?.name ?? '—';

  // Everything user-authored goes through this. A split name or note containing
  // "<" would otherwise break the document, and the content is typed by people.
  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const entryRows = entries
    .map((e) => {
      const shareCells = members
        .map((m) => {
          const s = e.shares.find((x) => x.memberId === m.id);
          // Blank, not zero, for someone not in this entry — same reasoning as
          // the CSV: it makes an uneven entry visible at a glance.
          return `<td class="num">${s ? esc(formatAmount(s.amount)) : '<span class="out">–</span>'}</td>`;
        })
        .join('');
      return `<tr>
        <td class="dim">${esc(formatDay ? formatDay(e.occurredOn) : e.occurredOn)}</td>
        <td>${esc(e.description)}</td>
        <td class="num strong">${esc(formatAmount(e.amount))}</td>
        <td>${esc(nameOf(e.payerMemberId))}</td>
        ${shareCells}
      </tr>`;
    })
    .join('');

  const balanceRows = members
    .map((m) => {
      const b = balanceByMember[m.id] ?? {};
      const net = Number(b.net ?? 0);
      return `<tr>
        <td>${esc(m.shortName ?? m.name)}</td>
        <td class="num">${esc(formatAmount(b.paid ?? 0))}</td>
        <td class="num">${esc(formatAmount(b.owed ?? 0))}</td>
        <td class="num strong ${net < 0 ? 'owes' : net > 0 ? 'owed' : ''}">${
          net === 0 ? 'settled' : esc(formatAmount(Math.abs(net))) + (net > 0 ? ' owed' : ' owes')
        }</td>
      </tr>`;
    })
    .join('');

  // The working, shown in full. A PDF of a split is a document people check
  // against each other's memory, so it carries the traced debts and the
  // arithmetic in words, not just the collapsed payment list.
  const debtRows = directDebts.length
    ? directDebts
        .map(
          (d) =>
            `<li><strong>${esc(nameOf(d.fromMemberId))}</strong> owes <strong>${esc(
              nameOf(d.toMemberId)
            )}</strong> ${esc(formatAmount(d.amount))}</li>`
        )
        .join('')
    : '<li>All settled up.</li>';

  const explanationBlock = explanations.length
    ? `<h2>How that works out</h2><ul class="plain">${explanations
        .map((e) => `<li>${esc(e.text)}</li>`)
        .join('')}</ul>`
    : '';

  const paymentRows = payments.length
    ? payments
        .map(
          (p) =>
            `<li><strong>${esc(nameOf(p.fromMemberId))}</strong> pays <strong>${esc(
              nameOf(p.toMemberId)
            )}</strong> ${esc(formatAmount(p.amount))}</li>`
        )
        .join('')
    : '<li>All settled up.</li>';

  const settledBlock = settlements.length
    ? `<h2>Already settled</h2><ul class="plain">${settlements
        .map(
          (s) =>
            `<li>${esc(formatDay ? formatDay(s.occurredOn) : s.occurredOn)} — ${esc(
              nameOf(s.fromMemberId)
            )} paid ${esc(nameOf(s.toMemberId))} ${esc(formatAmount(s.amount))}${
              s.note ? ` <span class="dim">(${esc(s.note)})</span>` : ''
            }</li>`
        )
        .join('')}</ul>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { margin: 28px; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         color: #101010; font-size: 11px; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: -0.3px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px;
       color: #6b6f66; margin: 22px 0 6px; }
  .sub { color: #6b6f66; font-size: 11px; margin: 0 0 4px; }
  .totals { font-size: 13px; font-weight: 700; margin: 6px 0 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #ECEDE7;
           vertical-align: top; }
  th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px;
       color: #6b6f66; border-bottom: 1.5px solid #d8d9d3; }
  .num { text-align: right; white-space: nowrap; }
  .strong { font-weight: 700; }
  .dim { color: #8a8e84; white-space: nowrap; }
  .out { color: #c4c7bd; }
  .owes { color: #B5443D; }
  .owed { color: #4C7031; }
  ul { margin: 0; padding-left: 16px; }
  ul.plain { list-style: none; padding-left: 0; }
  ul li { padding: 3px 0; }
  .foot { margin-top: 26px; color: #b0b3aa; font-size: 9px; }
</style></head><body>
  <h1>${esc(split.name)}</h1>
  <p class="sub">${esc(formatDay ? formatDay(split.occurredOn) : split.occurredOn)} · ${
    members.length
  } ${members.length === 1 ? 'person' : 'people'}</p>
  <p class="totals">${esc(formatAmount(total))} total · ${esc(formatAmount(perHead))} each</p>

  <h2>What we spent</h2>
  <table>
    <thead><tr>
      <th>Date</th><th>Item</th><th class="num">Amount</th><th>Paid by</th>
      ${members.map((m) => `<th class="num">${esc(m.shortName ?? m.name)}</th>`).join('')}
    </tr></thead>
    <tbody>${entryRows || '<tr><td colspan="4">Nothing recorded.</td></tr>'}</tbody>
  </table>

  <h2>Where everyone stands</h2>
  <table>
    <thead><tr><th>Person</th><th class="num">Paid</th><th class="num">Their share</th><th class="num">Net</th></tr></thead>
    <tbody>${balanceRows}</tbody>
  </table>

  <h2>Who owes whom — every debt, traced to whoever paid</h2>
  <ul>${debtRows}</ul>

  ${explanationBlock}

  <h2>Simplest way to settle — fewest payments, same money</h2>
  <ul>${paymentRows}</ul>

  ${settledBlock}

  <p class="foot">Split with FLO</p>
</body></html>`;
}

// Same cache-directory-then-share-sheet approach as shareCsv, and the same
// unsupported-rather-than-throw convention. expo-print writes the PDF itself,
// so there's no File.write here.
export async function sharePdf(html, dialogTitle = 'Export') {
  const available = await Sharing.isAvailableAsync();
  if (!available) return { shared: false, unsupported: true };

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle, UTI: 'com.adobe.pdf' });
  return { shared: true };
}

// Writes to the cache directory and hands off to the OS share sheet — nothing
// persisted beyond the OS's own temp-file lifecycle (Paths.cache is exactly
// "a place to store files that can be deleted by the system when the device
// runs low on storage"). Returns { unsupported: true } rather than throwing
// on a platform/environment with no share sheet, matching this codebase's
// existing convention (e.g. lib/detect.js's unsupported flag).
// `dialogTitle` is a parameter rather than a constant now that splits export
// here too — it defaults to the original wording, so every existing call site
// is unchanged.
export async function shareCsv(filename, csv, dialogTitle = 'Export transactions') {
  const available = await Sharing.isAvailableAsync();
  if (!available) return { shared: false, unsupported: true };

  const file = new File(Paths.cache, filename);
  file.write(csv); // synchronous in the current File API — not a Promise
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle });
  return { shared: true };
}
