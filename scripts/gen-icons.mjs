// Generates PWA icons and favicons from an inline SVG. Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const mark = (bg, fg, pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="${bg}"/>
  <g transform="translate(256 256) scale(${pad ? 0.72 : 0.86})">
    <circle r="150" fill="none" stroke="${fg}" stroke-width="26"/>
    <path d="M62 -62 L28 28 L-62 62 L-28 -28 Z" fill="#E8532F"/>
    <circle r="16" fill="${fg}"/>
  </g>
</svg>`;

const out = async (svg, size, file) => {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log("wrote", file);
};
await out(mark("#15181E", "#F5F2EC", false), 192, "public/icons/icon-192.png");
await out(mark("#15181E", "#F5F2EC", false), 512, "public/icons/icon-512.png");
await out(mark("#15181E", "#F5F2EC", true), 512, "public/icons/maskable-512.png");
await out(mark("#15181E", "#F5F2EC", false), 180, "app/apple-icon.png");
writeFileSync("app/icon.svg", mark("#15181E", "#F5F2EC", false));
console.log("wrote app/icon.svg");
