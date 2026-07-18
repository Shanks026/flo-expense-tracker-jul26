// The single source of truth for currency formatting. Was scattered across ~60
// inline `₹${Math.round(n).toLocaleString('en-IN')}` sites plus lib/money.js and
// AmountText; centralised here (15-currency-going-global.md Phase 1) so that
// per-account currency (Phase 2) becomes a one-argument change at each call
// site rather than another sweep. Everything defaults to INR.

export const CURRENCIES = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'en-IE' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'en-AE' },
  CAD: { code: 'CAD', symbol: '$', name: 'Canadian Dollar', locale: 'en-CA' },
  AUD: { code: 'AUD', symbol: '$', name: 'Australian Dollar', locale: 'en-AU' },
  SGD: { code: 'SGD', symbol: '$', name: 'Singapore Dollar', locale: 'en-SG' },
};

export const DEFAULT_CURRENCY = 'INR';
export const CURRENCY_LIST = Object.values(CURRENCIES);

// An unknown/absent code degrades to the default rather than throwing — a
// missing account currency must always read as INR, never crash a money row.
export function currencyMeta(code) {
  return CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY];
}

export function currencySymbol(code) {
  return currencyMeta(code).symbol;
}

// Up to 2 decimal places, shown only when actually present — a whole number
// still renders with none (no forced "$4.00"), but "$4.56" (cents) is no
// longer destroyed by rounding. `maximumFractionDigits: 2` is what makes
// this safe against stray float noise from division (e.g. an average spend),
// not just deliberate cents. Deliberately NOT Math.abs (mirrors the old
// inline pattern and lib/money.js exactly, so a negative renders "₹-1,234"):
// callers that want a bare magnitude pass Math.abs themselves, as they
// already did. Groups digits per the currency's locale (INR keeps
// lakh/crore via en-IN).
export function formatMoney(amount, code = DEFAULT_CURRENCY) {
  const { symbol, locale } = currencyMeta(code);
  return `${symbol}${amount.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
}

// The grouped number only, no symbol — for AmountText, which renders the symbol
// as a separately-colourable span. Math.abs mirrors AmountText's old
// formatNumber (it prints the sign itself as a prefix).
export function formatAmountNumber(amount, code = DEFAULT_CURRENCY) {
  return Math.abs(amount).toLocaleString(currencyMeta(code).locale, { maximumFractionDigits: 2 });
}

// The shared amount-input filter for every Add*/Pay*Sheet and onboarding
// money field: keeps digits and at most one decimal point, capped to 2
// fractional digits (a real subunit — cents/paise/fils — never a longer
// float). Typing "4.567" clamps to "4.56" as you type, rather than silently
// rejecting the keystroke or accepting unbounded precision.
export function sanitizeAmountInput(text) {
  let cleaned = text.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  const whole = cleaned.slice(0, firstDot);
  const fraction = cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
  return `${whole}.${fraction}`;
}
