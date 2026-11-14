// Checks the Quiet Ledger's pure rules (spec 46) with no app and no network:
//
//   node scripts/ledger-check.mjs
//
// Each later redesign ticket adds its own group of cases here. Exits with
// code 1 if any case fails.

import { amountParts } from '../lib/currency.js';
import { dayPeriod, DAY_THEMES } from '../lib/dayScenes.js';
import { CARD_THEMES, resolveEquippedTheme, getTheme, cardTextColor, cardBaseColors, cardTextShadow } from '../lib/cardThemes.js';
import { dateGroupKey, dateGroupLabel } from '../lib/dateLabels.js';
import { contrastRatio, AA_TEXT, AA_UI } from '../lib/contrast.js';
import { weekChange } from '../lib/weekChange.js';
import { ENTRY_SOURCES, entrySource } from '../lib/entrySource.js';
import { sourceLabel, buildHistory } from '../lib/entryDetail.js';
import { progressState } from '../lib/progressState.js';
import { filterActivity, summarizeActivity, pairTransfers, groupEntries, activityRange, rangeLabel, transferTitle, DEFAULT_FILTERS, isDefaultFilters, filtersFromLink, ymd, dateFromYmd, fullDayLabel } from '../lib/activity.js';
import { ledgerPalettes } from '../theme/ledgerPalettes.js';
import { timeOnToday, timeOnTodayFromString, toTimeColumn, isEveningTime } from '../lib/reminderTime.js';
import { resetPeriodStart, resetPeriodPhrase, periodFromProfile, ordinalDay } from '../lib/periods.js';
import { passwordRules, passwordPasses, looksLikeEmail, PASSWORD_MIN, authErrorLine } from '../lib/authRules.js';
import { spendHeadline, spendAxis, axisLabel, categoryChange, priorRange } from '../lib/insights.js';
import { budgetRowStatus } from '../lib/budgetRow.js';
import { groupBills, billLine, billTerms } from '../lib/billGroups.js';
import { billTimeline } from '../lib/billTimeline.js';
import { BILL_ICON_KEYS, iconForBillName, billIconKey } from '../lib/billIcons.js';
import { cleanLast4, maskedLast4, accountSub, LAST4_ERROR } from '../lib/accountLast4.js';
import { splitNetText } from '../lib/splitNet.js';
import { celebrationFor } from '../lib/celebrations.js';
import { readFileSync } from 'node:fs';
import { planMonthStart, monthStartFromProfile, MONTH_START_CHOICES, planAccounts, cleanAccountName, setupProgress, SETUP_QUESTIONS, cleanLimitAmount, planLimit, findLimitBudget, LIMIT_BUDGET_NAME, cardChoices } from '../lib/setupPlan.js';

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

// --- Set-up planner, card (spec 47, onboarding ticket 08) ---
{
  const t = (id, tier) => ({ id, tier });
  const ids = (list) => list.map((x) => x.id);
  check('card', 'Day first, seasonal next, then catalog order', ids(cardChoices([t('ink-classic', 'free'), t('dusk', 'common'), t('christmas', 'seasonal'), t('day', 'free'), t('diwali', 'seasonal')])), ['day', 'christmas', 'diwali', 'ink-classic', 'dusk']);
  check('card', 'no seasonal skins: Day then the rest', ids(cardChoices([t('ink-classic', 'free'), t('day', 'free'), t('dusk', 'common')])), ['day', 'ink-classic', 'dusk']);
  check('card', 'the legacy Ink is never offered', ids(cardChoices([t('day', 'free'), { id: 'ink', tier: 'free', legacy: true }, t('ink-classic', 'free')])), ['day', 'ink-classic']);
  check('card', 'an empty catalog is empty', cardChoices([]), []);
  const real = ids(cardChoices(CARD_THEMES));
  check('card', 'the real catalog starts with Day', real[0], 'day');
  check('card', 'the real catalog offers Ink as ink-classic and Dusk', real.includes('ink-classic') && real.includes('dusk') && !real.includes('ink'), true);
  check('card', 'the real catalog keeps every listed theme', real.length, CARD_THEMES.length);
}

