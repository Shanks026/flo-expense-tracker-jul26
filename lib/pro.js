// Single source of truth for FLO Pro — gates, ProUpsellSheet, and app/pro.js
// all read from here so limits/pricing/benefits never drift between surfaces.
// See .claude/features/14-subscription-pro.md.

// `splits` counts OPEN splits, not splits ever created (31-split-expenses.md
// §1.4): a Free user can run trip after trip by closing each one first, so the
// gate caps concurrency rather than usage. Chosen over a lifetime cap because a
// hard "you've used your one split, ever" reads as broken on first contact.
export const FREE_LIMITS = { accounts: 1, budgets: 2, plans: 1, splits: 1 };

// The annual plan's cost expressed as a monthly rate (₹699 / 12 ≈ 58.25,
// floored) — a teaser figure for ProUpsellSheet's CTA and the annual plan
// card's sub line, not a purchasable plan on its own. What's actually
// charged is the ₹699/year lump sum.
export const PRO_MONTHLY_EQUIVALENT = '₹58';

export const PRO_PRICING = {
  monthly: { label: 'Monthly', price: '₹99', sub: 'per month' },
  // `badge` is optional — only the annual plan carries a savings badge,
  // rendered beside its price rather than folded into `sub`.
  annual: { label: 'Annual', price: '₹699', sub: `${PRO_MONTHLY_EQUIVALENT}/month · per year`, badge: 'Save 41%' },
  lifetime: { label: 'Lifetime', price: '₹1,499', sub: 'one-time' },
};

// icon keys map to lucide-react-native components inside ProBenefits/app/pro.js
// — not through CategoryIcon, since these aren't categories.
export const PRO_BENEFITS = [
  { icon: 'layers', title: 'Unlimited accounts', body: 'Personal, family, or business. As many ledgers as you need.' },
  { icon: 'target', title: 'Unlimited budgets & plans', body: 'Track every goal, not just a couple.' },
  { icon: 'users', title: 'Unlimited splits', body: 'Run every trip and dinner at once, not one at a time.' },
  { icon: 'calendar', title: 'Custom budget periods', body: 'Any date range, not just weekly or monthly.' },
  { icon: 'fileText', title: 'Full reports', body: 'Custom ranges, all accounts at once, CSV export.' },
];
