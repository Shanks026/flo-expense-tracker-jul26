// "Day": the default card art (redesign, Home hero, 2026-11-10). The card
// shows a landscape for the time of day: morning, afternoon, evening and
// night. It replaces the plain Ink card as what everyone sees first. An
// equipped theme (a seasonal skin or any other design) still wins.
//
// Pure data, no React (same discipline as lib/cardThemes.js). Each scene is
// one static SVG in the same 360×180 space as lib/cardScenes.js, drawn with
// "xMidYMid slice" so a 2:1 card shows all of it. Following spec 43's skin
// rule, the top-left (where the account name sits) is plain sky, and the sun,
// moon and anything bright sit in the right third.

const W = 360;
const H = 180;

const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;

const MORNING = svg(`
  <defs>
    <linearGradient id="mSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#CFE6F7"/>
      <stop offset="0.6" stop-color="#FBE3D2"/>
      <stop offset="1" stop-color="#FFD6B3"/>
    </linearGradient>
    <radialGradient id="mGlow">
      <stop offset="0" stop-color="#FFE3A3" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#FFE3A3" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#mSky)"/>
  <circle cx="282" cy="112" r="66" fill="url(#mGlow)"/>
  <circle cx="282" cy="112" r="24" fill="#FFC56E"/>
  <g fill="#FFFFFF" opacity="0.85">
    <ellipse cx="214" cy="54" rx="26" ry="7"/>
    <ellipse cx="231" cy="48" rx="15" ry="8"/>
    <ellipse cx="322" cy="64" rx="20" ry="5"/>
  </g>
  <g fill="none" stroke="#5B6670" stroke-width="1.4" stroke-linecap="round">
    <path d="M236 86 q4 -4 8 0 q4 -4 8 0"/>
    <path d="M257 76 q3 -3 6 0 q3 -3 6 0"/>
  </g>
  <path d="M0 128 C50 112 90 118 140 126 C190 134 230 110 280 108 C320 106 345 114 360 118 V180 H0 Z" fill="#BCD5C6"/>
  <path d="M0 146 C60 130 110 138 160 148 C210 158 260 128 310 130 C335 131 350 136 360 140 V180 H0 Z" fill="#8AB79F"/>
  <path d="M0 166 C70 156 130 162 200 168 C260 172 310 152 360 156 V180 H0 Z" fill="#5F957A"/>
`);

const AFTERNOON = svg(`
  <defs>
    <linearGradient id="aSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7CC6F0"/>
      <stop offset="0.65" stop-color="#C4E8FA"/>
      <stop offset="1" stop-color="#E8F7FD"/>
    </linearGradient>
    <radialGradient id="aGlow">
      <stop offset="0" stop-color="#FFF4C2" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#FFF4C2" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#aSky)"/>
  <circle cx="308" cy="42" r="44" fill="url(#aGlow)"/>
  <circle cx="308" cy="42" r="16" fill="#FFE27A"/>
  <g fill="#FFFFFF">
    <ellipse cx="226" cy="74" rx="30" ry="10"/>
    <circle cx="214" cy="68" r="11"/>
    <circle cx="232" cy="63" r="14"/>
    <ellipse cx="300" cy="96" rx="22" ry="7" opacity="0.9"/>
    <circle cx="306" cy="91" r="9" opacity="0.9"/>
  </g>
  <path d="M0 132 C60 120 100 126 150 132 C200 138 250 116 300 116 C330 116 348 120 360 124 V180 H0 Z" fill="#A9D891"/>
  <path d="M0 150 C70 138 120 146 170 154 C220 162 270 138 320 140 C340 141 352 144 360 146 V180 H0 Z" fill="#78BC62"/>
  <rect x="317" y="116" width="4" height="26" rx="1.5" fill="#6B4A2E"/>
  <circle cx="319" cy="110" r="13" fill="#3F8C3B"/>
  <circle cx="310" cy="117" r="9" fill="#3F8C3B"/>
  <circle cx="329" cy="117" r="9" fill="#377F34"/>
  <path d="M0 168 C80 158 140 164 210 170 C270 174 320 158 360 160 V180 H0 Z" fill="#529F48"/>
`);

