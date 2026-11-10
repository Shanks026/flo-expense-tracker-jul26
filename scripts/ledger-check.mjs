// Checks the Quiet Ledger's pure rules (spec 46) with no app and no network:
//
//   node scripts/ledger-check.mjs
//
// Each later redesign ticket adds its own group of cases here. Exits with
// code 1 if any case fails.

import { amountParts } from '../lib/currency.js';
import { dayPeriod, DAY_THEMES } from '../lib/dayScenes.js';
import { CARD_THEMES, resolveEquippedTheme } from '../lib/cardThemes.js';
import { dateGroupKey, dateGroupLabel } from '../lib/dateLabels.js';
import { contrastRatio, AA_TEXT, AA_UI } from '../lib/contrast.js';
import { weekChange } from '../lib/weekChange.js';
import { ENTRY_SOURCES, entrySource } from '../lib/entrySource.js';
import { ledgerPalettes } from '../theme/ledgerPalettes.js';

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

// --- Olive accent and income green, WCAG AA (ticket 12) ---
// Each case is a pair the app actually draws; `want` is pass (true) or fail.
const { light: Lc, dark: Dc } = ledgerPalettes;
const passes = (fg, bg, min) => contrastRatio(fg, bg) >= min;
check('wcag', 'light accent is olive', Lc.accent, '#76952B');
check('wcag', 'dark accent is olive', Dc.accent, '#B5CC6A');
check('wcag', 'chart and highlight alias accent', [Lc.chart, Lc.highlight, Dc.chart, Dc.highlight], [Lc.accent, Lc.accent, Dc.accent, Dc.accent]);
check('wcag', 'light olive line on canvas (graphics)', passes(Lc.accent, Lc.canvas, AA_UI), true);
check('wcag', 'light olive line on sunk (graphics)', passes(Lc.accent, Lc.surfaceSunk, AA_UI), true);
check('wcag', 'dark olive line on canvas (graphics)', passes(Dc.accent, Dc.canvas, AA_UI), true);
check('wcag', 'dark olive line on sunk (graphics)', passes(Dc.accent, Dc.surfaceSunk, AA_UI), true);
check('wcag', 'ink on light accentSoft (text)', passes(Lc.ink, Lc.accentSoft, AA_TEXT), true);
check('wcag', 'ink on dark accentSoft (text)', passes(Dc.ink, Dc.accentSoft, AA_TEXT), true);
check('wcag', 'muted on light accentSoft fails, so callouts use ink', passes(Lc.muted, Lc.accentSoft, AA_TEXT), false);
check('wcag', 'light knob on the olive track', passes(Lc.knobOn, Lc.accent, AA_UI), true);
check('wcag', 'dark knob on the olive track', passes(Dc.knobOn, Dc.accent, AA_UI), true);
check('wcag', 'a white knob would fail on the dark olive', passes('#FFFFFF', Dc.accent, AA_UI), false);
check('wcag', 'dark off knob on the sunk track', passes(Dc.knob, Dc.surfaceSunk, AA_UI), true);
check('wcag', 'light income green on canvas (text)', passes(Lc.positive, Lc.canvas, AA_TEXT), true);
check('wcag', 'light income green on sunk (text)', passes(Lc.positive, Lc.surfaceSunk, AA_TEXT), true);
check('wcag', 'dark income green on canvas (text)', passes(Dc.positive, Dc.canvas, AA_TEXT), true);
check('wcag', 'dark income green on surface (text)', passes(Dc.positive, Dc.surface, AA_TEXT), true);
// Income and the olive must not read as the same colour: at least 1.3:1
// apart in lightness on top of the hue gap (the old green was 1.09 / 1.05).
check('wcag', 'light income stands apart from the olive', contrastRatio(Lc.positive, Lc.accent) >= 1.3, true);
check('wcag', 'dark income stands apart from the olive', contrastRatio(Dc.positive, Dc.accent) >= 1.3, true);

// --- Day card images: the account name reads on each top-left sky ---
for (const [period, t] of Object.entries(DAY_THEMES)) {
  check('day', `${period} is an image`, [t.background.type, t.background.image], ['image', period]);
  check('day', `${period} name passes AA on its sky`, contrastRatio(t.textColor, t.background.color) >= AA_TEXT, true);
}

// --- Home's Last 7 days row: change vs the 7 days before ---
check('week', 'up 12% is red and up', weekChange(1120, 1000), { direction: 'up', tone: 'danger', text: '12%', label: '12% more than the 7 days before' });
check('week', 'down 8% is green and down', weekChange(920, 1000), { direction: 'down', tone: 'positive', text: '8%', label: '8% less than the 7 days before' });
check('week', 'under 5% is flat and grey', weekChange(1040, 1000), { direction: 'flat', tone: 'muted', text: 'About the same', label: 'About the same as the 7 days before' });
check('week', '-4.6% rounds to 5, so it counts', weekChange(954, 1000).direction, 'down');
check('week', 'nothing before means no change shown', weekChange(500, 0), null);
check('week', 'a tiny week before means no change shown', weekChange(5000, 99), null);
check('week', 'the floor itself counts', weekChange(200, 100).text, '100%');
check('week', 'nothing this week is down 100%', weekChange(0, 1000).text, '100%');
check('week', 'huge jumps are capped', weekChange(500000, 100).text, '999%+');
check('week', 'garbage reads as no change shown', weekChange('abc', undefined), null);

// --- Where an entry came from: the Add sheet's draft → transactions.source (ticket 07) ---
check('source', 'the nine allowed values', ENTRY_SOURCES, ['manual', 'quick_add', 'voice', 'ai', 'share', 'auto_detect', 'bill', 'split', 'transfer']);
check('source', 'a plain open is manual', entrySource({}), 'manual');
check('source', 'onboarding is manual', entrySource({ source: 'onboarding' }), 'manual');
check('source', 'typed quick add (phone parser)', entrySource({ source: 'quick_local' }), 'quick_add');
check('source', 'typed quick add (model)', entrySource({ source: 'quick_ai' }), 'quick_add');
check('source', 'spoken quick add is voice', entrySource({ source: 'quick_local', spoken: true }), 'voice');
check('source', 'spoken, read by the model, is voice', entrySource({ source: 'quick_ai', spoken: true }), 'voice');
check('source', 'spoken means nothing without a parse', entrySource({ source: 'manual', spoken: true }), 'manual');
check('source', 'an Ask FLO proposal is ai', entrySource({ source: 'assistant' }), 'ai');
check('source', 'share to FLO is share', entrySource({ source: 'share' }), 'share');
check('source', 'an origin wins', entrySource({ source: 'manual', origin: 'auto_detect' }), 'auto_detect');
check('source', 'an unknown origin is ignored', entrySource({ source: 'share', origin: 'telepathy' }), 'share');

// --- Report ---
for (const f of failures) {
  console.log(`✗ ${f.group}: ${f.name}\n    got  ${JSON.stringify(f.got)}\n    want ${JSON.stringify(f.want)}`);
}
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
