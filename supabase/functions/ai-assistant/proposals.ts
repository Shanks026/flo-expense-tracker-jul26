// ai-assistant proposals — 44-ai-assistant.md, Phase 4.
//
// A proposal tool never writes. It checks what the model drafted against the
// person's own lists and returns either a proposal (the app shows it as a
// card; Review opens the matching sheet pre-filled, and the sheet's Save is
// the only write) or an error that tells the model what to fix. An invalid
// proposal is dropped, never shown.
//
// Shapes (spec §4.2), stored in ai_messages.proposal:
//   { kind: 'transaction', type, amount, category_id, account_id, date, note }
//   { kind: 'budget', amount, category_id | null, period_type, start_date?, end_date?, account_id }
//   { kind: 'bill', name, amount, cadence, next_due_date, category_id | null }
import { isYmd, formatInr, dayLong, addDays, type Ctx } from './shared.ts';

export const MAX_AMOUNT = 1_00_00_000; // ₹1 crore
const MAX_NOTE = 120;
const OLDEST_YEARS = 5;
// The values AddBudgetSheet writes (budgets.period_type's check).
const PERIOD_TYPES = ['calendar_week', 'calendar_month', 'custom'];
const MAX_CUSTOM_DAYS = 366;
// The values AddBillSheet writes (bills.cadence's check).
const CADENCES = ['weekly', 'monthly', 'yearly'];
const MAX_BILL_NAME = 60;
const MAX_DUE_AHEAD_DAYS = 400; // a yearly bill's next date, with room

export type Proposal = Record<string, unknown> & { kind: string };
export type ProposalResult = { proposal: Proposal; card: string } | { error: string };

export const PROPOSAL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'propose_transaction',
      description:
        'Drafts one new expense or income entry for them to review. It saves nothing: the app shows it as a card, and they tap Review, check it in the Add sheet and Save. Use when they ask to add, log or record money they spent or received.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'amount', 'category_id', 'date'],
        properties: {
          type: { type: 'string', enum: ['expense', 'income'] },
          amount: { type: 'number', description: 'In rupees, as they said it. More than 0.' },
          category_id: { type: 'string', description: 'An id from their categories, of the same type.' },
          account_id: {
            type: 'string',
            description: 'An id from their accounts. Leave out to use their current account.',
          },
          date: { type: 'string', description: 'The day it happened, YYYY-MM-DD. Today unless they say otherwise.' },
          note: { type: 'string', description: 'A short note in their words (what or where), or leave out.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_budget',
      description:
        'Drafts one new budget for them to review. It saves nothing: the app shows it as a card, and they tap Review, check it in the New Budget sheet and create it. A budget covers one expense category, or all their spending.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['amount', 'category_id', 'period_type'],
        properties: {
          amount: { type: 'number', description: 'The budget in rupees, as they said it. More than 0.' },
          category_id: {
            type: 'string',
            description: 'An id from their expense categories, or "all" for a budget over all their spending.',
          },
          period_type: {
            type: 'string',
            enum: PERIOD_TYPES,
            description:
              'calendar_month: every month (also for "this month" or "monthly"). calendar_week: every week, Monday to Sunday. custom: one fixed range of days, with start_date and end_date.',
          },
          start_date: { type: 'string', description: 'custom only: first day, YYYY-MM-DD.' },
          end_date: { type: 'string', description: 'custom only: last day, YYYY-MM-DD.' },
          account_id: {
            type: 'string',
            description: 'An id from their accounts. Leave out to use their current account.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_bill',
      description:
        'Drafts one new recurring bill reminder for them to review. It saves nothing: the app shows it as a card, and they tap Review, check it in the New Bill sheet and save it.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'amount', 'cadence', 'next_due_date'],
        properties: {
          name: { type: 'string', description: 'A short name in their words, like Rent or Netflix.' },
          amount: { type: 'number', description: 'In rupees, as they said it. More than 0.' },
          cadence: { type: 'string', enum: CADENCES, description: 'How often it repeats.' },
          next_due_date: {
            type: 'string',
            description:
              'The next day it is due, YYYY-MM-DD, today or later. "On the 1st every month" is the next 1st on or after today.',
          },
          category_id: {
            type: 'string',
            description: 'An id from their expense categories that fits (Rent, Bills, Subscriptions…). Leave out if none fits.',
          },
        },
      },
    },
  },
];

