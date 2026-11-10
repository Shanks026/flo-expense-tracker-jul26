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
import { sourceLabel, buildHistory } from '../lib/entryDetail.js';
import { progressState } from '../lib/progressState.js';
import { filterActivity, summarizeActivity, pairTransfers, groupEntries, activityRange, rangeLabel, transferTitle, DEFAULT_FILTERS, isDefaultFilters, ymd, dateFromYmd, fullDayLabel } from '../lib/activity.js';
import { ledgerPalettes } from '../theme/ledgerPalettes.js';
import { planAccounts, cleanAccountName, setupProgress, SETUP_QUESTIONS, cleanLimitAmount, planLimit, findLimitBudget, LIMIT_BUDGET_NAME } from '../lib/setupPlan.js';

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

// --- ProgressBar: fill width and colour (ticket 06) ---
check('progress', '40% is accent', progressState(0.4), { tone: 'accent', fill: 0.4, pct: 40 });
check('progress', '80% exactly is still accent', progressState(0.8).tone, 'accent');
check('progress', 'just past 80% is warn', progressState(0.81).tone, 'warn');
check('progress', '85% is warn', progressState(0.85), { tone: 'warn', fill: 0.85, pct: 85 });
check('progress', '99% is still warn', progressState(0.99).tone, 'warn');
check('progress', '100% exactly is danger', progressState(1), { tone: 'danger', fill: 1, pct: 100 });
check('progress', '120% is danger, bar full', progressState(1.2), { tone: 'danger', fill: 1, pct: 120 });
check('progress', 'nothing spent is an empty accent bar', progressState(0), { tone: 'accent', fill: 0, pct: 0 });
// The fill on its sunk track, as graphics (3:1). Accent on sunk is in the wcag group.
for (const [mode, pal] of [['light', Lc], ['dark', Dc]]) {
  check('progress', `${mode} warn fill on the sunk track`, passes(pal.warn, pal.surfaceSunk, AA_UI), true);
  check('progress', `${mode} danger fill on the sunk track`, passes(pal.danger, pal.surfaceSunk, AA_UI), true);
}
check('progress', 'negative reads as empty', progressState(-0.3), { tone: 'accent', fill: 0, pct: 0 });
check('progress', 'garbage reads as empty', progressState('abc'), { tone: 'accent', fill: 0, pct: 0 });

