// 13-ai-features.md Phase 2 (category-onboarding revamp) — the curated OPTIONAL
// category bank shown on the onboarding categories screen. These are NOT
// auto-seeded by handle_new_user (see the absolute set there: Food/Shopping/
// Bills/Other expense, Salary/Other income) — a user opts into any of these,
// and only the ones picked get inserted (is_default: true, same as the
// absolute set — both are FLO's own curated categories, as opposed to a
// freeform one typed later via AddCategorySheet, which stays is_default: false).
export const CATEGORY_BANK = {
  expense: [
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
    { name: 'Freelance', icon: 'freelance', color: '#E8A317' },
    { name: 'Business', icon: 'business', color: '#3D4F7D' },
    { name: 'Investments', icon: 'investment', color: '#4C7031' },
    { name: 'Rental Income', icon: 'home', color: '#3B6FA0' },
    { name: 'Gifts', icon: 'gift', color: '#D9738F' },
  ],
};