// Rupees with at most two decimals, above 0 and within ₹1 crore.
function checkAmount(raw: unknown): { amount: number } | { error: string } {
  const n = typeof raw === 'string' ? Number(raw.replace(/[₹,\s]/g, '')) : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { error: 'amount must be a number of rupees above 0; ask them for it if they gave none' };
  if (n > MAX_AMOUNT) return { error: 'amount is over ₹1 crore; check it with them' };
  return { amount: Math.round(n * 100) / 100 };
}

function cleanNote(raw: unknown) {
  if (typeof raw !== 'string') return null;
  const note = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_NOTE);
  return note || null;
}

// account_id → one of theirs, or their current account when left out.
function pickAccount(raw: unknown, ctx: Ctx): { accountId: string } | { error: string } {
  if (raw != null && raw !== '') {
    return ctx.accounts.some((a) => a.id === raw)
      ? { accountId: raw as string }
      : { error: 'account_id is not one of their accounts' };
  }
  const accountId = ctx.activeAccountId ?? (ctx.accounts.length === 1 ? ctx.accounts[0].id : null);
  return accountId ? { accountId } : { error: 'no current account; ask them which account' };
}

function proposeBudget(args: Record<string, unknown>, ctx: Ctx): ProposalResult {
  const amountRes = checkAmount(args.amount);
  if ('error' in amountRes) return amountRes;

  let categoryId: string | null = null;
  if (args.category_id !== 'all') {
    const category = ctx.categories.find((c) => c.id === args.category_id);
    if (!category) {
      return {
        error:
          'category_id is not one of their categories. Do not guess: ask them which of their categories they meant (name the closest), or whether they want a budget over all spending',
      };
    }
    if (category.type !== 'expense') return { error: `${category.name} is an income category; a budget needs an expense category` };
    categoryId = category.id;
  }

  const periodType = args.period_type;
  if (typeof periodType !== 'string' || !PERIOD_TYPES.includes(periodType)) {
    return { error: `period_type must be one of ${PERIOD_TYPES.join(', ')}` };
  }
  let startDate: string | null = null;
  let endDate: string | null = null;
  if (periodType === 'custom') {
    const { start_date: start, end_date: end } = args;
    if (!isYmd(start) || !isYmd(end)) return { error: 'a custom budget needs start_date and end_date, YYYY-MM-DD' };
    if (end < start) return { error: 'end_date is before start_date' };
    if (end < ctx.today) return { error: 'that range has already ended; check the dates with them' };
    if (end > addDays(start, MAX_CUSTOM_DAYS - 1)) return { error: `a custom budget can cover at most ${MAX_CUSTOM_DAYS} days` };
    startDate = start;
    endDate = end;
  }

  const accountRes = pickAccount(args.account_id, ctx);
  if ('error' in accountRes) return accountRes;

  const proposal: Proposal = {
    kind: 'budget',
    amount: amountRes.amount,
    category_id: categoryId,
    period_type: periodType,
    start_date: startDate,
    end_date: endDate,
    account_id: accountRes.accountId,
  };
  return { proposal, card: cardText(proposal, ctx) };
}

