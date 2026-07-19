// Tiny hex-color helpers — lighten/darken by blending toward white/black.
// Pure, no React/Supabase imports, same discipline as lib/rewards.js. Used
// to derive a card theme's income/expense trend-icon colors from its own
// `chipColor` (19-card-themes.md) instead of a fixed semantic green/red,
// which read as a clash against several themes' own accent hues.

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex({ r, g, b }) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

// `amount` is 0–1, blended toward white.
export function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r + (255 - r) * amount, g: g + (255 - g) * amount, b: b + (255 - b) * amount });
}

// `amount` is 0–1, blended toward black.
export function darken(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r * (1 - amount), g: g * (1 - amount), b: b * (1 - amount) });
}

// Returns an `rgba()` string at the given alpha (0–1) — a genuine translucent
// version of `hex`, not a different, separately-chosen color. Used for every
// card theme's muted subtext/currency tint (lib/cardThemes.js): a real alpha
// composite reads correctly against ANY background behind it (solid, a
// gradient, a pattern), which a single flat "muted grey" hex picked against
// one assumed background can't guarantee across every theme.
export function withOpacity(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
