import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { isTransfer, transferLabel } from './transfers';

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
    const account = accounts.find((a) => a.id === tx.account_id);
    const typeLabel = transfer
      ? tx.type === 'transfer_out'
        ? 'Transfer Out'
        : 'Transfer In'
      : tx.type === 'income'
        ? 'Income'
        : 'Expense';
    const categoryLabel = transfer ? transferLabel(tx, accounts) : (tx.category?.name ?? 'Uncategorized');
    return [tx.occurred_at, typeLabel, tx.amount, categoryLabel, account?.name ?? '', tx.plan?.name ?? '', tx.note ?? ''];
  });
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

// Writes to the cache directory and hands off to the OS share sheet — nothing
// persisted beyond the OS's own temp-file lifecycle (Paths.cache is exactly
// "a place to store files that can be deleted by the system when the device
// runs low on storage"). Returns { unsupported: true } rather than throwing
// on a platform/environment with no share sheet, matching this codebase's
// existing convention (e.g. lib/detect.js's unsupported flag).
export async function shareCsv(filename, csv) {
  const available = await Sharing.isAvailableAsync();
  if (!available) return { shared: false, unsupported: true };

  const file = new File(Paths.cache, filename);
  file.write(csv); // synchronous in the current File API — not a Promise
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export transactions' });
  return { shared: true };
}
