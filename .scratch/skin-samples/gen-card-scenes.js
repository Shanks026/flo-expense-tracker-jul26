// Builds lib/cardScenes.js from the animated sample SVG: ordered layers
// (static ones and one per moving part), the static full scene, and the
// falling-snow data. Usage (from the repo root):
//   node .scratch/skin-samples/gen-card-scenes.js .
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const src = fs.readFileSync(path.join(root, '.scratch/skin-samples/christmas-card.svg'), 'utf8');
const lines = src.split(/\r?\n/);
const L = (a, b) => lines.slice(a - 1, b).join('\n');
const clean = (s) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/ class="[^"]*"/g, '')
    .replace(/ style="[^"]*"/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');

const find = (re, from = 1) => {
  for (let i = from - 1; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  throw new Error('not found: ' + re);
};

// defs without the clip, feather filter and snow mask
const defsStart = find(/<defs>/);
const defsEnd = find(/<\/defs>/);
let defs = L(defsStart + 1, defsEnd - 1)
  .replace(/<clipPath[\s\S]*?<\/clipPath>/, '')
  .replace(/<filter id="feather"[\s\S]*?<\/filter>/, '')
  .replace(/<mask id="snowMask"[\s\S]*?<\/mask>/, '');
defs = clean(defs);

const sky = find(/<!-- Night sky -->/);
const tree = find(/<!-- Background tree/);
const scrim = find(/fill="url\(#textShade\)"/);
const starC = find(/<!-- Star of Bethlehem/);
const pines = find(/<!-- Pine trees/);
const crib = find(/<!-- The crib/);
const lights = find(/<!-- Fairy lights/);
const bells = find(/<!-- Two bells/);
const snow = find(/<!-- Snow over the whole card/);

const twinkleGroup = L(sky + 2, tree - 1); // <g fill white> … </g>
const layers = {
  base: clean(L(sky + 1, sky + 1) + '\n' + L(tree, scrim) + '\n' + L(pines, crib - 1)),
  starHalo: clean(L(starC + 1, starC + 1)),
  star: clean(L(starC + 2, pines - 1)),
  glow: clean(L(crib + 1, crib + 1)),
  crib: clean(L(crib + 2, lights - 1) + '\n' + L(lights + 1, lights + 1)),
};
// Bulbs: three groups by class.
const bulbLines = lines.slice(lights + 2, bells - 1).filter((l) => /class="bulb/.test(l));
layers.bulbs1 = clean('<g>' + bulbLines.filter((l) => /class="bulb"/.test(l)).join('\n') + '</g>');
layers.bulbs2 = clean('<g>' + bulbLines.filter((l) => /b2/.test(l)).join('\n') + '</g>');
layers.bulbs3 = clean('<g>' + bulbLines.filter((l) => /b3/.test(l)).join('\n') + '</g>');
layers.bells = clean(L(bells + 1, snow - 1));
// Settled snow: the opacity-0.7 group inside the masked snow block.
const settledStart = find(/<g fill="#FFFFFF" opacity="0.7">/, snow);
const settledEnd = find(/<\/g>/, settledStart);
layers.settled = clean(L(settledStart, settledEnd));
layers.twinkle = clean(twinkleGroup);

// Falling flakes: cx, r, --d, --delay, --x
const flakes = [];
for (const l of lines) {
  const m = l.match(/class="flake" cx="([\d.]+)" cy="0" r="([\d.]+)" style="--d:([\d.]+)s;--delay:(-?[\d.]+)s;--x:(-?\d+)px"/);
  if (m) flakes.push({ x: +m[1], r: +m[2], d: +m[3], delay: +m[4], dx: +m[5] });
}
// Text areas the snow fades out over (the sample's mask holes).
const holes = [];
for (const l of lines.slice(find(/<mask id="snowMask"/) - 1, find(/<\/mask>/))) {
  const m = l.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
  if (m) holes.push({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] });
}

const ind = (s) => s.split('\n').map((l) => '  ' + l).join('\n');
const out = `// Illustrated card scenes (43-themes-back-unlocked.md, Phase 1b). Generated
// from the animated sample in .scratch/skin-samples/christmas-card.svg; edit
// the sample, then regenerate with .scratch/skin-samples/gen-card-scenes.js
// rather than editing these strings by hand.
//
// A scene is a stack of layers in one 360×180 coordinate space, each drawn
// full-card with preserveAspectRatio "xMidYMid slice" so they line up at any
// card size. Static layers are plain SVG; a layer with \`motion\` is moved by
// components/AnimatedCardScene.js (Reanimated, about 5 seconds, then it
// settles; nothing moves with Reduce motion). \`sceneXml\` joins every layer
// into one static SVG for places that don't animate (Personalize's grid).
//
// Every scene keeps Home's text side clear: text sits in the left two-thirds,
// the art and anything bright in the right third.

export const SCENE_W = 360;
export const SCENE_H = 180;

const DEFS = \`<defs>
${ind(defs)}
</defs>\`;

function svg(inner) {
  return \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \${SCENE_W} \${SCENE_H}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">\${DEFS}\${inner}</svg>\`;
}

// Christmas: a night-green sky with a dark background tree, fairy lights,
// two bells with a bow and holly, the star over a lit crib (Mary, the child
// in the manger, Joseph), pines and snow. A scrim darkens the text side:
// worst contrast behind text is white 12.7:1, muted 9.6:1, #FF8F8F 5.8:1.
// Motion matches the sample: bulbs blink, the bells swing about the bow,
// the star swells, its halo and the stable's glow pulse, the sky twinkles.
const CHRISTMAS_LAYERS = [
${Object.entries({
  base: null,
  starHalo: "{ type: 'pulse', from: 1, to: 0.75, period: 2400, reps: 2 }",
  star: "{ type: 'scale', to: 1.14, origin: [300, 40], period: 2400, reps: 2 }",
  glow: "{ type: 'pulse', from: 1, to: 0.75, period: 2400, reps: 2 }",
  crib: null,
  bulbs1: "{ type: 'pulse', from: 1, to: 0.4, period: 1600, reps: 3 }",
  bulbs2: "{ type: 'pulse', from: 1, to: 0.4, period: 1600, reps: 2, delay: 300 }",
  bulbs3: "{ type: 'pulse', from: 1, to: 0.4, period: 1600, reps: 2, delay: 600 }",
  bells: "{ type: 'swing', angle: 7, origin: [232, 30], period: 2400, reps: 2 }",
  settled: null,
  twinkle: "{ type: 'pulse', from: 1, to: 0.4, period: 2200, reps: 2 }",
})
  .map(([id, motion]) => `  {\n    id: '${id}',\n    motion: ${motion ?? 'null'},\n    inner: \`\n${ind(ind(layers[id]))}\n    \`,\n  },`)
  .join('\n')}
].map((layer) => ({ ...layer, xml: svg(layer.inner) }));

