import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { radii } from '../theme/tokens';

// Renders a card theme's background (solid / linear-gradient / pattern) with
// `children` layered on top — same children-on-top-of-background shape
// AccountHeroCarousel previously got from `<Card dark>`. Gradients/patterns
// go through `react-native-svg`'s `SvgXml` with the SVG source built as a
// string, same inline-source convention as Logo.js/ArrowMark.js (no Metro
// SVG-file-loader configured in this project) — not a new dependency
// (`expo-linear-gradient` isn't installed; `react-native-svg` already is).
//
// The svg uses a fixed viewBox stretched with `preserveAspectRatio="none"`
// rather than being sized to the real rendered card's exact pixel
// dimensions — patterns/gradients approximate the artifact's CSS look
// rather than reproducing it exactly. Good enough for Phase 1; refine on
// real devices if a specific theme reads wrong.
const VIEWBOX_W = 300;
const VIEWBOX_H = 180;

// Converts a CSS-style gradient angle (0deg = to top, 90deg = to right,
// clockwise) into SVG objectBoundingBox x1/y1/x2/y2 fractions.
function angleToCoords(angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  return {
    x1: 0.5 - dx / 2,
    y1: 0.5 - dy / 2,
    x2: 0.5 + dx / 2,
    y2: 0.5 + dy / 2,
  };
}

function buildLinearSvg({ angle, colors }) {
  const { x1, y1, x2, y2 } = angleToCoords(angle);
  const stops = colors
    .map((c, i) => `<stop offset="${((i / (colors.length - 1)) * 100).toFixed(1)}%" stop-color="${c}"/>`)
    .join('');
  return `
    <svg width="100%" height="100%" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>
      </defs>
      <rect width="${VIEWBOX_W}" height="${VIEWBOX_H}" fill="url(#g)"/>
    </svg>
  `;
}

