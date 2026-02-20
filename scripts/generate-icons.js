// Generate PWA icons using sharp or canvas
// Run: node scripts/generate-icons.js

const fs = require("fs");
const path = require("path");

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, "..", "public", "icons");

// SVG template — ClalMobile "C" logo with brand colors
function makeSVG(size, maskable = false) {
  const padding = maskable ? Math.round(size * 0.2) : Math.round(size * 0.1);
  const inner = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = inner / 2;
  const fontSize = Math.round(inner * 0.55);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c41040"/>
      <stop offset="100%" stop-color="#e91e63"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#09090b"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#bg)"/>
  <text x="${cx}" y="${cy}" dominant-baseline="central" text-anchor="middle" 
        font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${fontSize}" fill="white">C</text>
</svg>`;
}

// Write SVG files (will be used directly or converted to PNG)
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

for (const size of sizes) {
  const svg = makeSVG(size, false);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.svg`), svg);
  console.log(`Created icon-${size}x${size}.svg`);
}

// Maskable icons
for (const size of [192, 512]) {
  const svg = makeSVG(size, true);
  fs.writeFileSync(path.join(iconsDir, `icon-maskable-${size}x${size}.svg`), svg);
  console.log(`Created icon-maskable-${size}x${size}.svg`);
}

// Apple touch icon
const apple = makeSVG(180, false);
fs.writeFileSync(path.join(iconsDir, "apple-touch-icon.svg"), apple);
console.log("Created apple-touch-icon.svg");

// Favicon
const favicon = makeSVG(32, false);
fs.writeFileSync(path.join(iconsDir, "favicon.svg"), favicon);
console.log("Created favicon.svg");

console.log("\nDone! SVG icons generated.");
console.log("For PNG conversion, use: https://cloudconvert.com or sharp library");