// --- Reminder time (spec 47, onboarding ticket 09) ---
{
  const now = new Date(2026, 10, 11, 9, 15, 42);
  const nine = timeOnToday(21, 0, now);
  check('reminder', 'the picker value is built on today, not 1899', [nine.getFullYear(), nine.getMonth(), nine.getDate()], [2026, 10, 11]);
  check('reminder', 'the picker value is 21:00:00.000', [nine.getHours(), nine.getMinutes(), nine.getSeconds(), nine.getMilliseconds()], [21, 0, 0, 0]);
  const parsed = timeOnTodayFromString('20:30:00', 21, 0, now);
  check('reminder', 'a stored time reads back', [parsed.getHours(), parsed.getMinutes(), parsed.getDate()], [20, 30, 11]);
  check('reminder', 'no stored time is the fallback', timeOnTodayFromString(null, 21, 0, now).getHours(), 21);
  check('reminder', 'a broken stored time is the fallback', timeOnTodayFromString('later', 21, 0, now).getHours(), 21);
  check('reminder', '8:30 pm saves 20:30:00', toTimeColumn(new Date(2026, 10, 11, 20, 30, 59)), '20:30:00');
  check('reminder', 'early hours pad to two digits', toTimeColumn(new Date(2026, 10, 11, 7, 5)), '07:05:00');
  check('reminder', '12:00 is an evening time', isEveningTime(new Date(2026, 10, 11, 12, 0)), true);
  check('reminder', '11:59 is not an evening time', isEveningTime(new Date(2026, 10, 11, 11, 59)), false);
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

// --- Salary-day month (spec 47, onboarding ticket 05) ---
{
  const salary = (day) => ({ resetPeriod: 'salary_day', monthDay: day });
  const at = (y, m, d) => new Date(y, m - 1, d, 15, 0);
  check('salary day', 'mid-month starts this month', resetPeriodStart(salary(10), at(2026, 11, 20)), '2026-11-10');
  check('salary day', 'on the day starts today', resetPeriodStart(salary(25), at(2026, 10, 25)), '2026-10-25');
  check('salary day', 'the day before is still last month', resetPeriodStart(salary(25), at(2026, 11, 24)), '2026-10-25');
  check('salary day', 'the 31st in a 30-day month is its last day', resetPeriodStart(salary(31), at(2026, 4, 30)), '2026-04-30');
  check('salary day', 'the 31st before a 30-day month ends reaches back', resetPeriodStart(salary(31), at(2026, 4, 29)), '2026-03-31');
  check('salary day', 'the 30th in February (non-leap) is 28 Feb', resetPeriodStart(salary(30), at(2026, 2, 28)), '2026-02-28');
  check('salary day', 'the 31st in February (leap) is 29 Feb', resetPeriodStart(salary(31), at(2028, 2, 29)), '2028-02-29');
  check('salary day', 'the 30th on 28 Feb of a leap year is still January', resetPeriodStart(salary(30), at(2028, 2, 28)), '2028-01-30');
  check('salary day', 'early March after a short February', resetPeriodStart(salary(30), at(2026, 3, 1)), '2026-02-28');
  check('salary day', 'across a year boundary', resetPeriodStart(salary(25), at(2027, 1, 5)), '2026-12-25');
  check('salary day', 'the 1st is the calendar month', resetPeriodStart(salary(1), at(2026, 11, 11)), '2026-11-01');
  check('salary day', 'no day falls back to the calendar month', resetPeriodStart(salary(null), at(2026, 11, 11)), '2026-11-01');
  check('salary day', 'a day out of range falls back', resetPeriodStart(salary(32), at(2026, 11, 11)), '2026-11-01');
  check('salary day', 'the phrase', resetPeriodPhrase(salary(25), at(2026, 11, 11)), 'since 25 Oct');
  check('salary day', 'the phrase on the day', resetPeriodPhrase(salary(11), at(2026, 11, 11)), 'since 11 Nov');
  check('salary day', 'the phrase follows the fetched start', resetPeriodPhrase({ ...salary(25), since: '2026-10-25' }, at(2026, 11, 26)), 'since 25 Oct');
  check('salary day', 'the phrase with no day', resetPeriodPhrase(salary(null), at(2026, 11, 11)), 'this month');
  check('salary day', 'monthly ignores a stored day', resetPeriodStart({ resetPeriod: 'monthly', monthDay: 25 }, at(2026, 11, 11)), '2026-11-01');
  check('salary day', 'monthly phrase', resetPeriodPhrase({ resetPeriod: 'monthly', monthDay: 25 }), 'this month');
  check('salary day', 'custom still uses its anchor', resetPeriodStart({ resetPeriod: 'custom', customStart: '2026-11-03' }), '2026-11-03');
  check('salary day', 'custom phrase', resetPeriodPhrase({ resetPeriod: 'custom', customStart: '2026-11-03' }), 'since 3 Nov');
  check('salary day', 'quarterly', resetPeriodStart({ resetPeriod: 'quarterly' }, at(2026, 11, 11)), '2026-10-01');
  check('salary day', 'no profile is monthly', resetPeriodStart(periodFromProfile(null), at(2026, 11, 11)), '2026-11-01');
  check('salary day', 'the profile columns read across', periodFromProfile({ reset_period: 'salary_day', reset_custom_start: null, reset_month_day: 25 }), { resetPeriod: 'salary_day', customStart: null, monthDay: 25 });
  check('salary day', 'ordinals', [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 25, 31].map(ordinalDay), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '25th', '31st']);
}

