// Illustrated card scenes (43-themes-back-unlocked.md, Phase 1b). Generated
// from the animated sample in .scratch/skin-samples/christmas-card.svg; edit
// the sample, then regenerate with .scratch/skin-samples/gen-card-scenes.js
// rather than editing these strings by hand.
//
// A scene is a stack of layers in one 360×180 coordinate space, each drawn
// full-card with preserveAspectRatio "xMidYMid slice" so they line up at any
// card size. Static layers are plain SVG; a layer with `motion` is moved by
// components/AnimatedCardScene.js (Reanimated, about 5 seconds, then it
// settles; nothing moves with Reduce motion). `sceneXml` joins every layer
// into one static SVG for places that don't animate (Personalize's grid).
//
// Every scene keeps Home's text side clear: text sits in the left two-thirds,
// the art and anything bright in the right third.

export const SCENE_W = 360;
export const SCENE_H = 180;

const DEFS = `<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#0B3127"/>
  <stop offset="1" stop-color="#061B16"/>
  </linearGradient>
  <linearGradient id="textShade" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
  <stop offset="0.45" stop-color="#000" stop-opacity="0.4"/>
  <stop offset="0.7" stop-color="#000" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="starGlow">
  <stop offset="0" stop-color="#FFE7A0" stop-opacity="0.55"/>
  <stop offset="1" stop-color="#FFE7A0" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="stableGlow" cx="0.5" cy="0.75" r="0.7">
  <stop offset="0" stop-color="#FFC765" stop-opacity="0.95"/>
  <stop offset="1" stop-color="#E07B2A" stop-opacity="0.35"/>
  </radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FFE08A"/>
  <stop offset="1" stop-color="#D9A030"/>
  </linearGradient>
</defs>`;

function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_W} ${SCENE_H}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">${DEFS}${inner}</svg>`;
}

