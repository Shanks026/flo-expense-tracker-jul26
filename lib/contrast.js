// WCAG 2.x contrast between two opaque '#RRGGBB' colours, rounded to two
// places (the figure the WCAG tables in spec 46 quote). No React Native
// imports: scripts/ledger-check.mjs loads it under plain node.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

// AA thresholds: 4.5 for body text, 3 for large text and non-text UI (1.4.11).
export const AA_TEXT = 4.5;
export const AA_UI = 3;
