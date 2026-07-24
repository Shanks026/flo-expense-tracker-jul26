// The full curated set of categories the onboarding categories screen picks
// from (28-onboarding-welcome-bundle.md follow-up, 2026-07-22) — expense and
// income, ALL toggleable, no separate "locked/absolute" tier. `preselected`
// items are checked by default (they're what `handle_new_user` used to
// auto-seed server-side before this redesign); everything else starts
// unchecked. Whatever ends up selected when the user hits Continue is what
// gets inserted — this screen is now the SOLE place a new signup's starting
// categories come from.
//
// Redesigned to remove a real, measured cost: the old two-tier system (DB
// auto-seed + a live fetch on this screen just to know what the trigger
// already inserted) made this screen wait on a network round-trip — ~2-3s —
// before it could render anything interactive. A single static, local array
// has no such cost; the only network call left is the one deliberate insert
// on Continue. See categories_unique_and_stop_auto_seed migration
// (00-index.md) for the DB side of this change.
export const CATEGORY_BANK = {
  expense: [
    { name: 'Food', icon: 'food', color: '#E8785A', preselected: true },
    { name: 'Shopping', icon: 'shopping', color: '#8A5FBF', preselected: true },
    { name: 'Bills', icon: 'bills', color: '#5B6B8C', preselected: true },
    { name: 'Other', icon: 'other', color: '#3A3A3A', preselected: true },
    { name: 'Travel', icon: 'travel', color: '#2F8F82' },
    { name: 'Coffee', icon: 'coffee', color: '#B98A2E' },
    { name: 'Groceries', icon: 'groceries', color: '#4C7031' },
    { name: 'Rent', icon: 'home', color: '#3B6FA0' },
    { name: 'Transport', icon: 'car', color: '#5B6B8C' },
    { name: 'Entertainment', icon: 'entertainment', color: '#8A5FBF' },
    { name: 'Health', icon: 'health', color: '#D9738F' },
    { name: 'Education', icon: 'education', color: '#3D4F7D' },
    { name: 'Fitness', icon: 'fitness', color: '#B5443D' },
    { name: 'Subscriptions', icon: 'subscriptions', color: '#D4B106' },
    { name: 'Insurance', icon: 'insurance', color: '#3A3A3A' },
    { name: 'Pets', icon: 'pets', color: '#E8A317' },
    { name: 'Kids', icon: 'kids', color: '#E8785A' },
    { name: 'Utilities', icon: 'utilities', color: '#8A5FBF' },
    { name: 'Gifts', icon: 'gift', color: '#D9738F' },
  ],
  income: [
    { name: 'Salary', icon: 'salary', color: '#BBDC12', preselected: true },
    { name: 'Other', icon: 'other', color: '#D9738F', preselected: true },
    { name: 'Freelance', icon: 'freelance', color: '#E8A317' },
    { name: 'Business', icon: 'business', color: '#3D4F7D' },
    { name: 'Investments', icon: 'investment', color: '#4C7031' },
    { name: 'Rental Income', icon: 'home', color: '#3B6FA0' },
    { name: 'Gifts', icon: 'gift', color: '#D9738F' },
  ],
};