// --- Activity: filter, summary, transfer pairing, ranges (ticket 10) ---
{
  const food = { id: 'c-food', name: 'Food & Dining' };
  const salary = { id: 'c-sal', name: 'Salary' };
  const accts = [{ id: 'p', name: 'Personal' }, { id: 's', name: 'Savings' }];
  const tea = { id: 't1', type: 'expense', amount: 120, note: 'Chai at Ravi', category_id: 'c-food', category: food, account_id: 'p', occurred_at: '2026-11-10' };
  const rent = { id: 't2', type: 'expense', amount: 1200, note: null, category_id: 'c-food', category: food, account_id: 'p', occurred_at: '2026-11-09' };
  const odd = { id: 't3', type: 'expense', amount: 1367.6, note: 'Room 4', category_id: null, category: null, account_id: 'p', occurred_at: '2026-11-09' };
  const pay = { id: 't4', type: 'income', amount: 50000, note: 'Nov pay', category_id: 'c-sal', category: salary, account_id: 'p', occurred_at: '2026-11-01' };
  const out = { id: 't5', type: 'transfer_out', amount: 2000, note: null, transfer_id: 'x1', account_id: 'p', transfer_account_id: 's', occurred_at: '2026-11-08' };
  const inn = { id: 't6', type: 'transfer_in', amount: 2000, note: null, transfer_id: 'x1', account_id: 's', transfer_account_id: 'p', occurred_at: '2026-11-08' };
  const settle = { id: 't7', type: 'settle_in', amount: 300, note: 'Asha paid back', category_id: null, category: null, account_id: 'p', occurred_at: '2026-11-07' };
  const all = [tea, rent, odd, pay, out, inn, settle];
  const ids = (list) => list.map((t) => t.id);
  const f = (over) => ({ ...DEFAULT_FILTERS, ...over });

  check('activity', 'no filter keeps everything', ids(filterActivity(all, f({}))), ids(all));
  check('activity', 'search a note, any case', ids(filterActivity(all, f({ search: 'chai' }))), ['t1']);
  check('activity', 'search a category name', ids(filterActivity(all, f({ search: 'dining' }))), ['t1', 't2']);
  check('activity', 'search an amount matches as a prefix', ids(filterActivity(all, f({ search: '120' }))), ['t1', 't2']);
  check('activity', 'grouping commas in the query are ignored', ids(filterActivity(all, f({ search: '1,200' }))), ['t2']);
  check('activity', 'paise in the query', ids(filterActivity(all, f({ search: '1367.6' }))), ['t3']);
  check('activity', 'an amount query also matches a note', ids(filterActivity(all, f({ search: '4' }))), ['t3']);
  check('activity', 'a rupee sign is fine', ids(filterActivity(all, f({ search: '₹50' }))), ['t4']);
  check('activity', 'spaces around the query are ignored', ids(filterActivity(all, f({ search: '  nov PAY ' }))), ['t4']);
  check('activity', 'no match is empty', filterActivity(all, f({ search: 'zzz' })), []);
  check('activity', 'type expense', ids(filterActivity(all, f({ type: 'expense' }))), ['t1', 't2', 't3']);
  check('activity', 'type income leaves out a settlement', ids(filterActivity(all, f({ type: 'income' }))), ['t4']);
  check('activity', 'type transfer keeps both legs', ids(filterActivity(all, f({ type: 'transfer' }))), ['t5', 't6']);
  check('activity', 'category filter', ids(filterActivity(all, f({ categoryId: 'c-sal' }))), ['t4']);
  check('activity', 'category and search together', ids(filterActivity(all, f({ categoryId: 'c-food', search: '1200' }))), ['t2']);

  check('activity', 'summary leaves out transfers and settlements', summarizeActivity(all), { spent: 2687.6, received: 50000 });
  check('activity', 'summary of nothing', summarizeActivity([]), { spent: 0, received: 0 });
  check('activity', 'a settle_out is not spending', summarizeActivity([{ type: 'settle_out', amount: 500 }, { type: 'expense', amount: 20 }]), { spent: 20, received: 0 });
  check('activity', 'summary has no float noise', summarizeActivity([{ type: 'expense', amount: 0.1 }, { type: 'expense', amount: 0.2 }]).spent, 0.3);

  const paired = pairTransfers(all);
  check('activity', 'two legs become one row', paired.map((e) => e.key), ['t1', 't2', 't3', 't4', 'x1', 't7']);
  check(
    'activity',
    'the pair reads from → to',
    (({ kind, fromAccountId, toAccountId, legs }) => ({ kind, fromAccountId, toAccountId, legs }))(paired[4]),
    { kind: 'transfer', fromAccountId: 'p', toAccountId: 's', legs: 2 }
  );
  check('activity', 'the pair keeps the out leg', paired[4].tx.id, 't5');
  const lone = pairTransfers([tea, inn]);
  check('activity', 'one leg in view is one ⇄ row', lone.map((e) => [e.kind, e.key, e.legs]), [['tx', 't1', undefined], ['transfer', 'x1', 1]]);
  check('activity', 'an in leg still reads from → to', [lone[1].fromAccountId, lone[1].toAccountId], ['p', 's']);
  check('activity', 'title names both accounts', transferTitle(paired[4], accts), 'Personal → Savings');
  check('activity', 'a deleted account reads as one', transferTitle({ fromAccountId: 'p', toAccountId: null }, accts), 'Personal → Deleted account');
  check('activity', 'a leg with no transfer id stays a row', pairTransfers([{ ...out, transfer_id: null }]).map((e) => e.key), ['t5']);

  const groups = groupEntries(paired);
  check('activity', 'grouped by day, in list order', groups.map((g) => [g.key, g.items.length]), [['2026-11-10', 1], ['2026-11-09', 2], ['2026-11-01', 1], ['2026-11-08', 1], ['2026-11-07', 1]]);

  const today = new Date(2026, 10, 10);
  check('activity', 'this month', activityRange({ preset: 'this_month' }, today), { from: '2026-11-01', to: '2026-11-30' });
  check('activity', 'last month', activityRange({ preset: 'last_month' }, today), { from: '2026-10-01', to: '2026-10-31' });
  check('activity', 'last month across a year', activityRange({ preset: 'last_month' }, new Date(2026, 0, 5)), { from: '2025-12-01', to: '2025-12-31' });
  check('activity', 'last 30 days includes today', activityRange({ preset: 'last_30' }, today), { from: '2026-10-12', to: '2026-11-10' });
  check('activity', 'custom passes through', activityRange({ preset: 'custom', from: '2026-09-01', to: '2026-09-15' }, today), { from: '2026-09-01', to: '2026-09-15' });
  check('activity', 'custom the wrong way round is swapped', activityRange({ preset: 'custom', from: '2026-09-15', to: '2026-09-01' }, today), { from: '2026-09-01', to: '2026-09-15' });
  check('activity', 'range labels', ['this_month', 'last_month', 'last_30'].map((preset) => rangeLabel({ preset }, today)), ['This month', 'Last month', 'Last 30 days']);
  check('activity', 'custom label', rangeLabel({ preset: 'custom', from: '2026-09-01', to: '2026-09-15' }, today), '1 Sep – 15 Sep');
  check('activity', 'custom label in another year', rangeLabel({ preset: 'custom', from: '2025-12-20', to: '2026-01-04' }, today), '20 Dec 2025 – 4 Jan');
  check('activity', 'a day round-trips', ymd(dateFromYmd('2026-03-09')), '2026-03-09');
  check('activity', 'full day label', fullDayLabel('2026-10-01'), '1 Oct 2026');
  check('activity', 'defaults are default', isDefaultFilters(DEFAULT_FILTERS), true);
  check('activity', 'a search is not default', isDefaultFilters(f({ search: 'tea' })), false);
  check('activity', 'whitespace search is still default', isDefaultFilters(f({ search: '  ' })), true);
  check('activity', 'a picked account is not default', isDefaultFilters(f({ accountId: 'all' })), false);
}