function proposeBill(args: Record<string, unknown>, ctx: Ctx): ProposalResult {
  const name = typeof args.name === 'string' ? args.name.trim().replace(/\s+/g, ' ') : '';
  if (!name) return { error: 'name is missing; ask them what to call the bill' };
  if (name.length > MAX_BILL_NAME) return { error: `name is over ${MAX_BILL_NAME} characters; use a short name` };
  const amountRes = checkAmount(args.amount);
  if ('error' in amountRes) return amountRes;
  const cadence = args.cadence;
  if (typeof cadence !== 'string' || !CADENCES.includes(cadence)) return { error: `cadence must be one of ${CADENCES.join(', ')}` };
  const due = args.next_due_date;
  if (!isYmd(due)) return { error: 'next_due_date must be a real day, YYYY-MM-DD' };
  if (due < ctx.today) return { error: 'next_due_date is in the past; use the next time it is due, today or later' };
  if (due > addDays(ctx.today, MAX_DUE_AHEAD_DAYS)) return { error: 'next_due_date is more than a year away; check it with them' };

  let categoryId: string | null = null;
  if (args.category_id != null && args.category_id !== '') {
    const category = ctx.categories.find((c) => c.id === args.category_id);
    if (!category) return { error: 'category_id is not one of their categories; pick one of theirs or leave it out' };
    if (category.type !== 'expense') return { error: `${category.name} is an income category; a bill needs an expense category` };
    categoryId = category.id;
  }

  const proposal: Proposal = {
    kind: 'bill',
    name,
    amount: amountRes.amount,
    cadence,
    next_due_date: due,
    category_id: categoryId,
  };
  return { proposal, card: cardText(proposal, ctx) };
}

function proposeTransaction(args: Record<string, unknown>, ctx: Ctx): ProposalResult {
  const { type } = args;
  if (type !== 'expense' && type !== 'income') {
    return { error: 'type must be expense or income; transfers between accounts are done in the Add sheet, not here' };
  }
  const amountRes = checkAmount(args.amount);
  if ('error' in amountRes) return amountRes;

  const category = ctx.categories.find((c) => c.id === args.category_id);
  if (!category) return { error: 'category_id is not one of their categories; pick one from their list, or ask them' };
  if (category.type !== type) return { error: `${category.name} is a ${category.type} category, not ${type}` };

  const accountRes = pickAccount(args.account_id, ctx);
  if ('error' in accountRes) return accountRes;
  const account = ctx.accounts.find((a) => a.id === accountRes.accountId)!;

  const date = args.date;
  if (!isYmd(date)) return { error: 'date must be a real day, YYYY-MM-DD' };
  if (date > ctx.today) {
    return { error: 'date is in the future; an entry is money already spent or received. For something coming up, they can add a bill' };
  }
  if (date < addDays(ctx.today, -366 * OLDEST_YEARS)) return { error: `date is more than ${OLDEST_YEARS} years ago; check it with them` };

  const note = cleanNote(args.note);
  const proposal: Proposal = {
    kind: 'transaction',
    type,
    amount: amountRes.amount,
    category_id: category.id,
    account_id: account.id,
    date,
    note,
  };
  return { proposal, card: cardText(proposal, ctx) };
}

