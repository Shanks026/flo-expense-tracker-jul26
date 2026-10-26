// Koban's drawing — PLACEHOLDER ART (37-design-system-and-koban.md).
//
// This is the agreed round-5 prototype, style A "Silhouette" (branch
// `prototype/koban-mascot`, koban-body-v5.prototype.html): one flat ginger
// shape, no outline, no gradients, tube limbs that merge into the body, and a
// crease line only where a limb crosses the body or face. The person will
// replace it with their own illustrations; everything that is the drawing
// lives in this file, so that swap touches nothing in Koban.js's API or any
// placement.
//
// Coordinates are in the prototype's own space: viewBox "30 -36 240 352".

export const VIEWBOX = { x: 30, y: -36, w: 240, h: 352 };

export const PALETTE = {
  fur: '#F08A2C',
  cream: '#FFF1DE',
  stripe: '#D46A1C',
  crease: '#C9621A',
  innerEar: '#F5A99C',
  blush: '#FF9A8C',
  nose: '#EC7A72',
  whisker: '#7A3A14',
  eyeWhite: '#FFFEFA',
  iris: '#7DBF45',
  pupil: '#1C110A',
  lime: '#BBDC12',
  limeDeep: '#5E7A0A',
  shadowLight: 'rgba(60,30,10,0.12)',
  shadowDark: 'rgba(0,0,0,0.6)',
};

export const SHAPES = {
  head: 'M150 56 C197 56 228 87 228 124 C228 161 195 184 150 184 C105 184 72 161 72 124 C72 87 103 56 150 56 Z',
  earL: 'M86 104 C79 74 83 44 96 24 C117 35 131 54 137 72 Z',
  earR: 'M214 104 C221 74 217 44 204 24 C183 35 169 54 163 72 Z',
  innerEarL: 'M97 90 C94 70 97 52 103 41 C113 49 121 59 126 69 Z',
  innerEarR: 'M203 90 C206 70 203 52 197 41 C187 49 179 59 174 69 Z',
  torso: 'M150 172 C176 172 190 192 192 220 C194 250 186 270 174 278 C166 283 134 283 126 278 C114 270 106 250 108 220 C110 192 124 172 150 172 Z',
  // Limbs and tail are centre-lines drawn as round-capped tubes.
  legL: 'M138 262 L135 293',
  legR: 'M162 262 L165 293',
  tail: 'M184 262 C214 266 232 244 225 214 C222 203 213 199 207 204',
  muzzle: 'M150 138 C164 138 174 145 175 155 C176 167 163 174 150 173 C137 174 124 167 125 155 C126 145 136 138 150 138 Z',
  nose: 'M144.5 145 Q150 142 155.5 145 Q153.5 150.5 150 151.5 Q146.5 150.5 144.5 145 Z',
  scarf: 'M116 182 Q150 198 184 182 L186 196 Q150 214 114 196 Z',
  scarfZigzag: 'M118 189 L125 195 L132 189 L139 195 L146 189 L153 195 L160 189 L167 195 L174 189 L181 194',
  scarfTail: 'M166 198 L173 226 L161 224 L158 201 Z',
};

// Arm shapes per pose live in ./poses.js.

export const STRIPES = [
  { d: 'M150 60 L150 78', w: 5.5 },
  { d: 'M137 62 L140 77', w: 4.5 },
  { d: 'M163 62 L160 77', w: 4.5 },
];

export const WHISKERS = [
  'M125 157 Q104 153 82 155',
  'M125 163 Q106 163 86 170',
  'M175 157 Q196 153 218 155',
  'M175 163 Q194 163 214 170',
];

export const EYES = { y: 122, xs: [120, 180] };

export const WIDTHS = { arm: 21, leg: 24, tail: 15 };

// Joints each moving part turns around (prototype transform-origins).
export const JOINTS = {
  body: [150, 304], // breathing scales from the feet
  head: [150, 178],
  tail: [186, 256],
  earL: [111, 100],
  earR: [189, 100],
  eyes: [150, 122],
};
