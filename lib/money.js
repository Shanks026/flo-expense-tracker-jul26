// Was the one place this formatting rule lived (hoisted here during
// 05-koban-engagement.md Phase 3). Now a thin delegate to lib/currency.js, the
// real single source of truth since 15-currency-going-global.md Phase 1 — kept
// as a named re-export so its callers (lib/alerts.js, hooks/useAlerts.js,
// lib/notifications.js, lib/koban.js) don't need to change. Defaults to INR.
import { formatMoney as formatCurrency } from './currency';

export function formatMoney(n) {
  return formatCurrency(n);
}
