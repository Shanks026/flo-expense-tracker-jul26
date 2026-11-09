// Typed quick add, on the phone (44-ai-assistant.md, Phase 1 §1.2 and
// "Quick-add decisions"). Turns a line like "120 lunch nethu" into the Add
// sheet's prefill, with no network call.
//
// Pure: everything comes in as arguments, and the only import is date-fns.
// Like lib/smsParser.js, it returns null rather than a wrong guess. A null
// sends the line to the model (ticket 02), so being unsure costs a second
// at most, while a wrong answer would be a real mistake the person has to
// spot.
//
// quickParse(text, { categories, accounts, today })
//   categories: [{ id, name, type: 'expense' | 'income' }]
//   accounts:   [{ id, name }]
//   today:      'YYYY-MM-DD' (the person's local date) or a Date
// → { amount, type, categoryId, accountId, date: 'YYYY-MM-DD', note, confidence: 'high' } | null
//
// accountId is null when no account is named; the sheet then uses the
// active account, as it does for a manual entry.

import { format, getDate, getDaysInMonth, isAfter, parseISO, subDays, subMonths, subYears } from 'date-fns';

const MAX_INPUT_LENGTH = 200;
const MAX_SANE_AMOUNT = 10_000_000; // ₹1 crore, the same ceiling as smsParser

// Words that carry no meaning of their own; they never become the note.
const FILLER = new Set([
  'rs', 'rs.', 'inr', '₹', 'rupees', 'rupee', 'spent', 'spend', 'paid', 'pay', 'for', 'on',
  'the', 'a', 'an', 'at', 'in', 'of', 'my', 'bought', 'buy', 'today', 'yesterday',
]);

// Date words. Tanglish (Tamil in English letters) sits beside English.
const DAY_OFFSETS = {
  today: 0, inniki: 0, indru: 0, innaiku: 0, innaikku: 0,
  yesterday: 1, nethu: 1, netru: 1, nethiki: 1,
  munnaal: 2, munnal: 2,
};

const WEEKDAYS = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thurs: 4, friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

// Expense words → the categories they mean, best first. The first one the
// person actually has wins. The lists are generic on purpose: a new account
// starts from the onboarding bank (lib/categoryBank.js), not from any one
// person's names. A category's own name always matches as well.
const EXPENSE_WORDS = {
  lunch: ['Lunch', 'Food'], meal: ['Lunch', 'Food'], meals: ['Lunch', 'Food'],
  dinner: ['Dinner', 'Food'],
  breakfast: ['Breakfast', 'Food'], tiffin: ['Breakfast', 'Food'],
  chai: ['Snacks', 'Coffee', 'Food'], tea: ['Snacks', 'Coffee', 'Food'],
  coffee: ['Snacks', 'Coffee', 'Food'], samosa: ['Snacks', 'Food'],
  snack: ['Snacks', 'Food'], juice: ['Snacks', 'Food'],
  auto: ['Transport', 'Travel'], uber: ['Transport', 'Travel'], ola: ['Transport', 'Travel'],
  rapido: ['Transport', 'Travel'], bus: ['Transport', 'Travel'], metro: ['Transport', 'Travel'],
  train: ['Transport', 'Travel'], cab: ['Transport', 'Travel'], taxi: ['Transport', 'Travel'],
  petrol: ['Fuel', 'Transport'], diesel: ['Fuel', 'Transport'],
  grocery: ['Groceries'], vegetables: ['Groceries'], veggies: ['Groceries'], milk: ['Groceries'],
  dmart: ['Groceries'], blinkit: ['Groceries'], zepto: ['Groceries'], bigbasket: ['Groceries'],
  recharge: ['Bills', 'Utilities'], electricity: ['Bills', 'Utilities'], bill: ['Bills', 'Utilities'],
  wifi: ['Bills', 'Utilities'], broadband: ['Bills', 'Utilities'], internet: ['Bills', 'Utilities'],
  amazon: ['Shopping'], flipkart: ['Shopping'], myntra: ['Shopping'],
  transfer: ['Transfer'], sent: ['Transfer'],
};

// Words that name food but not which meal. On their own they're left to the
// model, which knows the time of day; beside a meal word they're dropped.
const MEAL_HINTS = new Set(['swiggy', 'zomato']);

// Income words → income categories, best first. Any of them makes the entry
// income; Other is the fallback for the generic ones.
const INCOME_WORDS = {
  got: ['Other'], received: ['Other'], credited: ['Other'], mila: ['Other'],
  refund: ['Other'], refunded: ['Other'],
  salary: ['Salary', 'Other'],
  trade: ['Trade', 'Other'], trading: ['Trade', 'Other'], profit: ['Trade', 'Other'],
  amma: ['Amma Sav', 'Other'], mom: ['Amma Sav', 'Other'],
};