// --- Transaction detail: source labels and History (ticket 11) ---
{
  const want = {
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
  check('detail', 'every allowed source has a label', ENTRY_SOURCES.map((s) => sourceLabel(s)), ENTRY_SOURCES.map((s) => want[s]));
  check('detail', 'no source is no label', sourceLabel(null), null);
  check('detail', 'an unknown source is no label', sourceLabel('telepathy'), null);

  const created = '2026-11-01T10:00:00Z';
  const base = { id: 'a', source: 'voice', created_at: created, updated_at: null };
  const steps = (h) => h.map((s) => [s.key, s.title, s.sub ?? null, s.at]);

  check('detail', 'never edited is one step', steps(buildHistory(base)), [['created', 'Created', 'Voice', created]]);
  check('detail', 'no source, no sub on Created', buildHistory({ ...base, source: null })[0].sub ?? null, null);
  check('detail', 'edited is two steps', steps(buildHistory({ ...base, updated_at: '2026-11-03T09:00:00Z' })), [
    ['created', 'Created', 'Voice', created],
    ['edited', 'Edited', null, '2026-11-03T09:00:00Z'],
  ]);
  const split = { created_at: '2026-11-02T12:00:00Z', split: { id: 's1', name: 'Goa trip' } };
  check('detail', 'split-linked and edited is three steps, oldest first', steps(buildHistory({ ...base, updated_at: '2026-11-03T09:00:00Z' }, split)).map((s) => s[0]), ['created', 'split', 'edited']);
  check('detail', 'the split step names the split', buildHistory(base, split)[1].title, 'Added to Goa trip');
  check('detail', 'a split added before an edit sorts by time', buildHistory({ ...base, updated_at: '2026-11-01T11:00:00Z' }, split).map((s) => s.key), ['created', 'edited', 'split']);
  check('detail', 'a split with no name still reads', buildHistory(base, { created_at: '2026-11-02T12:00:00Z', split: null })[1].title, 'Added to a split');
  check('detail', 'an edit stamp no later than creation is not an edit', buildHistory({ ...base, updated_at: created }).length, 1);
}

// Disabled buttons (ticket 11): muted text on the sunk fill, as graphics (3:1).
check('wcag', 'light disabled button text', passes(Lc.muted, Lc.surfaceSunk, AA_UI), true);
check('wcag', 'dark disabled button text', passes(Dc.muted, Dc.surfaceSunk, AA_UI), true);

// --- Set-up planner, accounts (spec 47, onboarding ticket 04) ---
{
  const palette = ['#A', '#B', '#C', '#D'];
  const personal = { id: 'p', name: 'Personal', color: '#A' };
  const plan = (picks, existing = [personal], opts = {}) => planAccounts({ picks, existing, palette, ...opts });

  check('setup', 'no picks is no plan', plan([]), null);
  check('setup', 'one pick renames Personal and makes it active', plan(['SBI']), {
    rename: { id: 'p', name: 'SBI' },
    create: [],
    active: { id: 'p' },
  });
  check('setup', 'three picks are a rename plus two creates, colours skip the used one', plan(['SBI', 'Cash', 'HDFC']), {
    rename: { id: 'p', name: 'SBI' },
    create: [
      { name: 'Cash', color: '#B' },
      { name: 'HDFC', color: '#C' },
    ],
    active: { id: 'p' },
  });
  const renamed = { id: 'p', name: 'SBI', color: '#A' };
  check('setup', 'an already-renamed Personal is not renamed again', plan(['Cash'], [renamed]), {
    rename: null,
    create: [{ name: 'Cash', color: '#B' }],
    active: { create: 0 },
  });
  const second = { id: 'q', name: 'Savings', color: '#C' };
  check('setup', 'a second account already there means no rename', plan(['SBI'], [personal, second]), {
    rename: null,
    create: [{ name: 'SBI', color: '#B' }],
    active: { create: 0 },
  });
  check('setup', 'Back then Next with the same picks writes nothing new', plan(['SBI', 'Cash'], [renamed, { id: 'c', name: 'Cash', color: '#B' }]), {
    rename: null,
    create: [],
    active: { id: 'p' },
  });
  check('setup', 'names already there, in any case, are not created twice', plan(['cash', 'Cash', 'CASH'], [renamed, { id: 'c', name: 'Cash', color: '#B' }]), {
    rename: null,
    create: [],
    active: { id: 'c' },
  });
  check('setup', 'duplicate picks collapse to the first spelling', plan(['SBI', 'sbi', 'Cash']).create.map((a) => a.name), ['Cash']);
  check('setup', 'picking Personal itself keeps it as it is', plan(['personal', 'Cash']), {
    rename: null,
    create: [{ name: 'Cash', color: '#B' }],
    active: { id: 'p' },
  });
  check('setup', 'colour comparison ignores case', plan(['SBI', 'Cash'], [{ id: 'p', name: 'Personal', color: '#a' }]).create[0].color, '#B');
  check('setup', 'a full palette wraps to the start', plan(['SBI', 'A', 'B', 'C', 'D']).create.map((a) => a.color), ['#B', '#C', '#D', '#A']);
  check('setup', 'without room for more accounts only the rename applies', plan(['SBI', 'Cash'], [personal], { canAddMore: false }), {
    rename: { id: 'p', name: 'SBI' },
    create: [],
    active: { id: 'p' },
  });
  check('setup', 'without room and nothing to rename there is no plan', plan(['Cash'], [renamed], { canAddMore: false }), null);
  check('setup', 'picks are trimmed', plan(['  SBI  ']).rename.name, 'SBI');
  check('setup', 'blank picks are dropped', plan(['   ', '']), null);

  check('setup', 'a custom name is trimmed', cleanAccountName('  Paytm  '), 'Paytm');
  check('setup', 'inner runs of spaces collapse', cleanAccountName('Bank   of  Baroda'), 'Bank of Baroda');
  check('setup', 'a blank custom name is none', cleanAccountName('   '), null);
  check('setup', '30 characters is allowed', cleanAccountName('x'.repeat(30)), 'x'.repeat(30));
  check('setup', '31 characters is none', cleanAccountName('x'.repeat(31)), null);
  check('setup', 'a non-string is none', cleanAccountName(undefined), null);
}

// --- Set-up planner, monthly limit (spec 47, onboarding ticket 07) ---
check('limit', '₹0 is no limit', cleanLimitAmount('0'), null);
check('limit', 'blank is no limit', cleanLimitAmount(''), null);
check('limit', 'spaces are no limit', cleanLimitAmount('   '), null);
check('limit', 'garbage is no limit', cleanLimitAmount('abc'), null);
check('limit', 'two decimal points is no limit', cleanLimitAmount('1.2.3'), null);
check('limit', 'a negative is no limit', cleanLimitAmount('-500'), null);
check('limit', 'under ₹1 is no limit', cleanLimitAmount('0.99'), null);
check('limit', '₹1 is the least limit', cleanLimitAmount('1'), 1);
check('limit', '₹5000 is 5000', cleanLimitAmount('5000'), 5000);
check('limit', '₹1,234.50 is 1234.5', cleanLimitAmount('₹1,234.50'), 1234.5);
check('limit', 'Indian grouping is read', cleanLimitAmount('1,00,000'), 100000);
check('limit', 'a trailing point is whole rupees', cleanLimitAmount('5000.'), 5000);
check('limit', 'more than two decimals rounds to paise', cleanLimitAmount('10.005'), 10.01);
check('limit', 'the largest amount the column holds', cleanLimitAmount('9999999999.99'), 9999999999.99);
check('limit', 'past what the column holds is no limit', cleanLimitAmount('10000000000'), null);
check('limit', 'a non-string is no limit', cleanLimitAmount(undefined), null);
{
  const fields = (amount) => ({ name: LIMIT_BUDGET_NAME, amount, period_type: 'calendar_month', category_id: null, start_date: null, end_date: null });
  const limit = { id: 'b1', name: 'Monthly limit', amount: 5000, period_type: 'calendar_month', category_id: null };
  check('limit', 'the limit is found among other budgets', findLimitBudget([{ ...limit, id: 'x', category_id: 'food' }, limit]).id, 'b1');
  check('limit', 'no budgets means no limit', findLimitBudget(undefined), null);
  check('limit', 'no amount is no plan', planLimit({ amount: null, budgets: [] }), null);
  check('limit', 'a first limit is created as an overall monthly budget', planLimit({ amount: 5000, budgets: [] }), { create: fields(5000) });
  check('limit', 'Back and a new amount updates the same budget', planLimit({ amount: 6000, budgets: [limit] }), { update: { id: 'b1', fields: fields(6000) } });
  check('limit', 'Back and the same amount writes nothing', planLimit({ amount: 5000, budgets: [limit] }), null);
  const saved = { id: 'b1', amount: 5000, account_id: 'acc1' };
  check('limit', 'the saved limit is updated even when the search misses it', planLimit({ amount: 6000, budgets: [], saved, accountId: 'acc1' }), { update: { id: 'b1', fields: fields(6000) } });
  check('limit', 'the saved limit and the same amount writes nothing', planLimit({ amount: 5000, budgets: [], saved, accountId: 'acc1' }), null);
  check('limit', 'a changed active account moves the saved limit', planLimit({ amount: 5000, budgets: [], saved, accountId: 'acc2' }), { update: { id: 'b1', fields: { ...fields(5000), account_id: 'acc2' } } });
  check('limit', 'a category budget is not the limit', planLimit({ amount: 5000, budgets: [{ ...limit, category_id: 'food' }] }), { create: fields(5000) });
  check('limit', 'a weekly budget is not the limit', planLimit({ amount: 5000, budgets: [{ ...limit, period_type: 'calendar_week' }] }), { create: fields(5000) });
  check('limit', 'an overall budget with another name is not the limit', planLimit({ amount: 5000, budgets: [{ ...limit, name: 'Monthly' }] }), { create: fields(5000) });
}

// --- Set-up progress (spec 47, onboarding ticket 04) ---
check('progress', 'four questions with themes on', SETUP_QUESTIONS.map((q) => q), ['accounts', 'month_start', 'budget', 'card']);
check('progress', 'accounts is 1 of 4', setupProgress('accounts'), { label: '1 of 4', value: 0.25 });
check('progress', 'month start is 2 of 4', setupProgress('month_start'), { label: '2 of 4', value: 0.5 });
check('progress', 'budget is 3 of 4', setupProgress('budget'), { label: '3 of 4', value: 0.75 });
check('progress', 'card is 4 of 4', setupProgress('card'), { label: '4 of 4', value: 1 });
check('progress', 'themes off: budget is 3 of 3', setupProgress('budget', { themes: false }), { label: '3 of 3', value: 1 });
check('progress', 'themes off: accounts is 1 of 3', setupProgress('accounts', { themes: false }), { label: '1 of 3', value: 1 / 3 });
check('progress', 'themes off: card is not a question', setupProgress('card', { themes: false }), null);
check('progress', 'a step that is not a question has no progress', setupProgress('first_expense'), null);

// --- Report ---
for (const f of failures) {
  console.log(`✗ ${f.group}: ${f.name}\n    got  ${JSON.stringify(f.got)}\n    want ${JSON.stringify(f.want)}`);
}
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