// Falling snow, in scene units: x, radius, fall time (ms), start offset (ms,
// negative = already partway down at the first frame) and sideways drift.
// Every flake has finished by 5 seconds.
const CHRISTMAS_FLAKES = [
${flakes.map((f) => `  { x: ${f.x}, r: ${f.r}, duration: ${Math.round(f.d * 1000)}, delay: ${Math.round(f.delay * 1000)}, dx: ${f.dx} },`).join('\n')}
];

// Where Home's text sits, in scene units. Falling snow fades out over these
// (with a soft edge) so no flake crosses a letter or a figure.
const CHRISTMAS_TEXT_AREAS = [
${holes.map((h) => `  { x: ${h.x}, y: ${h.y}, w: ${h.w}, h: ${h.h} },`).join('\n')}
];

export const CARD_SCENES = {
  christmas: {
    layers: CHRISTMAS_LAYERS,
    flakes: CHRISTMAS_FLAKES,
    textAreas: CHRISTMAS_TEXT_AREAS,
    sceneXml: svg(CHRISTMAS_LAYERS.map((l) => l.inner).join('')),
  },
};
`;
fs.writeFileSync(path.join(root, 'lib/cardScenes.js'), out);
console.log('layers', Object.keys(layers).length, 'flakes', flakes.length, 'holes', holes.length);
for (const [k, v] of Object.entries(layers)) console.log(k, (v.match(/</g) || []).length);