// Income words that name a person: money can go to them as well as come
// from them. Next to a word pointing outward ("amma ku", "to mom", "gave")
// the direction is unclear, so the line goes to the model.
const PERSON_INCOME_WORDS = new Set(['amma', 'mom']);
const OUTWARD_WORDS = new Set(['to', 'ku', 'kku', 'gave', 'lent', 'anupinen', 'anuppinen', 'koduthen', 'kuduthen']);

// Words in an account name that don't identify it on their own.
const GENERIC_ACCOUNT_WORDS = new Set(['bank', 'of', 'the', 'account', 'a/c', 'savings', 'current']);

function toDay(today) {
  if (today instanceof Date) return today;
  return parseISO(today);
}

function ymd(date) {
  return format(date, 'yyyy-MM-dd');
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, '$1') // 1,250 → 1250
    .replace(/₹/g, ' ₹ ')
    .replace(/\brs\.?(?=\d)/g, 'rs ') // rs60 → rs 60
    .replace(/(\d)(rs|rupees)\b/g, '$1 $2') // 60rs → 60 rs
    .replace(/[!?,;:"()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function parseAmountToken(token) {
  const match = /^(\d+(?:\.\d+)?)(k)?$/.exec(token);
  if (!match) return null;
  const value = Number(match[1]) * (match[2] ? 1000 : 1);
  return Math.round(value * 100) / 100;
}

// "5th" or "5/11" (always day first). Returns a Date or undefined when the
// token isn't a date at all; null when it looks like one but isn't valid.
function parseDayToken(token, today) {
  const ordinal = /^(\d{1,2})(st|nd|rd|th)$/.exec(token);
  if (ordinal) {
    const day = Number(ordinal[1]);
    // This month, or last month if that day is still ahead.
    let month = today;
    if (day > getDate(today)) month = subMonths(today, 1);
    if (day < 1 || day > getDaysInMonth(month)) return null;
    return new Date(month.getFullYear(), month.getMonth(), day);
  }
  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(token);
  if (slash) {
    const day = Number(slash[1]);
    const monthIndex = Number(slash[2]) - 1;
    let year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : today.getFullYear();
    if (monthIndex < 0 || monthIndex > 11) return null;
    let date = new Date(year, monthIndex, 1);
    if (day < 1 || day > getDaysInMonth(date)) return null;
    date = new Date(year, monthIndex, day);
    // With no year given, a date still ahead means last year's.
    if (!slash[3] && isAfter(date, today)) date = subYears(date, 1);
    return date;
  }
  return undefined;
}

function mostRecentPastWeekday(today, weekday) {
  // 1–7 days back: a weekday name never means today.
  const back = ((today.getDay() - weekday + 7) % 7) || 7;
  return subDays(today, back);
}

// The accounts each word sequence can mean: the full name, each distinctive
// word in it, and the initials of a multi-word name ("bank of baroda" → bob).
function accountMatchers(accounts) {
  const matchers = [];
  for (const account of accounts ?? []) {
    const words = account.name.toLowerCase().split(/\s+/).filter(Boolean);
    matchers.push({ id: account.id, words });
    if (words.length > 1) {
      matchers.push({ id: account.id, words: [words.map((w) => w[0]).join('')] });
      for (const w of words) {
        if (!GENERIC_ACCOUNT_WORDS.has(w)) matchers.push({ id: account.id, words: [w] });
      }
    }
  }
  // Longest first, so a full name claims its words before a shortcut does.
  return matchers.sort((a, b) => b.words.length - a.words.length);
}

function matchesAt(tokens, i, words) {
  if (i + words.length > tokens.length) return false;
  return words.every((w, k) => tokens[i + k] === w);
}

function findCategoryByNames(categories, type, names) {
  for (const name of names) {
    const found = categories.find((c) => c.type === type && c.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }
  return null;
}

export function quickParse(text, { categories = [], accounts = [], today } = {}) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_INPUT_LENGTH) return null;
  const now = toDay(today ?? new Date());
  if (Number.isNaN(now.getTime())) return null;

  const tokens = tokenize(trimmed);
  const used = new Array(tokens.length).fill(false);

  // "day before yesterday", before the single date words claim "yesterday".
  let date = null;
  const setDate = (value) => {
    if (date && ymd(date) !== ymd(value)) return false; // two different dates
    date = value;
    return true;
  };
  for (let i = 0; i < tokens.length; i++) {
    if (matchesAt(tokens, i, ['day', 'before', 'yesterday'])) {
      if (!setDate(subDays(now, 2))) return null;
      used[i] = used[i + 1] = used[i + 2] = true;
    }
  }

  // Amounts and dates.
  const amounts = [];
  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    const token = tokens[i];
    if (token in DAY_OFFSETS) {
      if (!setDate(subDays(now, DAY_OFFSETS[token]))) return null;
      used[i] = true;
      continue;
    }
    if (token in WEEKDAYS) {
      if (!setDate(mostRecentPastWeekday(now, WEEKDAYS[token]))) return null;
      used[i] = true;
      continue;
    }
    const day = parseDayToken(token, now);
    if (day === null) return null; // looked like a date but isn't one
    if (day) {
      if (!setDate(day)) return null;
      used[i] = true;
      continue;
    }
    const amount = parseAmountToken(token);
    if (amount !== null) {
      amounts.push(amount);
      used[i] = true;
    }
  }
  // Exactly one number: "2 chai 40" is the model's call.
  if (amounts.length !== 1) return null;
  const amount = amounts[0];
  if (!(amount > 0) || amount > MAX_SANE_AMOUNT) return null;

  // Accounts. Two different accounts reads as a transfer between them,
  // which quick add doesn't do.
  let accountId = null;
  for (const matcher of accountMatchers(accounts)) {
    for (let i = 0; i < tokens.length; i++) {
      if (used.slice(i, i + matcher.words.length).some(Boolean)) continue;
      if (!matchesAt(tokens, i, matcher.words)) continue;
      if (accountId && accountId !== matcher.id) return null;
      accountId = matcher.id;
      for (let k = 0; k < matcher.words.length; k++) used[i + k] = true;
    }
  }

  // Category names the person has, matched as whole words (longest first).
  const ownNames = [...categories]
    .map((c) => ({ category: c, words: c.name.toLowerCase().split(/\s+/).filter(Boolean) }))
    .sort((a, b) => b.words.length - a.words.length);

  const expenseHits = new Map(); // category id → category
  const incomeHits = new Map();
  let incomeWordSeen = false;
  let expenseWordSeen = false;
  let mealHintSeen = false;

  // A name both types share ("Other", "Gifts") waits until the type is known.
  const sharedHits = [];
  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    const first = ownNames.find(
      ({ words }) => !used.slice(i, i + words.length).some(Boolean) && matchesAt(tokens, i, words)
    );
    if (!first) continue;
    const sameName = ownNames.filter(({ words }) => words.join(' ') === first.words.join(' '));
    const expense = sameName.find(({ category }) => category.type === 'expense')?.category;
    const income = sameName.find(({ category }) => category.type === 'income')?.category;
    if (expense && income) sharedHits.push({ expense, income });
    else if (expense) expenseHits.set(expense.id, expense);
    else if (income) incomeHits.set(income.id, income);
    for (let k = 0; k < first.words.length; k++) used[i + k] = true;
  }

  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    const token = tokens[i];
    const plain = token.replace(/s$/, ''); // "bills" → "bill", "snacks" → "snack"
    if (MEAL_HINTS.has(token)) {
      mealHintSeen = true;
      used[i] = true;
      continue;
    }
    const incomeNames = INCOME_WORDS[token];
    if (incomeNames) {
      if (PERSON_INCOME_WORDS.has(token) && tokens.some((t) => OUTWARD_WORDS.has(t))) return null;
      incomeWordSeen = true;
      const found = findCategoryByNames(categories, 'income', incomeNames);
      if (found) incomeHits.set(found.id, found);
      used[i] = true;
      continue;
    }
    const expenseNames = EXPENSE_WORDS[token] ?? EXPENSE_WORDS[plain];
    if (expenseNames) {
      expenseWordSeen = true;
      const found = findCategoryByNames(categories, 'expense', expenseNames);
      if (found) expenseHits.set(found.id, found);
      used[i] = true;
    }
  }

  // An income word next to an expense word ("sent 2000 to amma", "refund
  // 349 amazon") could go either way.
  const isIncome = incomeWordSeen || (incomeHits.size > 0 && expenseHits.size === 0 && !expenseWordSeen);
  if (isIncome && (expenseWordSeen || expenseHits.size > 0)) return null;
  const type = isIncome ? 'income' : 'expense';
  const typeHits = isIncome ? incomeHits : expenseHits;
  for (const shared of sharedHits) {
    const category = shared[type];
    typeHits.set(category.id, category);
  }

  // One category, or nothing. "Other" gives way to anything more specific.
  const hits = [...typeHits.values()];
  const specific = hits.filter((c) => c.name.toLowerCase() !== 'other');
  const pool = specific.length ? specific : hits;
  if (pool.length !== 1) return null;
  // A bare "swiggy" leaves the meal to the model; beside a meal it's dropped.
  if (mealHintSeen && !expenseWordSeen && expenseHits.size === 0) return null;
  const category = pool[0];

  // The note: whatever is left once the parsed words and filler are gone.
  const leftover = tokens.filter((t, i) => !used[i] && !FILLER.has(t));
  const note = leftover.length ? leftover.join(' ') : null;

  return {
    amount,
    type,
    categoryId: category.id,
    accountId,
    date: ymd(date ?? now),
    note,
    confidence: 'high',
  };
}
