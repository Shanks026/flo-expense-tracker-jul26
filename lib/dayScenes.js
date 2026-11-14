// "Day": the default card art (redesign, Home hero, 2026-11-10). The card
// shows a landscape for the time of day: morning, afternoon, evening and
// night. It replaces the plain Ink card as what everyone sees first. An
// equipped theme (a seasonal skin or any other design) still wins.
//
// Pure data, no React (same discipline as lib/cardThemes.js), so
// scripts/ledger-check.mjs can load it under node. Each scene is a painted
// landscape image (assets/day-themes/<period>.jpg, 2026-11-10, replacing the
// hand-drawn SVGs). The background names the image by `image` key; the
// require() lives in components/dayThemeImages.js, because node can't load
// a .jpg. The card shows it with "cover", so a 2:1 card crops a little off
// the sides. As in spec 43's skin rule, the top-left (where the account
// name sits) is plain sky, and the sun and moon sit to the right.
//
// `color` is the top-left sky, sampled from each image: the fill shown
// while the image decodes, and the colour textColor is checked against
// (scripts/ledger-check.mjs, AA body text).

export const DAY_THEMES = {
  morning: { id: 'day-morning', name: 'Morning', textColor: '#1F2A2E', background: { type: 'image', image: 'morning', color: '#A1D4FC' } },
  afternoon: { id: 'day-afternoon', name: 'Afternoon', textColor: '#13242C', background: { type: 'image', image: 'afternoon', color: '#62BFFC' } },
  evening: { id: 'day-evening', name: 'Evening', textColor: '#FFFFFF', background: { type: 'image', image: 'evening', color: '#96629E' } },
  night: { id: 'day-night', name: 'Night', textColor: '#FFFFFF', background: { type: 'image', image: 'night', color: '#071A4C' } },
};

export const DAY_PERIODS = ['morning', 'afternoon', 'evening', 'night'];

// 5–12 morning, 12–17 afternoon, 17–20 evening, 20–5 night (local time).
export function dayPeriod(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 20) return 'evening';
  return 'night';
}

export const GREETINGS = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Good night',
};
