// Checks the Quiet Ledger's pure rules (spec 46) with no app and no network:
//
//   node scripts/ledger-check.mjs
//
// Each later redesign ticket adds its own group of cases here. Exits with
// code 1 if any case fails.

import { amountParts } from '../lib/currency.js';
import { dayPeriod } from '../lib/dayScenes.js';
import { CARD_THEMES, resolveEquippedTheme } from '../lib/cardThemes.js';
import { dateGroupKey, dateGroupLabel } from '../lib/dateLabels.js';

let passed = 0;
const failures = [];

function check(group, name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passed++;
  else failures.push({ group, name, got, want });
}

// --- Amounts: the sign rule, the paise rule, en-IN grouping (ticket 01) ---
check('amount', 'income signed is + positive', amountParts(120, { type: 'income', signed: true }), {
  sign: '+',
  tone: 'positive',
  text: '₹120',
});
check('amount', 'expense signed is − in ink', amountParts(120, { type: 'expense', signed: true }), {
  sign: '−',
  tone: 'ink',
  text: '₹120',
});
check('amount', 'negative balance is − in danger', amountParts(-2500.5), {
  sign: '−',
  tone: 'danger',
  text: '₹2,500.50',
});
check('amount', 'unsigned positive has no sign', amountParts(50100), { sign: '', tone: 'ink', text: '₹50,100' });
check('amount', 'whole rupees show no paise', amountParts(1200).text, '₹1,200');
check('amount', 'paise show both digits', amountParts(1367.6).text, '₹1,367.60');
check('amount', 'under a rupee', amountParts(0.5).text, '₹0.50');
check('amount', 'en-IN lakh grouping', amountParts(100000).text, '₹1,00,000');
check('amount', 'float noise is not paise', amountParts(0.1 + 0.2 + 99.7).text, '₹100');
check('amount', 'unknown currency reads as INR', amountParts(1200, { currency: 'XYZ' }).text, '₹1,200');
check('amount', 'garbage value reads as zero', amountParts('abc'), { sign: '', tone: 'ink', text: '₹0' });

// --- Day card (ticket 03) ---
const at = (h, m = 0) => new Date(2026, 10, 10, h, m);
check('day', '4:59 is night', dayPeriod(at(4, 59)), 'night');
check('day', '5:00 is morning', dayPeriod(at(5)), 'morning');
check('day', '12:00 is afternoon', dayPeriod(at(12)), 'afternoon');
check('day', '17:00 is evening', dayPeriod(at(17)), 'evening');
check('day', '20:00 is night', dayPeriod(at(20)), 'night');
check('day', 'stored ink (never chose) shows Day', resolveEquippedTheme('ink', at(9)).id, 'day');
check('day', 'no theme shows Day', resolveEquippedTheme(null, at(9)).id, 'day');
check('day', 'Day follows the clock', resolveEquippedTheme('day', at(21)).period, 'night');
check('day', 'a chosen Ink stays Ink', resolveEquippedTheme('ink-classic', at(9)).name, 'Ink');
check('day', 'an equipped skin wins', resolveEquippedTheme('christmas', at(9)).id, 'christmas');
check('day', 'Day is listed first', CARD_THEMES[0].id, 'day');
check('day', 'the stored-default ink is not listed', CARD_THEMES.some((t) => t.id === 'ink'), false);

// --- Date-group labels on Home's recent activity (ticket 08) ---
const now = new Date(2026, 10, 10, 9, 30); // Tue 10 Nov 2026, 09:30 local
check('dates', 'same day is Today', dateGroupLabel(new Date(2026, 10, 10, 0, 5), now), 'Today');
check('dates', 'the day before is Yesterday', dateGroupLabel(new Date(2026, 10, 9, 23, 59), now), 'Yesterday');
check('dates', 'earlier this year has no year', dateGroupLabel(new Date(2026, 10, 7, 12), now), 'Sat 7 Nov');
check('dates', 'another year shows the year', dateGroupLabel(new Date(2025, 11, 31, 12), now), 'Wed 31 Dec 2025');
check('dates', 'Yesterday across a new year', dateGroupLabel(new Date(2025, 11, 31, 20), new Date(2026, 0, 1, 8)), 'Yesterday');
check('dates', 'the group key is the local date', dateGroupKey(new Date(2026, 10, 10, 0, 5)), '2026-11-10');
// occurred_at is a date-only 'yyyy-MM-dd' string; it must read as that local
// day, not UTC midnight (which is the day before anywhere west of UTC).
check('dates', 'a date-only string keeps its day', dateGroupKey('2026-11-10'), '2026-11-10');
check('dates', 'a date-only string labels as that day', dateGroupLabel('2026-11-09', now), 'Yesterday');

// --- Report ---
for (const f of failures) {
  console.log(`✗ ${f.group}: ${f.name}\n    got  ${JSON.stringify(f.got)}\n    want ${JSON.stringify(f.want)}`);
}
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
