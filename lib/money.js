// The one place this formatting rule lives. Was duplicated identically across
// lib/alerts.js, hooks/useAlerts.js, and lib/notifications.js — hoisted here
// during 05-koban-engagement.md Phase 3 rather than adding a fourth copy for
// lib/koban.js. Always whole rupees, Indian lakh/crore digit grouping.
export function formatMoney(n) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
