// Checks the Quiet Ledger's pure rules (spec 46) with no app and no network:
//
//   node scripts/ledger-check.mjs
//
// Each later redesign ticket adds its own group of cases here. Exits with
// code 1 if any case fails.

import { amountParts } from '../lib/currency.js';

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

// --- Report ---
for (const f of failures) {
  console.log(`✗ ${f.group}: ${f.name}\n    got  ${JSON.stringify(f.got)}\n    want ${JSON.stringify(f.want)}`);
}
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
