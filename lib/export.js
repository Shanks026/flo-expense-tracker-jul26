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
  split, members, entries, balances,
  settlements = [], directDebts = [], explanations = [], debtGroups = [], creditGroups = [],
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

  // Deliberately FLAT here, not grouped like the app and the PDF: a spreadsheet
  // wants one row per fact so it can be sorted, filtered and pivoted. Grouping
  // is a reading aid for a document, and it fights a data file.
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
    rows.push(["EACH PERSON'S POSITION"]);
    explanations.forEach((e) => rows.push([e.text]));
    rows.push([]);
  }

  // No "fewest payments" block: the BALANCES table above already carries each
  // person's Net, which is the same figure, and duplicating it under a second
  // heading meant one pair appearing twice with two different amounts.

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
  split, members, entries, balances,
  settlements = [], directDebts = [], explanations = [], debtGroups = [], creditGroups = [],
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
  // Grouped by debtor, same as the app and the shared text: a block per person,
  // each debt listed, a total, and the net where they're owed money back. That
  // net is what a separate "fewest payments" section used to say, so there
  // isn't one any more.
  const debtRows = debtGroups.length
    ? debtGroups
        .map(
          (g) => `<div class="grp">
            <div class="grph"><span>${esc(g.name)} ${esc(g.verb)} in total</span>
              <strong>${esc(formatAmount(g.owesTotal))}</strong></div>
            <table class="grpt">
              <tr><th>To</th><th class="num">Amount</th></tr>
              ${g.owes
                .map(
                  (d) =>
                    `<tr><td>${esc(d.toName)}</td><td class="num">${esc(formatAmount(d.amount))}</td></tr>`
                )
                .join('')}</table>
          </div>`
        )
        .join('')
    : '<p>All settled up.</p>';

  // The receipt side. Its absence was a real reporting gap: the person owed the
  // most in the whole split had no block of their own, appearing only as rows
  // inside other people's cards.
  const creditRows = creditGroups.length
    ? creditGroups
        .map(
          (c) => `<div class="grp">
            <div class="grph"><span>${esc(c.name)} is owed</span>
              <strong>${esc(formatAmount(c.owedTotal))}</strong></div>
            <table class="grpt">
              <tr><th>From</th><th class="num">Amount</th></tr>
              ${c.owedBy
                .map(
                  (d) =>
                    `<tr><td>${esc(d.fromName)}</td><td class="num">${esc(formatAmount(d.amount))}</td></tr>`
                )
                .join('')}</table>
          </div>`
        )
        .join('')
    : '';

  const explanationBlock = explanations.length
    ? `<h2>Each person&#39;s position</h2><ul class="plain">${explanations
        .map((e) => `<li>${esc(e.text)}</li>`)
        .join('')}</ul>`
    : '';

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
  /* break-after: avoid keeps a heading with the content it introduces. Without
     it, a section whose first block can't fit the remaining page space left the
     HEADING stranded at the bottom of one page and its blocks on the next —
     which reads as "the section is empty", not as a page break. Multi-page is
     fine; an orphaned heading is not. */
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px;
       color: #6b6f66; margin: 22px 0 6px;
       break-after: avoid; page-break-after: avoid; break-inside: avoid; }
  .sub { color: #6b6f66; font-size: 11px; margin: 0 0 4px; }
  .totals { font-size: 13px; font-weight: 700; margin: 6px 0 0; }
  table { width: 100%; border-collapse: collapse; }
  /* Repeat the entries table's column headers on every page it spans — with 13
     entries and one column per person, page 2 is unreadable without them. */
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
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
  /* Never split a single explanation sentence across a page boundary, and never
     leave one line of it stranded. */
  ul li { padding: 3px 0; break-inside: avoid; page-break-inside: avoid;
          orphans: 2; widows: 2; }
  /* One block per debtor. break-inside avoids a group being split across a
     page boundary, which would orphan a total from its rows. */
  .grp { margin: 0 0 10px; padding: 7px 9px; border: 1px solid #ECEDE7;
         border-radius: 6px; break-inside: avoid; page-break-inside: avoid; }
  .grph { display: flex; justify-content: space-between; align-items: baseline;
          font-size: 12px; font-weight: 700; margin-bottom: 3px; }
  .grpt { width: 100%; border-collapse: collapse; }
  .grpt td { border: none; padding: 2px 0; }
  /* Direction labels. Without them a row reading "Srijish  ₹28.67" under
     "Stephin is owed" gets read as Srijish being owed. */
  .grpt th { border: none; padding: 0 0 2px; font-size: 8px; color: #b0b3aa;
             text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }
  .grpn { margin-top: 4px; padding-top: 4px; border-top: 1px solid #ECEDE7;
          color: #6b6f66; font-size: 10px; }
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

  <h2>Who pays what</h2>
  ${debtRows}

  ${creditRows ? '<h2>Who is owed</h2>' : ''}
  ${creditRows}

  ${explanationBlock}

  ${settledBlock}

  <p class="foot">Split with FLO</p>
</body></html>`;
}

// Turns a split's own name into a filename a human would recognise in a
// Downloads list or a WhatsApp attachment — "Mysore Trip (22 Aug 2026).pdf".
//
// Keeps the real capitalisation and spaces: this is a document people receive,
// not a slug. Only characters that are genuinely illegal in a filename are
// stripped (and leading dots, which would hide the file on Unix). Length is
// capped well under the 255-byte limit, since the extension and any
// "(1)" the OS appends on a name clash still have to fit.
export function exportFilename({ name, dateLabel, extension }) {
  const clean = String(name ?? '')
    // The class is: the characters Windows/POSIX actually forbid in a filename,
    // PLUS the control range \x00-\x1f. That trailing `-` is the RANGE operator,
    // not a literal hyphen — hyphens, ampersands and apostrophes are legal and
    // are kept, since they're part of what the user typed ("Goa-2027" survives).
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\:*?"<>| -]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 80);
  const base = clean || 'Split';
  return dateLabel ? `${base} (${dateLabel}).${extension}` : `${base}.${extension}`;
}

// Same cache-directory-then-share-sheet approach as shareCsv, and the same
// unsupported-rather-than-throw convention.
//
// printToFileAsync names the file itself — a random id like
// "a1b2c3d4-....pdf" — and takes no filename option, so the only way to control
// what the recipient sees is to RENAME the file it produced before sharing it.
// That's what File.rename is for (confirmed against this version's own type
// defs, alongside move/copy/delete/exists).
export async function sharePdf(html, filename = 'Split.pdf', dialogTitle = 'Export') {
  const available = await Sharing.isAvailableAsync();
  if (!available) return { shared: false, unsupported: true };

  const { uri } = await Print.printToFileAsync({ html });

  // NO rename(). Two attempts at renaming the print output both failed on
  // device — the second left the file unreadable, so the share sheet opened but
  // WhatsApp could show no preview and could not send. Renaming the file
  // printToFileAsync is holding is simply not safe.
  //
  // COPY to a correctly-named file instead, which is exactly what shareCsv
  // already does successfully on the same device: create a file at
  // Paths.cache/<name> and share that. The original print output is left
  // untouched, so the worst case is a stray cache file, never a broken share.
  let shareUri = uri;
  let namedFallback = false;
  try {
    const target = new File(Paths.cache, filename);
    if (target.exists) target.delete();
    new File(uri).copy(target);
    // Only switch to the copy once it verifiably exists — sharing a path that
    // isn't there is precisely the failure this replaces.
    if (target.exists) shareUri = target.uri;
    else namedFallback = true;
  } catch (error) {
    // Share the generated name rather than nothing, but SAY SO — silently
    // swallowing this is what hid the previous bug for two builds.
    namedFallback = true;
    console.warn('PDF filename fallback:', error?.message ?? error);
  }

  await Sharing.shareAsync(shareUri, {
    mimeType: 'application/pdf',
    dialogTitle,
    UTI: 'com.adobe.pdf',
  });
  return { shared: true, namedFallback };
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