// --- Month start question (spec 47, onboarding ticket 06) ---
check('month start', 'two answers', MONTH_START_CHOICES.map((o) => o.value), ['first', 'salary_day']);
check('month start', 'the 1st is the calendar month', planMonthStart({ start: 'first', day: null }), { reset_period: 'monthly' });
check('month start', 'the 1st ignores a day left over', planMonthStart({ start: 'first', day: 25 }), { reset_period: 'monthly' });
check('month start', 'salary day 25 is the salary-day patch', planMonthStart({ start: 'salary_day', day: 25 }), { reset_period: 'salary_day', reset_month_day: 25 });
check('month start', 'salary day 31 is allowed', planMonthStart({ start: 'salary_day', day: 31 }), { reset_period: 'salary_day', reset_month_day: 31 });
check('month start', 'salary day with no day is invalid', planMonthStart({ start: 'salary_day', day: null }), null);
check('month start', 'a day out of range is invalid', planMonthStart({ start: 'salary_day', day: 32 }), null);
check('month start', 'no answer is invalid', planMonthStart(), null);
check('month start', 'a new profile starts on the 1st', monthStartFromProfile({ reset_period: 'monthly', reset_month_day: null }), { start: 'first', day: null });
check('month start', 'a saved salary day reads back', monthStartFromProfile({ reset_period: 'salary_day', reset_month_day: 25 }), { start: 'salary_day', day: 25 });
check('month start', 'quarterly shows the 1st', monthStartFromProfile({ reset_period: 'quarterly', reset_month_day: 25 }), { start: 'first', day: null });
check('month start', 'no profile yet shows the 1st', monthStartFromProfile(null), { start: 'first', day: null });

// --- Sign-up rules (spec 47, onboarding ticket 03) ---
// Supabase Auth on this project rejects under 6 characters and has no
// character-class rule (read 2026-11-11); the app asks for 8, so the button
// never enables for a password the server turns down.
check('sign-up', 'the length rule is 8', PASSWORD_MIN, 8);
check('sign-up', 'an empty password meets nothing', passwordRules('').map((r) => r.met), [false]);
check('sign-up', 'the rule reads as shown', passwordRules('').map((r) => r.label), ['8 or more characters']);
check('sign-up', '7 characters fails length', passwordRules('abcdefg').map((r) => r.met), [false]);
check('sign-up', '8 characters passes length', passwordRules('abcdefgh').map((r) => r.met), [true]);
check('sign-up', 'spaces count as characters', passwordRules('ab cd ef').map((r) => r.met), [true]);
check('sign-up', 'empty does not pass', passwordPasses(''), false);
check('sign-up', 'a short one does not pass', passwordPasses('short'), false);
check('sign-up', 'a passing one passes', passwordPasses('quiet ledger 9'), true);
check('sign-up', 'no password at all', passwordPasses(undefined), false);
check('sign-up', 'a valid email', looksLikeEmail('asha@example.com'), true);
check('sign-up', 'surrounding spaces are trimmed', looksLikeEmail('  asha@example.in  '), true);
check('sign-up', 'a subdomain', looksLikeEmail('a.b+flo@mail.example.co.in'), true);
check('sign-up', 'missing @', looksLikeEmail('asha.example.com'), false);
check('sign-up', 'a space inside', looksLikeEmail('asha @example.com'), false);
check('sign-up', 'empty', looksLikeEmail(''), false);
check('sign-up', 'no dot in the domain', looksLikeEmail('asha@example'), false);
check('sign-up', 'nothing before @', looksLikeEmail('@example.com'), false);
check('sign-up', 'two @', looksLikeEmail('a@b@example.com'), false);
check('sign-up', 'not a string', looksLikeEmail(null), false);
check('auth error', 'a wrong password reads plainly', authErrorLine({ code: 'invalid_credentials', message: 'Invalid login credentials' }), "That email and password don't match");
check('auth error', 'a taken email says sign in', authErrorLine({ code: 'user_already_exists', message: 'User already registered' }), 'That email already has an account. Sign in instead');
check('auth error', 'an unknown code shows the message', authErrorLine({ code: 'x', message: 'Network down' }), 'Network down');
check('auth error', 'no error, no line', authErrorLine(null), null);

// --- Insights headline and comparison (spec 48, ticket 01) ---
{
  const nov = new Date(2026, 10, 1);
  const today = new Date(2026, 10, 11);
  const month = (spent, priorSpent) => spendHeadline({ spent, priorSpent, mode: 'month', from: nov, to: new Date(2026, 10, 30), today });
  check('insights', 'spend leads with the amount', month(1984.5, 2414.5), { lead: 'You spent', amount: '₹1,984.50', comparison: '₹430 less than October' });
  check('insights', 'more than the month before', month(3000, 1800).comparison, '₹1,200 more than October');
  check('insights', 'nothing spent', month(0, 500), { lead: "You haven't spent anything", amount: null, comparison: '₹500 less than October' });
  check('insights', 'prior zero, no comparison', month(1200, 0).comparison, null);
  check('insights', 'under 5 % is about the same', month(1040, 1000).comparison, 'About the same as October');
  check('insights', 'exactly 5 % is a change', month(1050, 1000).comparison, '₹50 more than October');
  check('insights', 'January compares with December', spendHeadline({ spent: 100, priorSpent: 200, mode: 'month', from: new Date(2026, 0, 1), to: new Date(2026, 0, 31), today }).comparison, '₹100 less than December');
  const week = (from, to) => spendHeadline({ spent: 900, priorSpent: 600, mode: 'week', from, to, today }).comparison;
  check('insights', 'this week compares with last week', week(new Date(2026, 10, 9), new Date(2026, 10, 15)), '₹300 more than last week');
  check('insights', 'a past week compares with the week before', week(new Date(2026, 10, 2), new Date(2026, 10, 8)), '₹300 more than the week before');
  check('insights', 'custom compares with the days before', spendHeadline({ spent: 500, priorSpent: 800, mode: 'custom', from: new Date(2026, 10, 1), to: new Date(2026, 10, 7), today }).comparison, '₹300 less than the 7 days before');
  check('insights', 'a one-day custom range', spendHeadline({ spent: 500, priorSpent: 800, mode: 'custom', from: today, to: today, today }).comparison, '₹300 less than the day before');
}