// Christmas: a night-green sky with a dark background tree, fairy lights,
// two bells with a bow and holly, the star over a lit crib (Mary, the child
// in the manger, Joseph), pines and snow. A scrim darkens the text side:
// worst contrast behind text is white 12.7:1, muted 9.6:1, #FF8F8F 5.8:1.
// Motion matches the sample: bulbs blink, the bells swing about the bow,
// the star swells, its halo and the stable's glow pulse, the sky twinkles.
const CHRISTMAS_LAYERS = [
  {
    id: 'base',
    motion: null,
    inner: `
    <rect width="360" height="180" fill="url(#sky)"/>
    <g>
    <g fill="#0C3329" stroke="#0F3A2F" stroke-width="1.2" stroke-linejoin="round">
    <path d="M178 114 L244 170 Q211 164 178 170 Q145 164 112 170 Z"/>
    <path d="M178 82 L232 142 Q205 136 178 142 Q151 136 124 142 Z"/>
    <path d="M178 52 L218 104 Q198 99 178 104 Q158 99 138 104 Z"/>
    <path d="M178 30 L204 70 Q191 66 178 70 Q165 66 152 70 Z"/>
    </g>
    <g fill="none" stroke="#103C31" stroke-width="1.4" stroke-linecap="round">
    <path d="M156 64 Q178 74 200 62"/>
    <path d="M144 96 Q178 110 214 94"/>
    <path d="M132 132 Q178 148 226 130"/>
    <path d="M122 162 Q178 176 238 160"/>
    </g>
    <g fill="#124236">
    <circle cx="170" cy="58" r="2.4"/><circle cx="190" cy="90" r="2.6"/>
    <circle cx="160" cy="118" r="2.6"/><circle cx="204" cy="124" r="2.6"/>
    <circle cx="146" cy="152" r="2.8"/><circle cx="184" cy="156" r="2.8"/><circle cx="222" cy="150" r="2.6"/>
    </g>
    <path d="M178 21 L180.4 27 L186.6 27.2 L181.7 31 L183.4 37 L178 33.4 L172.6 37 L174.3 31 L169.4 27.2 L175.6 27 Z" fill="#124236"/>
    </g>
    <rect width="360" height="180" fill="url(#textShade)"/>
    <g fill="#0B4D38">
    <path d="M234 168 L247 134 L260 168 Z"/>
    <path d="M238 150 L247 122 L256 150 Z"/>
    <path d="M346 168 L356 140 L366 168 Z"/>
    </g>
    <g fill="#EAF3F0" opacity="0.85">
    <path d="M242 133 L247 122 L252 133 Q247 130 242 133 Z"/>
    <path d="M352 150 L356 140 L360 150 Q356 147 352 150 Z"/>
    </g>
    `,
  },
  {
    id: 'starHalo',
    motion: { type: 'pulse', from: 1, to: 0.75, period: 2400, reps: 2 },
    inner: `
    <circle cx="300" cy="40" r="28" fill="url(#starGlow)"/>
    `,
  },
  {
    id: 'star',
    motion: { type: 'scale', to: 1.14, origin: [300, 40], period: 2400, reps: 2 },
    inner: `
    <path fill="#FFE08A"
    d="M300 20 L303.5 37 L318 40 L303.5 43 L300 61 L296.5 43 L282 40 L296.5 37 Z"/>
    <circle cx="300" cy="40" r="2.6" fill="#FFF6D6"/>
    `,
  },
  {
    id: 'glow',
    motion: { type: 'pulse', from: 1, to: 0.75, period: 2400, reps: 2 },
    inner: `
    <rect x="262" y="102" width="80" height="64" fill="url(#stableGlow)"/>
    `,
  },
  {
    id: 'crib',
    motion: null,
    inner: `
    <g fill="#5B3A22">
    <rect x="258" y="100" width="6" height="68" rx="1.5"/>
    <rect x="340" y="100" width="6" height="68" rx="1.5"/>
    </g>
    <path d="M246 106 L302 72 L358 106 L350 110 L302 81 L254 110 Z" fill="#7A4E2C"/>
    <g stroke="#A8743F" stroke-width="1.2" stroke-linecap="round" opacity="0.8">
    <path d="M266 96 L270 102"/><path d="M279 88 L283 94"/><path d="M292 80 L295 86"/>
    <path d="M312 80 L309 86"/><path d="M325 88 L321 94"/><path d="M338 96 L334 102"/>
    </g>
    <path d="M278 127 Q270 129 269 135 L266 166 L290 166 L287 135 Q286 129 278 127 Z" fill="#3E6FB0"/>
    <circle cx="278" cy="122" r="6.6" fill="#3E6FB0"/>
    <circle cx="278" cy="123.5" r="4.6" fill="#F2D3B0"/>
    <circle cx="302" cy="142" r="10" fill="url(#starGlow)"/>
    <ellipse cx="302" cy="144" rx="8" ry="4" fill="#FFF3DC"/>
    <circle cx="308" cy="142" r="2.6" fill="#F2D3B0"/>
    <path d="M288 147 L316 147 L311 157 L293 157 Z" fill="#8A5A34"/>
    <g stroke="#E9C46A" stroke-width="1" stroke-linecap="round">
    <path d="M290 147 L287 143"/><path d="M295 147 L294 142"/><path d="M311 147 L313 142"/><path d="M315 147 L318 143"/>
    </g>
    <g stroke="#6B4426" stroke-width="2" stroke-linecap="round">
    <path d="M294 157 L291 166"/><path d="M310 157 L313 166"/>
    </g>
    <path d="M326 125 Q318 127 317 133 L314 166 L336 166 L333 133 Q332 127 326 125 Z" fill="#8A5A3B"/>
    <circle cx="326" cy="120" r="6.4" fill="#C7A47A"/>
    <circle cx="326" cy="121.5" r="4.5" fill="#E6C29C"/>
    <path d="M337 112 L337 166" stroke="#5B3A22" stroke-width="2" stroke-linecap="round"/>
    <path d="M337 112 Q342 110 341 117" fill="none" stroke="#5B3A22" stroke-width="2" stroke-linecap="round"/>
    <path d="M0 180 L0 173 Q80 168 160 173 T300 165 Q336 162 360 167 L360 180 Z" fill="#EAF3F0"/>
    <path d="M0 180 L0 177 Q90 174 180 177 T360 173 L360 180 Z" fill="#D3E4DF"/>
    <path d="M-4 4 Q90 18 180 6 Q270 18 364 4" fill="none" stroke="#0A2A22" stroke-width="1.4"/>
    `,
  },
  {
    id: 'bulbs1',
    motion: { type: 'pulse', from: 1, to: 0.4, period: 1600, reps: 3 },
    inner: `
    <g>      <g><rect x="43.5" y="10" width="3" height="3" fill="#2A4A40"/><ellipse cx="45" cy="16.5" rx="3" ry="4.2" fill="#FF5A5F"/></g>
    <g><rect x="223.5" y="10.5" width="3" height="3" fill="#2A4A40"/><ellipse cx="225" cy="17" rx="3" ry="4.2" fill="#FFD25A"/></g></g>
    `,
  },
  {
    id: 'bulbs2',
    motion: { type: 'pulse', from: 1, to: 0.4, period: 1600, reps: 2, delay: 300 },
    inner: `
    <g>      <g><rect x="88.5" y="12" width="3" height="3" fill="#2A4A40"/><ellipse cx="90" cy="18.5" rx="3" ry="4.2" fill="#FFD25A"/></g>
    <g><rect x="268.5" y="12" width="3" height="3" fill="#2A4A40"/><ellipse cx="270" cy="18.5" rx="3" ry="4.2" fill="#FF5A5F"/></g></g>
    `,
  },
  {
    id: 'bulbs3',
    motion: { type: 'pulse', from: 1, to: 0.4, period: 1600, reps: 2, delay: 600 },
    inner: `
    <g>      <g><rect x="133.5" y="10.5" width="3" height="3" fill="#2A4A40"/><ellipse cx="135" cy="17" rx="3" ry="4.2" fill="#5ED39A"/></g>
    <g><rect x="313.5" y="10" width="3" height="3" fill="#2A4A40"/><ellipse cx="315" cy="16.5" rx="3" ry="4.2" fill="#9FD8FF"/></g></g>
    `,
  },
  {
    id: 'bells',
    motion: { type: 'swing', angle: 7, origin: [232, 30], period: 2400, reps: 2 },
    inner: `
    <g>
    <path d="M229 13 L232 30" stroke="#C9252F" stroke-width="1.6"/>
    <g transform="translate(222 48) rotate(-14)">
    <path d="M-10 9 C-10 -4 -6 -12 0 -12 C6 -12 10 -4 10 9 L13 13 L-13 13 Z" fill="url(#gold)"/>
    <path d="M-6 -6 Q-4 -10 0 -10" stroke="#FFF3C4" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle cx="0" cy="15" r="3" fill="#C98C22"/>
    </g>
    <g transform="translate(244 49) rotate(14)">
    <path d="M-10 9 C-10 -4 -6 -12 0 -12 C6 -12 10 -4 10 9 L13 13 L-13 13 Z" fill="url(#gold)"/>
    <path d="M-6 -6 Q-4 -10 0 -10" stroke="#FFF3C4" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle cx="0" cy="15" r="3" fill="#C98C22"/>
    </g>
    <path d="M233 33 L222 28 Q218 33 222 38 Z" fill="#D7303A"/>
    <path d="M233 33 L244 28 Q248 33 244 38 Z" fill="#D7303A"/>
    <path d="M233 33 L226 44 M233 33 L240 44" stroke="#B51F29" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="233" cy="33" r="3" fill="#B51F29"/>
    <path d="M236 30 Q246 22 254 28 Q248 30 250 34 Q244 31 236 30 Z" fill="#1F8A55"/>
    <circle cx="237" cy="27" r="2" fill="#E8343E"/>
    <circle cx="241" cy="25.5" r="1.8" fill="#E8343E"/>
    </g>
    `,
  },
  {
    id: 'settled',
    motion: null,
    inner: `
    <g fill="#FFFFFF" opacity="0.7">
    <circle cx="150" cy="46" r="1"/>
    <circle cx="196" cy="58" r="1.1"/>
    <circle cx="112" cy="70" r="0.9"/>
    <circle cx="205" cy="124" r="1.2"/>
    <circle cx="130" cy="128" r="1"/>
    <circle cx="64" cy="126" r="0.9"/>
    <circle cx="248" cy="62" r="1.2"/>
    <circle cx="262" cy="88" r="0.9"/>
    <circle cx="352" cy="96" r="1.1"/>
    <circle cx="246" cy="104" r="1"/>
    <circle cx="356" cy="122" r="1.3"/>
    <circle cx="284" cy="64" r="0.9"/>
    <circle cx="328" cy="70" r="1"/>
    <circle cx="170" cy="38" r="0.8"/>
    <circle cx="8" cy="96" r="1"/>
    </g>
    `,
  },
  {
    id: 'twinkle',
    motion: { type: 'pulse', from: 1, to: 0.4, period: 2200, reps: 2 },
    inner: `
    <g fill="#FFFFFF">
    <circle cx="190" cy="40" r="1"/>
    <circle cx="262" cy="70" r="0.9"/>
    <circle cx="348" cy="64" r="1.1"/>
    <circle cx="206" cy="76" r="0.8"/>
    <circle cx="342" cy="30" r="0.9"/>
    </g>
    `,
  },
].map((layer) => ({ ...layer, xml: svg(layer.inner) }));