// A stored proposal in words, as its card reads: "Expense · ₹250 · Auto ·
// Personal · Sun 8 Nov 2026".
function cardText(p: Proposal, ctx: Ctx) {
  const name = (list: { id: string; name: string }[], id: unknown) => list.find((x) => x.id === id)?.name ?? null;
  if (p.kind === 'transaction') {
    return [
      p.type === 'income' ? 'Income' : 'Expense',
      formatInr(Number(p.amount)),
      name(ctx.categories, p.category_id),
      name(ctx.accounts, p.account_id),
      isYmd(p.date) ? dayLong(p.date) : null,
      p.note ? `"${p.note}"` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (p.kind === 'budget') {
    const period =
      p.period_type === 'calendar_week'
        ? 'every week'
        : p.period_type === 'custom' && isYmd(p.start_date) && isYmd(p.end_date)
          ? `${dayLong(p.start_date)} to ${dayLong(p.end_date)}`
          : 'every month';
    return [
      'Budget',
      p.category_id ? name(ctx.categories, p.category_id) : 'All spending',
      formatInr(Number(p.amount)),
      period,
      name(ctx.accounts, p.account_id),
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (p.kind === 'bill') {
    return [
      'Bill',
      typeof p.name === 'string' ? p.name : null,
      formatInr(Number(p.amount)),
      typeof p.cadence === 'string' ? p.cadence : null,
      isYmd(p.next_due_date) ? `next due ${dayLong(p.next_due_date)}` : null,
      p.category_id ? name(ctx.categories, p.category_id) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return p.kind;
}

// An earlier answer's draft, for the history sent to the model. Without it
// the model sees only its own words ("ready to review") and no tool call, and
// may decide it never made the draft.
export function historyNote(p: unknown, ctx: Ctx) {
  if (!p || typeof p !== 'object' || typeof (p as Proposal).kind !== 'string') return '';
  const proposal = p as Proposal;
  const status =
    proposal.status === 'saved'
      ? 'they saved it'
      : proposal.status === 'dismissed'
        ? 'they dismissed it, so nothing was saved'
        : 'not saved yet';
  return `\n\n[A draft was shown under this answer as a card: ${cardText(proposal, ctx)}. Status: ${status}.]`;
}

const HANDLERS: Record<string, (args: Record<string, unknown>, ctx: Ctx) => ProposalResult> = {
  propose_transaction: proposeTransaction,
  propose_budget: proposeBudget,
  propose_bill: proposeBill,
};

export const isProposalTool = (name: string) => name in HANDLERS;

export function runProposal(name: string, args: Record<string, unknown>, ctx: Ctx): ProposalResult {
  return HANDLERS[name](args, ctx);
}

// The system prompt's rules for drafting.
export const PROPOSAL_RULES = [
  '- Drafting entries. When they ask you to add, log or record money they spent or received ("add 250 auto yesterday"), call propose_transaction. It saves nothing: the app shows the draft as a card under your answer, and they tap Review, check it and Save.',
  '  - So never say it is saved, added or logged. Say in one short sentence that it is ready to review. The card shows the details, so do not list them all again.',
  '  - Use only an amount they gave. If they gave none, ask for it instead of drafting.',
  '  - The date is today unless they say otherwise; work out words like yesterday or last Friday from the local date.',
  '  - Pick the one category of theirs that fits best (auto → Auto, or Travel or Transport if that is what they have). If none fits and they have Other, use Other. If it could be two quite different categories, ask.',
  '- Drafting budgets. When they ask to set or create a budget, call propose_budget. It saves nothing either; say in one sentence it is ready to review.',
  '  - A budget covers exactly one category or all spending, never several categories together, so never offer a combination. Use a category only when one of theirs is plainly the one they named (the same name, or a near spelling). If none is, do not pick one, even a related one: ask which of their categories they meant, naming the closest few, or whether they want a budget over all spending. "Monthly spending" or "overall" means "all".',
  '  - "This month", "a month" or "monthly" is calendar_month, which repeats every month. "Weekly" is calendar_week. Use custom only for a fixed range of dates they give.',
  '- Drafting bills. When they ask to be reminded of a recurring payment ("remind me about rent, 15,000, on the 1st every month"), call propose_bill. It saves nothing either; say in one sentence it is ready to review.',
  '  - next_due_date is the next time it is due, today or later: "on the 1st every month" is the next 1st on or after today. If they gave no day or amount, ask.',
  '  - Pick the expense category of theirs that fits (Rent for rent, Bills or Subscriptions for others); leave it out if none fits.',
  '  - One draft per answer. If they list several entries, draft the first and say to send the next one after saving it.',
  '  - You cannot change, delete or transfer money between accounts from here; say they can do that in the app.',
  '  - Earlier answers may end with a note in square brackets about the draft shown under them and whether they saved it. That note is the app\'s record, so trust it. Never write such a note yourself.',
  '  - If the tool returns an error, fix the call if you can; otherwise ask them for what is missing. A draft that returned an error is not shown, so do not mention a card.',
].join('\n');