// --- Insights chart y-axis (spec 48, ticket 01) ---
check('axis', 'about ₹2k steps in thousands', spendAxis(1984.5), { ticks: [0, 1000, 2000], top: 2000 });
check('axis', 'a round top stays', spendAxis(300), { ticks: [0, 100, 200, 300], top: 300 });
check('axis', 'steps of 2.5', spendAxis(7400), { ticks: [0, 2500, 5000, 7500], top: 7500 });
check('axis', 'steps of 2', spendAxis(520), { ticks: [0, 200, 400, 600], top: 600 });
check('axis', 'nothing spent still draws a scale', spendAxis(0), { ticks: [0, 100], top: 100 });
check('axis', 'paise only', spendAxis(0.6), { ticks: [0, 1], top: 1 });
check('axis', 'zero', axisLabel(0), '₹0');
check('axis', 'hundreds', axisLabel(250), '₹250');
check('axis', 'thousands', axisLabel(1000), '₹1k');
check('axis', 'a half thousand', axisLabel(2500), '₹2.5k');
check('axis', 'lakhs', axisLabel(150000), '₹1.5L');
check('axis', 'crores', axisLabel(20000000), '₹2Cr');
check('axis', 'another currency symbol', axisLabel(1000, 'USD'), '$1k');

// --- Activity opened from an Insights category (spec 48, ticket 01) ---
check('activity link', 'category, type, range and account', filtersFromLink({ categoryId: 'c1', type: 'expense', from: '2026-11-01', to: '2026-11-30', accountId: 'a2' }), {
  ...DEFAULT_FILTERS,
  type: 'expense',
  categoryId: 'c1',
  accountId: 'a2',
  range: { preset: 'custom', from: '2026-11-01', to: '2026-11-30' },
});
check('activity link', 'no account keeps the active one', filtersFromLink({ categoryId: 'c1', from: '2026-11-01', to: '2026-11-07' }).accountId, null);
check('activity link', 'all accounts', filtersFromLink({ accountId: 'all', from: '2026-11-01', to: '2026-11-07' }).accountId, 'all');
check('activity link', 'uncategorized links to all categories', filtersFromLink({ categoryId: '', from: '2026-11-01', to: '2026-11-07' }).categoryId, null);
check('activity link', 'a bad date leaves the range alone', filtersFromLink({ categoryId: 'c1', from: 'nope', to: '2026-11-07' }).range, DEFAULT_FILTERS.range);
check('activity link', 'an unknown type reads as all', filtersFromLink({ type: 'transfer_in', from: '2026-11-01', to: '2026-11-07' }).type, 'all');
check('activity link', 'nothing in the link, nothing applied', filtersFromLink({}), null);
check('activity link', 'only the visit stamp, nothing applied', filtersFromLink({ at: '123' }), null);

// --- Insights "Where it went" change line (spec 48, ticket 01) ---
{
  const nov = { mode: 'month', from: new Date(2026, 10, 1), to: new Date(2026, 10, 30), today: new Date(2026, 10, 11) };
  check('category change', 'up', categoryChange({ pct: 137.5, direction: 'up' }, nov), '↑138 % vs October');
  check('category change', 'down', categoryChange({ pct: -57.1, direction: 'down' }, nov), '↓57 % vs October');
  check('category change', 'nothing the period before', categoryChange({ pct: null, direction: 'up' }, nov), 'None in October');
  check('category change', 'flat', categoryChange({ pct: 0, direction: 'flat' }, nov), 'Same as October');
  check('category change', 'nothing last week', categoryChange({ pct: null, direction: 'up' }, { mode: 'week', from: new Date(2026, 10, 9), to: new Date(2026, 10, 15), today: new Date(2026, 10, 11) }), 'None last week');
  check('category change', 'last week', categoryChange({ pct: 10, direction: 'up' }, { mode: 'week', from: new Date(2026, 10, 9), to: new Date(2026, 10, 15), today: new Date(2026, 10, 11) }), '↑10 % vs last week');
}

