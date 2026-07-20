// Home's welcome title/subtitle — varies by time of day AND day of week
// (28 fixed combinations, not random) so the header has some life to it
// without needing any new data source. Deliberately NOT dynamic/data-driven
// yet (no streak/budget-aware copy) — that's the next step once there's
// real signal to react to; this is just the static baseline it'll build on.
//
// Voice matches the rest of the app (see 05-koban-engagement.md's "Voice
// rules"): sentence case, no exclamation marks, no emoji, second person,
// never shames spending — only gently nudges toward checking in. "Here's
// where things stand" over "Let's see how much you spent!!"
const TIME_BUCKETS = [
  { end: 5, key: 'night' }, // 00:00–04:59 counts as the previous evening's "night"
  { end: 12, key: 'morning' },
  { end: 17, key: 'afternoon' },
  { end: 21, key: 'evening' },
  { end: 24, key: 'night' },
];

function timeBucket(hour) {
  return TIME_BUCKETS.find((b) => hour < b.end).key;
}

// Keyed by Date#getDay() (0 = Sunday) then time bucket.
const GREETINGS = {
  0: {
    morning: { title: '{name}, Sunday morning', subtitle: 'A quiet look before the week ahead.' },
    afternoon: { title: 'Lazy Sunday, {name}?', subtitle: "Here's where things stand, whenever you're ready." },
    evening: { title: 'One day left, {name}', subtitle: 'Worth a look before Monday shows up.' },
    night: { title: 'Late Sunday, {name}', subtitle: "Here's today, before the week turns over." },
  },
  1: {
    morning: { title: 'A clean slate, {name}', subtitle: "Here's where you're starting the week from." },
    afternoon: { title: "How's Monday treating you, {name}?", subtitle: "Here's the picture so far." },
    evening: { title: "First day's done, {name}", subtitle: "Here's how Monday actually went." },
    night: { title: "Monday's over, {name}", subtitle: 'One last look before you log off.' },
  },
  2: {
    morning: { title: 'Tuesday, {name}', subtitle: "Keep yesterday's momentum going." },
    afternoon: { title: '{name}, quick Tuesday check-in', subtitle: "Here's where things stand right now." },
    evening: { title: 'Two days in, {name}', subtitle: 'See how Tuesday shaped up.' },
    night: { title: 'Still up, {name}?', subtitle: "Here's today, whenever you're ready." },
  },
  3: {
    morning: { title: 'Halfway there, {name}', subtitle: "Wednesday's off to a start." },
    afternoon: { title: 'Hump day, {name}', subtitle: "Here's how the week's tracking." },
    evening: { title: 'Over the hump, {name}', subtitle: "Two days down — here's the tally." },
    night: { title: '{name}, midweek and quiet', subtitle: 'A calm moment to check in.' },
  },
  4: {
    morning: { title: 'Thursday, {name}', subtitle: 'One more day before the weekend.' },
    afternoon: { title: 'Nearly there, {name}', subtitle: "Here's where things stand." },
    evening: { title: 'So close, {name}', subtitle: 'See how Thursday wrapped up.' },
    night: { title: 'Almost Friday, {name}', subtitle: "The weekend's close — here's today." },
  },
  5: {
    morning: { title: "It's Friday, {name}", subtitle: 'See the week out clearly.' },
    afternoon: { title: "{name}, Friday's almost done", subtitle: "Here's where the week's landed." },
    evening: { title: "Weekend's here, {name}", subtitle: 'Worth knowing where you stand before you unwind.' },
    night: { title: 'Friday night, {name}', subtitle: 'Here’s today, before the weekend starts.' },
  },
  6: {
    morning: { title: 'Saturday, {name}', subtitle: "Whatever today holds, here's your starting point." },
    afternoon: { title: 'Easy Saturday, {name}', subtitle: 'A relaxed look at where things stand.' },
    evening: { title: "{name}, how's Saturday going?", subtitle: 'How the day treated your wallet.' },
    night: { title: 'Saturday night, {name}', subtitle: "A quiet check before you're off." },
  },
};

// `date` is an injectable param (not just `new Date()` internally) purely
// so this is trivial to unit-test/preview per day+hour without messing
// with the system clock.
export function getGreeting(date, name) {
  const entry = GREETINGS[date.getDay()][timeBucket(date.getHours())];
  return {
    // `name` should always be a real string by the time it gets here (Home
    // guards on `session` before calling this) — but `.replace()` silently
    // stringifies a missing second argument ("Tuesday, undefined"), so a
    // defensive fallback costs nothing and keeps this safe for any future
    // caller that isn't as careful.
    title: entry.title.replace('{name}', name || 'there'),
    subtitle: entry.subtitle,
  };
}