function buildPatternSvg({ kind, line, accent, accent2, accent3, colors, angle }) {
  const w = VIEWBOX_W;
  const h = VIEWBOX_H;
  let defs = '';
  let body = '';

  if (kind === 'grid') {
    defs = `<pattern id="p" width="18" height="18" patternUnits="userSpaceOnUse">
      <path d="M18 0H0V18" fill="none" stroke="${line}" stroke-width="1"/>
    </pattern>`;
    body = `<rect width="${w}" height="${h}" fill="url(#p)"/>`;
  } else if (kind === 'lines') {
    defs = `<pattern id="p" width="16" height="14" patternUnits="userSpaceOnUse">
      <line x1="0" y1="13" x2="16" y2="13" stroke="${line}" stroke-width="1"/>
    </pattern>`;
    body = `<rect width="${w}" height="${h}" fill="url(#p)"/>`;
  } else if (kind === 'weave') {
    // FIXED (was two PARALLEL vertical lines rotated together — reads as a
    // single diagonal stripe direction, not a weave). A genuine crosshatch
    // needs two PERPENDICULAR lines in the tile (one vertical, one
    // horizontal); rotating that pair 45° together is what actually
    // produces two diagonal directions crossing each other.
    defs = `<pattern id="p" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="9" stroke="${line}" stroke-width="1.4"/>
      <line x1="0" y1="0" x2="9" y2="0" stroke="${line}" stroke-width="1.4"/>
    </pattern>`;
    body = `<rect width="${w}" height="${h}" fill="url(#p)"/>`;
  } else if (kind === 'blotch') {
    // accent2 (optional) gives a second, differently-hued blob — Aurora's
    // green/purple glow — falling back to a second `accent` blob (Marble's
    // single warm tone, repeated) when omitted. accent3 (optional, Aurora
    // only) adds a third, smaller/subtler blob — "a slight touch," not a
    // third equal color, hence the lower peak opacity.
    //
    // Positions/radii tuned per direct feedback (2026-07-20): the three
    // blobs originally clustered too close together (accent3 sat directly
    // between accent/accent2), muddying into an overlap. Now spread toward
    // three separate corners, with a softer 3-stop falloff (full → half →
    // transparent, instead of a hard full → transparent jump) and a wider
    // radius on each — reads as a diffuse blur instead of a sharp-edged
    // colored disc.
    const secondAccent = accent2 ?? accent;
    const blob = (id, cx, cy, r, color, peakOpacity) => `
      <radialGradient id="${id}" cx="${cx}%" cy="${cy}%" r="${r}%">
        <stop offset="0%" stop-color="${color}" stop-opacity="${peakOpacity}"/>
        <stop offset="55%" stop-color="${color}" stop-opacity="${peakOpacity * 0.45}"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </radialGradient>`;
    defs = `
      ${blob('p1', 15, 12, 75, accent, 1)}
      ${blob('p2', 90, 95, 80, secondAccent, 1)}
      ${accent3 ? blob('p3', 85, 10, 65, accent3, 0.45) : ''}`;
    body = `<rect width="${w}" height="${h}" fill="url(#p1)"/><rect width="${w}" height="${h}" fill="url(#p2)"/>${accent3 ? `<rect width="${w}" height="${h}" fill="url(#p3)"/>` : ''}`;
  } else if (kind === 'glow') {
    // `colors` (optional, e.g. Onyx) sweeps through several hues before
    // fading out — a prismatic sheen instead of one flat tinted glow. Falls
    // back to the original single-`accent` radial (Ember) when omitted, so
    // every other `glow` theme is unaffected.
    if (colors?.length) {
      const n = colors.length;
      const stops = colors
        .map((c, i) => `<stop offset="${((i / (n - 1)) * 78).toFixed(1)}%" stop-color="${c}" stop-opacity="${0.6 - (i / (n - 1)) * 0.2}"/>`)
        .join('');
      defs = `<radialGradient id="p" cx="80%" cy="96%" r="85%">
        ${stops}
        <stop offset="100%" stop-color="${colors[n - 1]}" stop-opacity="0"/>
      </radialGradient>`;
    } else {
      defs = `<radialGradient id="p" cx="82%" cy="100%" r="70%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>`;
    }
    body = `<rect width="${w}" height="${h}" fill="url(#p)"/>`;
  } else if (kind === 'grain') {
    // Undertow (card-theme-ideas reference set, 2026-07-20) — a diagonal
    // `colors` gradient (same stop-building as buildLinearSvg) with a fixed
    // speckle of tiny low-opacity white dots layered over it to approximate
    // film grain. SVG can't reproduce true photographic noise; this is the
    // cheapest believable stand-in — literal, deterministic dot positions
    // (not runtime randomness), so the theme renders identically for every
    // user, every time, same discipline as every other pattern here.
    // `angle` defaults to 140 (Undertow's own diagonal) — Crimson Shore
    // (sky-reference set) overrides it to a near-vertical band instead,
    // matching its photo's horizontal horizon-glow structure.
    const { x1, y1, x2, y2 } = angleToCoords(angle ?? 140);
    const stops = colors
      .map((c, i) => `<stop offset="${((i / (colors.length - 1)) * 100).toFixed(1)}%" stop-color="${c}"/>`)
      .join('');
    defs = `<linearGradient id="p" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
    const grain = [
      [12, 15, 0.1], [38, 42, 0.06], [64, 8, 0.08], [90, 55, 0.05], [118, 22, 0.09],
      [145, 68, 0.06], [170, 12, 0.07], [198, 45, 0.05], [222, 78, 0.08], [250, 30, 0.06],
      [275, 60, 0.09], [20, 95, 0.06], [55, 120, 0.08], [85, 100, 0.05], [112, 140, 0.07],
      [140, 105, 0.06], [165, 150, 0.09], [190, 118, 0.05], [215, 135, 0.07], [245, 100, 0.06],
      [270, 155, 0.08], [8, 165, 0.06], [48, 25, 0.05], [102, 75, 0.06], [160, 40, 0.08],
      [205, 90, 0.05], [235, 20, 0.07], [8, 60, 0.06], [130, 165, 0.05], [260, 140, 0.07],
    ];
    const grainDots = grain.map(([gx, gy, op]) => `<circle cx="${gx}" cy="${gy}" r="1" fill="#ffffff" opacity="${op}"/>`).join('');
    body = `<rect width="${w}" height="${h}" fill="url(#p)"/>${grainDots}`;
  }

  return `
    <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>${defs}</defs>
      ${body}
    </svg>
  `;
}

// `style` is for OUTER sizing/radius only (width, flex, borderRadius) —
// never pass padding here. RN positions an absolutely-positioned child
// relative to its parent's padding edge, not its border edge, so padding on
// this same container would leave the background overlay short of the
// card's real edges. Give `children` their own padded wrapper instead (see
// AccountHeroCarousel's `heroCardContent`).
export default function CardThemeSurface({ theme, style, children }) {
  const bg = theme.background;

  return (
    <View style={[styles.container, { backgroundColor: bg.type === 'pattern' ? bg.base : (bg.color ?? bg.colors?.[0]) }, style]}>
      {bg.type === 'linear' && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SvgXml xml={buildLinearSvg(bg)} width="100%" height="100%" />
        </View>
      )}
      {bg.type === 'pattern' && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SvgXml xml={buildPatternSvg(bg)} width="100%" height="100%" />
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.cardLg,
    overflow: 'hidden',
  },
});