// --- Insights: the period before (spec 48, ticket 01) ---
{
  const d = (y, m, day) => new Date(y, m, day);
  const r = (from, to) => { const p = priorRange(from, to); return [p.from.toDateString(), p.to.toDateString()]; };
  check('prior range', 'November compares with all of October', r(d(2026, 10, 1), d(2026, 10, 30)), [d(2026, 9, 1).toDateString(), d(2026, 9, 31).toDateString()]);
  check('prior range', 'March compares with February', r(d(2026, 2, 1), d(2026, 2, 31)), [d(2026, 1, 1).toDateString(), d(2026, 1, 28).toDateString()]);
  check('prior range', 'January compares with December', r(d(2027, 0, 1), d(2027, 0, 31)), [d(2026, 11, 1).toDateString(), d(2026, 11, 31).toDateString()]);
  check('prior range', 'a week compares with the week before', r(d(2026, 10, 9), d(2026, 10, 15)), [d(2026, 10, 2).toDateString(), d(2026, 10, 8).toDateString()]);
  check('prior range', 'a custom range compares with the same days before', r(d(2026, 10, 5), d(2026, 10, 11)), [d(2026, 9, 29).toDateString(), d(2026, 10, 4).toDateString()]);
  check('prior range', 'a range not on month edges stays day-for-day', r(d(2026, 10, 2), d(2026, 10, 30)), [d(2026, 9, 4).toDateString(), d(2026, 10, 1).toDateString()]);
}

// --- Budgets list rows (spec 48, ticket 02) ---
{
  const today = new Date(2026, 10, 12);
  const month = (spent, amount) => budgetRowStatus({ spent, amount, period_type: 'calendar_month' }, { today });
  check('budget row', 'under 80 % is fine', month(4000, 10000), { state: 'ok', ratio: 0.4, caption: null, captionTone: null, rightText: '₹6,000 left', rightTone: 'ink' });
  check('budget row', 'exactly 80 % is still fine', month(8000, 10000).state, 'ok');
  check('budget row', 'past 80 % is almost out', month(8500, 10000), { state: 'warn', ratio: 0.85, caption: 'Almost out', captionTone: 'warn', rightText: '₹1,500 left', rightTone: 'ink' });
  check('budget row', 'exactly 100 % is used up, in red', month(2000, 2000), { state: 'over', ratio: 1, caption: 'Used up', captionTone: 'danger', rightText: '₹0 left', rightTone: 'danger' });
  check('budget row', 'past 100 % is over, and the amount says so', month(2104.5, 2000), { state: 'over', ratio: 1.05225, caption: null, captionTone: null, rightText: '₹104.50 over', rightTone: 'danger' });
  check('budget row', 'no limit reads as fine', month(50, 0).state, 'ok');
  const custom = (end, spent) => budgetRowStatus({ spent, amount: 1000, period_type: 'custom', start_date: '2026-10-01', end_date: end }, { today });
  check('budget row', 'an ended custom budget says Ended, keeps its final tone', custom('2026-11-11', 1200), { state: 'ended', ratio: 1.2, caption: 'Ended', captionTone: 'muted', rightText: '₹200 over', rightTone: 'danger' });
  check('budget row', 'a custom budget ending today is still running', custom('2026-11-12', 300).state, 'ok');
  check('budget row', 'a calendar budget never ends', budgetRowStatus({ spent: 1, amount: 10, period_type: 'calendar_week', end_date: '2020-01-01' }, { today }).state, 'ok');
  check('budget row', 'another currency', budgetRowStatus({ spent: 10, amount: 100, period_type: 'calendar_month' }, { today, currency: 'USD' }).rightText, '$90 left');
}

