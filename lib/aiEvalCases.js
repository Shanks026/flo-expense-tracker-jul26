// The phase 1 quick-add test set (44-ai-assistant.md, "Quick-add decisions").
// Pure data: run by the node check script and the dev eval screen.
//
// Every case is read at a fixed moment, so the dates are stable:
// Thursday 12 Nov 2026, 13:30 in India. "nethu"/yesterday = 11 Nov,
// "munnaal"/day before = 10 Nov, "monday" = 9 Nov, "5th" = 5 Nov, and a
// weekday name never means today.
//
// A case passes when amount, type, category, date and account all match.
// The note is listed for reference and isn't scored. `expected: null` means
// the right answer is "couldn't read that".
//
// `category` gives the expected category name for each category set:
// `start` is the onboarding starting set (the gate counts this one), and
// `current` is the person's set on 2026-11-09 (reported only).
// `local: true` means the phone's parser should answer it on the starting
// set, without calling the model.

export const EVAL_NOW = '2026-11-12T13:30:00+05:30';
export const EVAL_TODAY = '2026-11-12';
export const EVAL_TZ = 'Asia/Kolkata';

export const EVAL_ACCOUNTS = [
  { id: 'acc-sbi', name: 'SBI' },
  { id: 'acc-axis', name: 'Axis' },
  { id: 'acc-bob', name: 'Bank of Baroda' },
];
// The account in use when no account is named.
export const EVAL_ACTIVE_ACCOUNT = 'SBI';

export const EVAL_CATEGORY_SETS = {
  start: {
    expense: ['Food', 'Groceries', 'Transport', 'Shopping', 'Bills', 'Rent', 'Other'],
    income: ['Salary', 'Other'],
  },
  current: {
    expense: [
      'Lunch', 'Dinner', 'Breakfast', 'Snacks', 'Sides', 'Transport', 'Fuel', 'Groceries',
      'Bills', 'Rent', 'Shopping', 'Transfer', 'Lend', 'Other',
    ],
    income: ['Salary', 'Trade', 'Amma Sav', 'Business', 'Other'],
  },
};

const T = EVAL_TODAY;
const YDAY = '2026-11-11';
const DBY = '2026-11-10';

function exp(amount, start, current, date = T, account = 'SBI', note = null) {
  return { type: 'expense', amount, category: { start, current }, date, account, note };
}
function inc(amount, start, current, date = T, account = 'SBI', note = null) {
  return { type: 'income', amount, category: { start, current }, date, account, note };
}

export const EVAL_CASES = [
  // Meals and snacks
  { id: 1, text: '120 lunch', local: true, expected: exp(120, 'Food', 'Lunch') },
  { id: 2, text: 'lunch 150 yesterday', local: true, expected: exp(150, 'Food', 'Lunch', YDAY) },
  { id: 3, text: 'dinner 280', local: true, expected: exp(280, 'Food', 'Dinner') },
  { id: 4, text: '₹90 breakfast', local: true, expected: exp(90, 'Food', 'Breakfast') },
  { id: 5, text: 'chai 20', local: true, expected: exp(20, 'Food', 'Snacks') },
  { id: 6, text: '40 tea samosa', local: true, expected: exp(40, 'Food', 'Snacks') },
  { id: 7, text: 'swiggy 340', local: false, expected: exp(340, 'Food', 'Lunch') },
  { id: 8, text: 'zomato dinner 450 axis', local: true, expected: exp(450, 'Food', 'Dinner', T, 'Axis') },
  { id: 9, text: '120 lunch with ravi', local: true, expected: exp(120, 'Food', 'Lunch', T, 'SBI', 'with ravi') },
  { id: 10, text: 'coffee 180 monday', local: true, expected: exp(180, 'Food', 'Snacks', '2026-11-09') },
  { id: 11, text: 'sides 60', local: false, expected: exp(60, 'Food', 'Sides') },
  { id: 12, text: 'paid 250 for lunch on 5th', local: true, expected: exp(250, 'Food', 'Lunch', '2026-11-05') },
  { id: 13, text: 'dinner 1.2k', local: true, expected: exp(1200, 'Food', 'Dinner') },

  // Transport
  { id: 14, text: 'auto rs 60', local: true, expected: exp(60, 'Transport', 'Transport') },
  { id: 15, text: 'uber 230 yesterday', local: true, expected: exp(230, 'Transport', 'Transport', YDAY) },
  { id: 16, text: 'petrol 500', local: true, expected: exp(500, 'Transport', 'Fuel') },
  { id: 17, text: 'rapido 85 bob', local: true, expected: exp(85, 'Transport', 'Transport', T, 'Bank of Baroda') },

  // Groceries
  { id: 18, text: 'groceries 640', local: true, expected: exp(640, 'Groceries', 'Groceries') },
  { id: 19, text: 'dmart 1250 sbi', local: true, expected: exp(1250, 'Groceries', 'Groceries') },

  // Bills, rent, shopping
  { id: 20, text: 'recharge 299', local: true, expected: exp(299, 'Bills', 'Bills') },
  { id: 21, text: 'electricity bill 1840 axis', local: true, expected: exp(1840, 'Bills', 'Bills', T, 'Axis') },
  { id: 22, text: 'rent 12000 on 3/11', local: true, expected: exp(12000, 'Rent', 'Rent', '2026-11-03') },
  { id: 23, text: 'amazon 899', local: true, expected: exp(899, 'Shopping', 'Shopping') },
  { id: 24, text: 'shirt 1200 sunday', local: false, expected: exp(1200, 'Shopping', 'Shopping', '2026-11-08') },

  // Money sent to people (a Transfer-category expense, not an account transfer)
  { id: 25, text: 'transfer 500 to ravi', local: false, expected: exp(500, 'Other', 'Transfer', T, 'SBI', 'to ravi') },
  { id: 26, text: 'sent 2000 to amma', local: false, expected: exp(2000, 'Other', 'Transfer', T, 'SBI', 'to amma') },

  // Income
  { id: 27, text: 'salary 45000', local: true, expected: inc(45000, 'Salary', 'Salary') },
  { id: 28, text: 'got 2000 from ravi', local: true, expected: inc(2000, 'Other', 'Other', T, 'SBI', 'from ravi') },
  { id: 29, text: 'refund 349 amazon', local: false, expected: inc(349, 'Other', 'Other', T, 'SBI', 'amazon') },
  { id: 30, text: 'trade profit 3500', local: true, expected: inc(3500, 'Other', 'Trade') },
  { id: 31, text: 'amma 5000', local: true, expected: inc(5000, 'Other', 'Amma Sav') },
  { id: 32, text: 'credited 1500 sbi', local: true, expected: inc(1500, 'Other', 'Other') },

  // Tanglish, in English letters
  { id: 33, text: 'nethu 200 auto', local: true, expected: exp(200, 'Transport', 'Transport', YDAY) },
  { id: 34, text: 'inniki lunch 130', local: true, expected: exp(130, 'Food', 'Lunch') },
  { id: 35, text: 'munnaal dinner 300', local: true, expected: exp(300, 'Food', 'Dinner', DBY) },
  { id: 36, text: 'amma ku 1000 anupinen', local: false, expected: exp(1000, 'Other', 'Transfer', T, 'SBI', 'amma ku') },

  // Edge cases
  { id: 37, text: '2 chai 40', local: false, expected: exp(40, 'Food', 'Snacks', T, 'SBI', '2 chai') },
  { id: 38, text: 'asdf', local: false, expected: null },
  { id: 39, text: '500 SBI to Axis', local: false, expected: null },
  { id: 40, text: 'lunch', local: false, expected: null },
];
