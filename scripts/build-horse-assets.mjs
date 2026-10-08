// One-shot asset generator: extracts the EXACT path data from the uploaded
// horse logo and derives every brand asset from it (no hand-copied geometry).
// Run: node scripts/build-horse-assets.mjs
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const SRC = "/home/z/my-project/upload/horse_logo.svg";
const svg = readFileSync(SRC, "utf8");

// Extract the full `d` attribute and fill-rule exactly as authored
const dMatch = svg.match(/\bd="([^"]+)"/);
if (!dMatch) throw new Error("no path d found");
const D = dMatch[1].replace(/\s+/g, " ");
const evenodd = /fill-rule="evenodd"/.test(svg);
// viewBox for aspect math
const vbMatch = svg.match(/viewBox="([^"]+)"/);
const [vx, vy, vw, vh] = (vbMatch?.[1] ?? "0 0 1106 785").split(/\s+/).map(Number);
console.log(`extracted d: ${D.length} chars, viewBox ${vw}x${vh}, evenodd=${evenodd}`);

writeFileSync("/tmp/horse-d.txt", D);

// ---------- public/icon.svg : navy tile + white horse ----------
function iconSvg({ tile = "#102A43", horse = "#FFFFFF", size = 512, pad = 0.31, rx = 112 }) {
  const contentW = size * (1 - pad * 2);
  const scale = contentW / vw;
  const contentH = vh * scale;
  const tx = (size - contentW) / 2;
  const ty = (size - contentH) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Horse logo">
  <title>Horse</title>
  <rect width="${size}" height="${size}" rx="${rx}" fill="${tile}"/>
  <g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${scale.toFixed(5)})" fill="${horse}"${evenodd ? ' fill-rule="evenodd"' : ""}>
    <path d="${D}"/>
  </g>
</svg>
`;
}
writeFileSync("/home/z/my-project/public/icon.svg", iconSvg({}));

// Transparent square icon (any purpose — full-bleed horse on transparent)
function markSvg({ color = "#102A43", size = 512, pad = 0.06 }) {
  const contentW = size * (1 - pad * 2);
  const scale = contentW / vw;
  const contentH = vh * scale;
  const tx = (size - contentW) / 2;
  const ty = (size - contentH) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Horse logo">
  <title>Horse</title>
  <g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${scale.toFixed(5)})" fill="${color}"${evenodd ? ' fill-rule="evenodd"' : ""}>
    <path d="${D}"/>
  </g>
</svg>
`;
}

// ---------- PNG rasterization (PWA launchers + apple touch) ----------
const tile = Buffer.from(iconSvg({ rx: 0 })); // full-bleed square for maskable
await sharp(tile).resize(512, 512).png().toFile("/home/z/my-project/public/icon-512.png");
await sharp(tile).resize(192, 192).png().toFile("/home/z/my-project/public/icon-192.png");
const apple = Buffer.from(iconSvg({ rx: 0 })); // iOS applies its own mask
await sharp(apple).resize(180, 180).png().toFile("/home/z/my-project/public/apple-touch-icon.png");
const mono = Buffer.from(markSvg({})); // favicon-grade transparent mark
await sharp(mono).resize(64, 64).png().toFile("/home/z/my-project/public/favicon-64.png");

console.log("assets written: icon.svg, icon-512.png, icon-192.png, apple-touch-icon.png, favicon-64.png");