// --- Bills list groups (spec 48, ticket 03) ---
{
  const today = new Date(2026, 10, 12);
  const bill = (name, next_due_date, extra = {}) => ({ id: name, name, next_due_date, cadence: 'monthly', is_active: true, ...extra });
  const shape = (bills) => groupBills(bills, today).map((g) => [g.key, g.items.map((b) => b.name)]);
  check('bills', 'overdue yesterday', shape([bill('A', '2026-11-11')]), [['overdue', ['A']]]);
  check('bills', 'due today is this week', shape([bill('A', '2026-11-12')]), [['week', ['A']]]);
  check('bills', 'due in 6 days is this week', shape([bill('A', '2026-11-18')]), [['week', ['A']]]);
  check('bills', 'due in 7 days is later', shape([bill('A', '2026-11-19')]), [['later', ['A']]]);
  check('bills', 'paused with a past date is paused, not overdue', shape([bill('A', '2026-10-01', { is_active: false })]), [['paused', ['A']]]);
  check('bills', 'groups in order, empty ones left out, sorted by date then name',
    shape([bill('Rent', '2026-12-01'), bill('Jio', '2026-11-14'), bill('Airtel', '2026-11-14'), bill('Gym', '2026-11-01', { is_active: false }), bill('Netflix', '2026-11-07')]),
    [['overdue', ['Netflix']], ['week', ['Airtel', 'Jio']], ['later', ['Rent']], ['paused', ['Gym']]]);
  check('bills', 'group titles', groupBills([bill('A', '2026-11-11'), bill('B', '2026-11-12'), bill('C', '2026-12-12'), bill('D', '2026-11-12', { is_active: false })], today).map((g) => g.title), ['Overdue', 'This week', 'Later', 'Paused']);
  check('bills', 'line: due', billLine(bill('A', '2026-11-14'), today), { sub: 'Monthly · Due 14 Nov', tone: null });
  check('bills', 'line: due today', billLine(bill('A', '2026-11-12', { cadence: 'weekly' }), today), { sub: 'Weekly · Due today', tone: null });
  check('bills', 'line: overdue', billLine(bill('A', '2026-11-07'), today), { sub: 'Overdue since 7 Nov', tone: 'danger' });
  check('bills', 'line: paused', billLine(bill('A', '2026-11-07', { is_active: false, cadence: 'yearly' }), today), { sub: 'Yearly · Paused', tone: 'muted' });
  check('bills', 'terms: due', billTerms(bill('A', '2026-12-07'), today), { text: 'Monthly · Next due 7 Dec', tone: null });
  check('bills', 'terms: overdue', billTerms(bill('A', '2026-11-07'), today), { text: 'Monthly · Next due 7 Nov', tone: 'danger' });
  check('bills', 'terms: paused', billTerms(bill('A', '2026-11-07', { is_active: false }), today), { text: 'Monthly · Paused', tone: 'muted' });
  check('bills', 'line: next year shows the year', billLine(bill('A', '2027-01-05', { cadence: 'yearly' }), today).sub, 'Yearly · Due 5 Jan 2027');
}

// --- Bill detail timeline (spec 48, ticket 04) ---
{
  const today = new Date(2026, 10, 12);
  const bill = (extra = {}) => ({ id: 'b', name: 'Netflix', amount: 649, currency: 'INR', cadence: 'monthly', next_due_date: '2026-12-07', last_paid_date: null, is_active: true, created_at: '2026-09-01T10:00:00Z', ...extra });
  const pay = (day, amount = 649, account = 'HDFC') => ({ id: `t${day}`, occurred_at: day, amount, accountName: account });
  const shape = (steps) => steps.map((s) => [s.kind, s.title, s.sub ?? null, s.tone ?? null]);
  check('bill timeline', 'never paid: next due, then added', shape(billTimeline(bill(), [], today)), [
    ['due', 'Due 7 Dec', 'Next payment', null],
    ['added', 'Added', '1 Sep', null],
  ]);
  check('bill timeline', 'payments newest first, with account', shape(billTimeline(bill({ last_paid_date: '2026-11-07' }), [pay('2026-11-07'), pay('2026-10-07', 599, 'Personal')], today)), [
    ['due', 'Due 7 Dec', 'Next payment', null],
    ['payment', 'Paid ₹649', '7 Nov · HDFC', null],
    ['payment', 'Paid ₹599', '7 Oct · Personal', null],
    ['added', 'Added', '1 Sep', null],
  ]);
  check('bill timeline', 'a payment links its entry', billTimeline(bill(), [pay('2026-11-07')], today)[1].txId, 't2026-11-07');
  check('bill timeline', 'overdue open step in danger', shape(billTimeline(bill({ next_due_date: '2026-11-07' }), [], today))[0], ['due', 'Overdue since 7 Nov', 'Next payment', 'danger']);
  check('bill timeline', 'due today', billTimeline(bill({ next_due_date: '2026-11-12' }), [], today)[0].title, 'Due today');
  check('bill timeline', 'paused: no open step', billTimeline(bill({ is_active: false }), [], today).map((s) => s.kind), ['added']);
  check('bill timeline', 'last paid before history began', shape(billTimeline(bill({ last_paid_date: '2026-10-07' }), [], today))[1], ['last_paid', 'Last paid 7 Oct', null, null]);
  check('bill timeline', 'last paid matching a payment adds nothing', billTimeline(bill({ last_paid_date: '2026-11-07' }), [pay('2026-11-07')], today).map((s) => s.kind), ['due', 'payment', 'added']);
  const many = Array.from({ length: 14 }, (_, i) => pay(`2025-${String(12 - (i % 12)).padStart(2, '0')}-${String(10 + Math.floor(i / 12)).padStart(2, '0')}`));
  const capped = billTimeline(bill(), many, today);
  check('bill timeline', 'twelve payments, then a pointer to Activity', [capped.filter((s) => s.kind === 'payment').length, capped[capped.length - 2].title], [12, 'Earlier payments are in Activity']);
  check('bill timeline', 'another year shows the year', billTimeline(bill({ next_due_date: '2027-01-05', created_at: '2025-03-02T10:00:00Z' }), [], today).map((s) => s.title === 'Added' ? s.sub : s.title), ['Due 5 Jan 2027', '2 Mar 2025']);
}

