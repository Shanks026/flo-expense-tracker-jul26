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
import { isYmd, formatInr, dayLong, addDays, type Ctx } from './shared.ts';

export const MAX_AMOUNT = 1_00_00_000; // ₹1 crore
const MAX_NOTE = 120;
const OLDEST_YEARS = 5;

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

  let accountId: string | null = null;
  if (args.account_id != null && args.account_id !== '') {
    if (!ctx.accounts.some((a) => a.id === args.account_id)) return { error: 'account_id is not one of their accounts' };
    accountId = args.account_id as string;
  } else {
    accountId = ctx.activeAccountId ?? (ctx.accounts.length === 1 ? ctx.accounts[0].id : null);
    if (!accountId) return { error: 'no current account; ask them which account' };
  }
  const account = ctx.accounts.find((a) => a.id === accountId)!;

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
  '  - One draft per answer. If they list several entries, draft the first and say to send the next one after saving it.',
  '  - You cannot change, delete or transfer money between accounts from here; say they can do that in the app.',
  '  - Earlier answers may end with a note in square brackets about the draft shown under them and whether they saved it. That note is the app\'s record, so trust it. Never write such a note yourself.',
  '  - If the tool returns an error, fix the call if you can; otherwise ask them for what is missing. A draft that returned an error is not shown, so do not mention a card.',
].join('\n');
