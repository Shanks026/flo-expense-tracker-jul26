import { supabase } from './supabase';
import { budgetStatus } from '../hooks/useBudgets';
import { formatMoney } from './money';

// Run right after a successful expense insert (imperative, not a hook) to
// check whether it pushed a relevant budget into warn/over for the current
// period. Checks both the category-specific budget and the overall
// (category_id IS NULL) budget for the account, since either could apply.
export async function budgetToastForSave({ categoryId, accountId }) {
  if (!accountId) return null;

  let query = supabase.from('v_budgets_with_spent').select('*').eq('account_id', accountId);
  query = categoryId ? query.or(`category_id.eq.${categoryId},category_id.is.null`) : query.is('category_id', null);

  const { data, error } = await query;
  if (error || !data) return null;

  let worst = null;
  for (const budget of data) {
    const status = budgetStatus(budget.spent, budget.amount);
    if (status === 'healthy') continue;
    if (!worst || (status === 'over' && worst.status !== 'over')) {
      worst = { status, budget };
    }
  }
  if (!worst) return null;

  const pct = Math.round((worst.budget.spent / worst.budget.amount) * 100);
  const label = worst.budget.category_name ?? 'Overall';
  return worst.status === 'over'
    ? `${label} budget over by ${formatMoney(worst.budget.spent - worst.budget.amount)}`
    : `${label} budget at ${pct}% this month`;
}

// Run right after a successful expense insert with a plan attached — warns
// if the plan's total spend now exceeds its target_amount.
export async function planToastForSave({ planId }) {
  if (!planId) return null;

  const { data: plan, error } = await supabase.from('v_plans_with_totals').select('*').eq('id', planId).maybeSingle();
  if (error || !plan || !plan.target_amount) return null;
  if (plan.total_spent <= plan.target_amount) return null;

  return `Over your ${plan.name} plan by ${formatMoney(plan.total_spent - plan.target_amount)}`;
}