// --- Bill icons from names (spec 48, ticket 05) ---
{
  const cases = [
    ['Netflix', 'entertainment'], ['Prime', 'entertainment'], ['Amazon Prime Video', 'entertainment'], ['Hotstar', 'entertainment'], ['Spotify', 'entertainment'], ['JioCinema', 'entertainment'],
    ['Electricity', 'utilities'], ['BESCOM', 'utilities'], ['TNEB bill', 'utilities'], ['Power', 'utilities'],
    ['Rent', 'home'], ['House rent', 'home'], ['Society maintenance', 'home'],
    ['Jio', 'phone'], ['Airtel postpaid', 'phone'], ['AIRTEL', 'phone'], ['Vi recharge', 'phone'], ['Mobile recharge', 'phone'],
    ['Airtel DTH', 'tv'], ['Tata Play', 'tv'], ['Dish TV', 'tv'], ['Dish', 'tv'],
    ['Jio Fiber', 'wifi'], ['ACT Fibernet', 'wifi'], ['ACT', 'wifi'], ['Broadband', 'wifi'], ['Wi-Fi', 'wifi'],
    ['Water bill', 'water'], ['BWSSB', 'water'],
    ['Indane gas', 'gas'], ['LPG cylinder', 'gas'],
    ['LIC', 'insurance'], ['Health insurance premium', 'insurance'],
    ['SIP', 'investment'], ['Mutual fund', 'investment'], ['PPF', 'investment'],
    ['Car EMI', 'business'], ['Home loan', 'business'],
    ['School fees', 'education'], ['Tuition', 'education'],
    ['Gym', 'fitness'], ['Cult.fit', 'fitness'],
    ['HDFC credit card', 'bills'],
  ];
  for (const [name, key] of cases) check('bill icons', name, iconForBillName(name), key);
  check('bill icons', 'a word that merely contains a name does not match', iconForBillName('Fairtel'), null);
  check('bill icons', 'a short key needs the whole word', iconForBillName('Vivek'), null);
  check('bill icons', 'nothing known', iconForBillName('Aunty tiffin'), null);
  check('bill icons', 'a loose word is not a bill family', iconForBillName('Flat 4B'), null);
  check('bill icons', 'a word that starts with a short key does not match', iconForBillName('Acting class'), null);
  check('bill icons', 'empty', iconForBillName(''), null);
  check('bill icons', 'not a string', iconForBillName(null), null);
  check('bill icons', 'display: the stored icon wins', billIconKey({ icon: 'wifi', category: { icon: 'bills' } }), 'wifi');
  check('bill icons', 'display: then the category icon', billIconKey({ icon: null, category: { icon: 'home' } }), 'home');
  check('bill icons', 'display: then a receipt', billIconKey({ icon: null, category: null }), 'bills');
  check('bill icons', 'display: an unknown stored key falls back', billIconKey({ icon: 'rocket', category: { icon: 'home' } }), 'home');
  const mapped = [...new Set(cases.map(([, k]) => k))];
  check('bill icons', 'every mapped key is in the set', mapped.filter((k) => !BILL_ICON_KEYS.includes(k)), []);
  const iconFile = readFileSync(new URL('../components/CategoryIcon.js', import.meta.url), 'utf8');
  check('bill icons', 'every key draws an icon', BILL_ICON_KEYS.filter((k) => !new RegExp(`^\\s+${k}:`, 'm').test(iconFile)), []);
  const fn = readFileSync(new URL('../supabase/functions/ai-assistant/billIcon.ts', import.meta.url), 'utf8');
  const fnKeys = JSON.parse(fn.match(/BILL_ICON_KEYS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  check('bill icons', 'the Edge Function lists the same keys', fnKeys, BILL_ICON_KEYS);
}

// --- Account last 4 (spec 48, ticket 06; spec 45 Phase 1) ---
{
  const ok = (value) => ({ value, error: null });
  const bad = { value: null, error: LAST4_ERROR };
  check('last 4', 'blank is none', cleanLast4(''), ok(null));
  check('last 4', 'spaces only is none', cleanLast4('   '), ok(null));
  check('last 4', 'null is none', cleanLast4(null), ok(null));
  check('last 4', 'four digits', cleanLast4('4821'), ok('4821'));
  check('last 4', 'spaces are stripped', cleanLast4(' 48 21 '), ok('4821'));
  check('last 4', 'three digits', cleanLast4('482'), bad);
  check('last 4', 'five digits', cleanLast4('48211'), bad);
  check('last 4', 'letters are stripped, leaving too few', cleanLast4('48a1'), bad);
  check('last 4', 'letters only is none', cleanLast4('abcd'), ok(null));
  check('last 4', 'the error text', LAST4_ERROR, 'Enter all 4 digits or leave it blank');
  check('last 4', 'masked', maskedLast4({ last4: '4821' }), '•••• 4821');
  check('last 4', 'masked: none set', maskedLast4({ last4: null }), null);
  check('last 4', 'masked: a bad stored value shows nothing', maskedLast4({ last4: '48' }), null);
  check('last 4', 'sub: description and last 4', accountSub({ description: 'Salary card', last4: '4821' }), 'Salary card · •••• 4821');
  check('last 4', 'sub: last 4 only', accountSub({ description: null, last4: '4821' }), '•••• 4821');
  check('last 4', 'sub: description only', accountSub({ description: 'Cash', last4: null }), 'Cash');
  check('last 4', 'sub: a blank description is none', accountSub({ description: '  ', last4: null }), null);
  check('last 4', 'sub: neither', accountSub({}), null);
}

// --- Card text tint (the person's ask, 2026-11-12) ---
{
  const all = [...CARD_THEMES, ...Object.values(DAY_THEMES)];
  const worst = (t, color) => Math.min(...cardBaseColors(t).map((b) => contrastRatio(color, b)));
  const worse = all.filter((t) => cardBaseColors(t).length && /^#[0-9a-f]{6}$/i.test(t.textColor) && worst(t, cardTextColor(t)) < Math.min(4.5, worst(t, t.textColor)));
  check('card text', 'never less readable than the theme text, never under 4.5 where it was', worse.map((t) => t.id), []);
  const night = cardTextColor(DAY_THEMES.night);
  check('card text', 'night (white text): a light tint of its navy at 7:1', [night !== '#FFFFFF' && night !== '#ffffff', worst(DAY_THEMES.night, night) >= 7], [true, true]);
  const morning = cardTextColor(DAY_THEMES.morning);
  check('card text', 'morning (dark text): a dark tint of its sky at 7:1', [morning !== DAY_THEMES.morning.textColor, worst(DAY_THEMES.morning, morning) >= 7], [true, true]);
  check('card text', 'ink: a tint, not plain white', cardTextColor(getTheme('ink-classic')).toLowerCase() !== '#ffffff', true);
  check('card text', 'no colour to work from keeps the theme text', cardTextColor({ textColor: '#FFFFFF', background: { type: 'solid', color: 'rgba(0,0,0,0.5)' } }), '#FFFFFF');
  check('card text', 'missing theme', cardTextColor(undefined), '#FFFFFF');
  check('card text', 'gradient: checked against every stop', cardBaseColors({ background: { type: 'linear', angle: 90, colors: ['#112233', '#445566'] } }), ['#112233', '#445566']);
  check('card text', 'shadow under light text is a deep shade of the hue', cardTextShadow(DAY_THEMES.night).textShadowColor, 'rgba(3, 10, 30, 0.6)');
  check('card text', 'shadow under dark text is a pale shade of the hue', cardTextShadow(DAY_THEMES.morning).textShadowColor, 'rgba(217, 238, 254, 0.6)');
  check('card text', 'no colour, no shadow', cardTextShadow({ textColor: '#FFFFFF', background: { type: 'solid', color: 'rgba(0,0,0,0.5)' } }), null);
}

// --- Split net text (spec 48, ticket 07) ---
{
  check('split net', 'owed', splitNetText({ myNet: 600, myPays: 0, entryCount: 3 }), { text: "You're owed ₹600", tone: 'positive' });
  check('split net', 'owe leads with what you pay', splitNetText({ myNet: 150, myPays: 200, entryCount: 3 }), { text: 'You owe ₹200', tone: 'ink' });
  check('split net', 'owe with paise', splitNetText({ myNet: -1333.6, myPays: 1333.6, entryCount: 2 }), { text: 'You owe ₹1,333.60', tone: 'ink' });
  check('split net', 'square', splitNetText({ myNet: 0, myPays: 0, entryCount: 2 }), { text: 'Settled up', tone: 'muted' });
  check('split net', 'a sub-paisa residue is square', splitNetText({ myNet: 0.004, myPays: 0.003, entryCount: 2 }), { text: 'Settled up', tone: 'muted' });
  check('split net', 'nothing added yet', splitNetText({ entryCount: 0 }), { text: 'Nothing added yet', tone: 'muted' });
  check('split net', 'closed and empty', splitNetText({ entryCount: 0 }, { closed: true }), { text: 'Nothing was added', tone: 'muted' });
  check('split net', 'currency', splitNetText({ myNet: 12, myPays: 0, entryCount: 1 }, { currency: 'USD' }).text, "You're owed $12");
}

// --- Milestone celebrations (spec 49, ticket 01) ---
{
  const on = (current, loggedToday = true) => celebrationFor({ current, loggedToday }, '2026-11-14');
  check('celebration', 'day one is no celebration', on(1), null);
  check('celebration', 'day 7 celebrates', on(7), { id: 'streak-milestone:7:2026-11-14', days: 7 });
  check('celebration', 'day 30 celebrates', on(30)?.days, 30);
  check('celebration', 'day 100 celebrates', on(100)?.days, 100);
  check('celebration', 'day 365 celebrates', on(365)?.days, 365);
  check('celebration', 'day 8 is no celebration', on(8), null);
  check('celebration', 'no streak is no celebration', on(0), null);
  check('celebration', 'a milestone count without a log today waits', on(7, false), null);
}

// --- Report ---
for (const f of failures) {
  console.log(`✗ ${f.group}: ${f.name}\n    got  ${JSON.stringify(f.got)}\n    want ${JSON.stringify(f.want)}`);
}
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