// Falling snow, in scene units: x, radius, fall time (ms), start offset (ms,
// negative = already partway down at the first frame) and sideways drift.
// Every flake has finished by 5 seconds.
const CHRISTMAS_FLAKES = [
  { x: 2, r: 1.6, duration: 4800, delay: -900, dx: -5 },
  { x: 16.8, r: 1.4, duration: 4000, delay: -2300, dx: 5 },
  { x: 28.6, r: 1.3, duration: 4400, delay: -2500, dx: -5 },
  { x: 39.3, r: 1.4, duration: 4500, delay: -200, dx: 3 },
  { x: 51.6, r: 1.8, duration: 4600, delay: -400, dx: 0 },
  { x: 60.2, r: 1.8, duration: 4400, delay: -1700, dx: 7 },
  { x: 68.3, r: 1.1, duration: 4000, delay: -2500, dx: -3 },
  { x: 78.2, r: 1.5, duration: 4200, delay: -900, dx: 8 },
  { x: 92.2, r: 1.5, duration: 4700, delay: -200, dx: -4 },
  { x: 101, r: 1, duration: 4100, delay: -600, dx: 7 },
  { x: 110.4, r: 1.4, duration: 4000, delay: -2000, dx: 8 },
  { x: 119.3, r: 1.3, duration: 4100, delay: -900, dx: -2 },
  { x: 131.2, r: 1.8, duration: 4300, delay: -1800, dx: -5 },
  { x: 142.8, r: 1.4, duration: 4700, delay: -1900, dx: 2 },
  { x: 153.7, r: 1.6, duration: 4500, delay: -2800, dx: -2 },
  { x: 162.2, r: 1.3, duration: 4400, delay: -1100, dx: -3 },
  { x: 177.1, r: 1, duration: 4700, delay: -300, dx: 6 },
  { x: 184.5, r: 1.1, duration: 3800, delay: -200, dx: 9 },
  { x: 196.9, r: 1, duration: 3800, delay: -1400, dx: 2 },
  { x: 209.7, r: 1.8, duration: 4700, delay: -2700, dx: 7 },
  { x: 219, r: 1, duration: 4000, delay: 0, dx: -5 },
  { x: 223.5, r: 1.4, duration: 4400, delay: -700, dx: 4 },
  { x: 239.5, r: 1.3, duration: 3900, delay: -2600, dx: -5 },
  { x: 251.7, r: 1.8, duration: 3800, delay: -1500, dx: -9 },
  { x: 260.2, r: 1.1, duration: 4800, delay: -100, dx: 7 },
  { x: 273.4, r: 1.1, duration: 4300, delay: -2000, dx: -4 },
  { x: 277.9, r: 1.6, duration: 4300, delay: -200, dx: 5 },
  { x: 292.4, r: 1.8, duration: 4200, delay: -100, dx: -7 },
  { x: 298.3, r: 1.8, duration: 4500, delay: -2700, dx: -8 },
  { x: 314.7, r: 1.3, duration: 4900, delay: -2900, dx: 5 },
  { x: 320.3, r: 1.1, duration: 4500, delay: -2600, dx: -2 },
  { x: 332.1, r: 1.5, duration: 4800, delay: -1700, dx: -3 },
  { x: 345.3, r: 1.1, duration: 4000, delay: -2200, dx: -1 },
  { x: 352.5, r: 1.8, duration: 4900, delay: -3000, dx: 2 },
];

// Where Home's text sits, in scene units. Falling snow fades out over these
// (with a soft edge) so no flake crosses a letter or a figure.
const CHRISTMAS_TEXT_AREAS = [
  { x: 14, y: 22, w: 120, h: 26 },
  { x: 14, y: 55, w: 80, h: 21 },
  { x: 14, y: 66, w: 200, h: 54 },
  { x: 14, y: 136, w: 234, h: 24 },
];

export const CARD_SCENES = {
  christmas: {
    layers: CHRISTMAS_LAYERS,
    flakes: CHRISTMAS_FLAKES,
    textAreas: CHRISTMAS_TEXT_AREAS,
    sceneXml: svg(CHRISTMAS_LAYERS.map((l) => l.inner).join('')),
  },
};
