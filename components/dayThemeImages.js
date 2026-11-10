// The Day card's four landscapes (lib/dayScenes.js names them by key).
// Kept apart from lib/dayScenes.js because node, which runs
// scripts/ledger-check.mjs, can't require() a .jpg. Resized from the
// person's originals in day-themes/ to 1200 px wide, about 40 KB each.
export const DAY_THEME_IMAGES = {
  morning: require('../assets/day-themes/morning.jpg'),
  afternoon: require('../assets/day-themes/afternoon.jpg'),
  evening: require('../assets/day-themes/evening.jpg'),
  night: require('../assets/day-themes/night.jpg'),
};
