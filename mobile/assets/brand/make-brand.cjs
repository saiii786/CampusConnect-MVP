// Generates the Connect logo (SVG sources in this folder + PNG app icons in ../images). ADR-030.
// The renderer is not a project dependency; run it from a throwaway folder:
//   mkdir brand-tools && cd brand-tools && npm init -y && npm install @resvg/resvg-js@2.6.2
//   node <repo>/mobile/assets/brand/make-brand.cjs <repo>
// Change the shape/colours here, re-run, and commit the SVGs + PNGs together.
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');

const repo = process.argv[2];
const brandDir = path.join(repo, 'mobile/assets/brand');
const imgDir = path.join(repo, 'mobile/assets/images');
fs.mkdirSync(brandDir, { recursive: true });

const C = { indigo: '#4338CA', deep: '#272379', marigold: '#F5B301', white: '#FFFFFF' };

/** Two interlocking rings centred at (cx, cy). s = scale (1 → rings 696 px wide). */
function rings(cx, cy, s, a = C.white, b = C.marigold) {
  const r = 200 * s, w = 96 * s, dx = 100 * s;
  const ax = cx - dx, bx = cx + dx;
  // Weave: redraw ring A's arc from -85° to -35° (around the top crossing at -60°) on top of ring B.
  const pt = (deg) => [ax + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)].map((v) => v.toFixed(2));
  const [x1, y1] = pt(-85), [x2, y2] = pt(-35);
  return `
  <circle cx="${ax}" cy="${cy}" r="${r}" fill="none" stroke="${a}" stroke-width="${w}"/>
  <circle cx="${bx}" cy="${cy}" r="${r}" fill="none" stroke="${b}" stroke-width="${w}"/>
  <path d="M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}" fill="none" stroke="${a}" stroke-width="${w}"/>`;
}

const gradient = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${C.indigo}"/><stop offset="1" stop-color="${C.deep}"/></linearGradient></defs>`;
const svg = (body, size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${body}\n</svg>\n`;

const files = {
  // Full-bleed square: iOS and stores round the corners themselves.
  'icon.svg': svg(`${gradient}<rect width="1024" height="1024" fill="url(#g)"/>${rings(512, 512, 0.92)}`),
  // Rounded version for documents, web and the brand sheet.
  'logo-mark.svg': svg(`${gradient}<rect width="1024" height="1024" rx="232" fill="url(#g)"/>${rings(512, 512, 0.92)}`),
  // Android adaptive icon: foreground inside the 66 % safe zone, background separately.
  'android-foreground.svg': svg(rings(512, 512, 0.62)),
  'android-background.svg': svg(`${gradient}<rect width="1024" height="1024" fill="url(#g)"/>`),
  // Monochrome (Android 13 themed icons): one colour; the system tints it.
  'android-monochrome.svg': svg(rings(512, 512, 0.62, C.white, C.white)),
  // Splash: mark on transparent; the splash background colour is set in app.json.
  'splash-mark.svg': svg(rings(512, 512, 1)),
};

for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(brandDir, name), content);

const render = (svgText, size, out) => {
  const png = new Resvg(svgText, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' }).render().asPng();
  fs.writeFileSync(path.join(imgDir, out), png);
  console.log(`${out}\t${size}px\t${png.length} bytes`);
};
render(files['icon.svg'], 1024, 'icon.png');
render(files['android-foreground.svg'], 1024, 'android-icon-foreground.png');
render(files['android-background.svg'], 1024, 'android-icon-background.png');
render(files['android-monochrome.svg'], 1024, 'android-icon-monochrome.png');
render(files['splash-mark.svg'], 512, 'splash-icon.png');
render(files['logo-mark.svg'], 48, 'favicon.png');
// Logo shown inside the app (welcome screen) — 512 px so it is sharp at ~110 pt on 3x screens.
render(files['logo-mark.svg'], 512, 'logo-mark.png');
// Preview for the brand sheet / README.
render(files['logo-mark.svg'], 256, '../brand/logo-mark-256.png');