const EVENING = svg(`
  <defs>
    <linearGradient id="eSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3B2B6C"/>
      <stop offset="0.5" stop-color="#A9507C"/>
      <stop offset="0.8" stop-color="#F29A60"/>
      <stop offset="1" stop-color="#FBC57A"/>
    </linearGradient>
    <radialGradient id="eGlow">
      <stop offset="0" stop-color="#FFD48A" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#FFB46A" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#eSky)"/>
  <g fill="#FFF3D6">
    <circle cx="300" cy="22" r="1.1" opacity="0.8"/>
    <circle cx="336" cy="34" r="0.9" opacity="0.6"/>
    <circle cx="262" cy="16" r="0.8" opacity="0.5"/>
  </g>
  <circle cx="288" cy="134" r="70" fill="url(#eGlow)"/>
  <circle cx="288" cy="134" r="28" fill="#FFD27A"/>
  <path d="M0 132 C50 118 100 124 150 132 C200 140 240 118 290 120 C325 121 345 126 360 130 V180 H0 Z" fill="#7A4676"/>
  <path d="M0 150 C60 136 115 144 165 152 C215 160 265 136 315 138 C338 139 352 142 360 144 V180 H0 Z" fill="#53305F"/>
  <path d="M0 168 C70 158 130 164 200 170 C260 174 310 156 360 158 V180 H0 Z" fill="#311D43"/>
`);

const NIGHT = svg(`
  <defs>
    <linearGradient id="nSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0A1430"/>
      <stop offset="0.6" stop-color="#1A2A5C"/>
      <stop offset="1" stop-color="#2B3C72"/>
    </linearGradient>
    <radialGradient id="nGlow">
      <stop offset="0" stop-color="#F5EBC6" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#F5EBC6" stop-opacity="0"/>
    </radialGradient>
    <mask id="nMoon">
      <rect width="${W}" height="${H}" fill="#fff"/>
      <circle cx="301" cy="45" r="16" fill="#000"/>
    </mask>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#nSky)"/>
  <g fill="#FFFFFF">
    <circle cx="214" cy="30" r="1" opacity="0.7"/>
    <circle cx="240" cy="62" r="0.8" opacity="0.5"/>
    <circle cx="258" cy="22" r="1.2" opacity="0.9"/>
    <circle cx="330" cy="84" r="0.9" opacity="0.6"/>
    <circle cx="344" cy="24" r="1.1" opacity="0.8"/>
    <circle cx="186" cy="78" r="0.8" opacity="0.4"/>
    <circle cx="150" cy="44" r="0.8" opacity="0.4"/>
    <circle cx="272" cy="92" r="0.7" opacity="0.5"/>
  </g>
  <circle cx="292" cy="52" r="46" fill="url(#nGlow)"/>
  <circle cx="292" cy="52" r="18" fill="#F5EBC6" mask="url(#nMoon)"/>
  <path d="M0 134 C50 120 100 126 150 134 C200 142 240 122 290 122 C325 122 345 128 360 132 V180 H0 Z" fill="#1D2856"/>
  <path d="M0 152 C60 138 115 146 165 154 C215 162 265 140 315 142 C338 143 352 146 360 148 V180 H0 Z" fill="#141C43"/>
  <path d="M262 141 l12 -10 l12 10 v14 h-24 Z" fill="#0E1533"/>
  <rect x="270" y="143" width="5" height="5" rx="0.8" fill="#FFD27A"/>
  <path d="M0 168 C70 158 130 164 200 170 C260 174 310 158 360 160 V180 H0 Z" fill="#0B112B"/>
`);

// textColor is checked against the top-left sky, where the name sits:
// morning #1F2A2E on #CFE6F7 and afternoon #13242C on #7CC6F0 are both well
// above 7:1, and white on the evening and night skies is above 10:1.
export const DAY_THEMES = {
  morning: { id: 'day-morning', name: 'Morning', textColor: '#1F2A2E', background: { type: 'svg', xml: MORNING, color: '#CFE6F7' } },
  afternoon: { id: 'day-afternoon', name: 'Afternoon', textColor: '#13242C', background: { type: 'svg', xml: AFTERNOON, color: '#7CC6F0' } },
  evening: { id: 'day-evening', name: 'Evening', textColor: '#FFFFFF', background: { type: 'svg', xml: EVENING, color: '#3B2B6C' } },
  night: { id: 'day-night', name: 'Night', textColor: '#FFFFFF', background: { type: 'svg', xml: NIGHT, color: '#0A1430' } },
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
