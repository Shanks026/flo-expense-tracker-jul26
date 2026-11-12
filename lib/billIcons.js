// Bill icons from names (spec 48, ticket 05; redesign plan §2.6). Pure, with
// no React Native imports, so scripts/ledger-check.mjs checks it under node.
//
// BILL_ICON_KEYS is FLO's icon set for bills: the category icon keys plus
// four bill ones. components/CategoryIcon.js draws every key, and the
// ai-assistant function keeps a copy of the list (billIcon.ts); the check
// script holds all three together.
//
// iconForBillName(name) is the local keyword map, tried before any Ask FLO
// call: case-insensitive, matched on whole words (or a word's start, for
// keys of 4+ letters), phrases first. Families run from the most specific
// (streaming, DTH, broadband) to the general (phone), so "Airtel DTH" is TV,
// "Jio Fiber" is broadband and "JioCinema" is entertainment, not a phone bill.
// Indian names first. No brand logos: names only pick one of FLO's icons.

export const BILL_ICON_KEYS = [
  'food', 'travel', 'shopping', 'bills', 'coffee', 'groceries', 'salary', 'freelance', 'other', 'home', 'car', 'gift',
  'entertainment', 'health', 'education', 'phone', 'fitness', 'savings', 'subscriptions', 'insurance', 'pets', 'kids',
  'utilities', 'business', 'investment', 'wifi', 'water', 'gas', 'tv',
];

const RULES = [
  ['entertainment', ['netflix', 'prime', 'hotstar', 'disney', 'spotify', 'youtube', 'sonyliv', 'zee5', 'jiocinema', 'gaana', 'apple music', 'wynk']],
  ['tv', ['dth', 'tata play', 'tata sky', 'dish', 'd2h', 'sun direct', 'cable tv']],
  ['wifi', ['broadband', 'wifi', 'wi fi', 'fibernet', 'fiber', 'fibre', 'internet', 'act', 'hathway', 'excitel', 'xstream']],
  ['utilities', ['electricity', 'power', 'bescom', 'tneb', 'tangedco', 'mseb', 'msedcl', 'bses', 'kseb', 'cesc', 'current bill']],
  ['water', ['water', 'bwssb', 'jal board']],
  ['gas', ['gas', 'lpg', 'cylinder', 'indane', 'bharat gas', 'hp gas', 'mgl', 'igl']],
  ['home', ['rent', 'maintenance', 'society', 'hostel']],
  ['insurance', ['lic', 'insurance', 'policy', 'premium', 'mediclaim']],
  ['investment', ['sip', 'mutual fund', 'ppf', 'nps', 'zerodha', 'groww', 'stocks']],
  ['business', ['emi', 'loan']],
  ['education', ['school', 'tuition', 'fees', 'college', 'coaching']],
  ['fitness', ['gym', 'cult', 'yoga', 'fitness']],
  ['bills', ['credit card', 'card bill']],
  ['car', ['fastag', 'petrol', 'fuel', 'parking']],
  ['health', ['doctor', 'medicine', 'pharmacy', 'hospital']],
  ['subscriptions', ['subscription', 'icloud', 'google one', 'membership']],
  ['phone', ['jio', 'airtel', 'vi', 'vodafone', 'idea', 'bsnl', 'mobile', 'recharge', 'postpaid', 'prepaid']],
];

function words(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function matches(ws, key) {
  const parts = key.split(' ');
  if (parts.length > 1) {
    // A phrase: its words in a row.
    return ws.some((_, i) => parts.every((p, j) => ws[i + j] === p));
  }
  return ws.some((w) => w === key || (key.length >= 4 && w.startsWith(key)));
}

export function iconForBillName(name) {
  if (typeof name !== 'string') return null;
  const ws = words(name);
  if (!ws.length) return null;
  for (const [icon, keys] of RULES) {
    if (keys.some((k) => matches(ws, k))) return icon;
  }
  return null;
}

// The icon a bill shows: its own (if FLO knows the key), else its category's,
// else a receipt.
export function billIconKey(bill) {
  if (bill?.icon && BILL_ICON_KEYS.includes(bill.icon)) return bill.icon;
  return bill?.category?.icon ?? 'bills';
}
