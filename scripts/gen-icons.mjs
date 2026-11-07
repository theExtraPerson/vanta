// One-off PWA icon builder: public/brand/logo-square.jpg -> public/icons/*.png
// Run with: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const src = "public/brand/logo-square.jpg";
const out = "public/icons";
mkdirSync(out, { recursive: true });

// Plain icons: crop-to-cover square.
for (const size of [192, 512]) {
  await sharp(src)
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(`${out}/icon-${size}.png`);
}

// Maskable: contain inside a navy field so no logo detail is cropped away.
for (const size of [192, 512]) {
  const pad = Math.round(size * 0.14);
  await sharp(src)
    .resize(size - pad * 2, size - pad * 2, { fit: "contain", background: { r: 5, g: 10, b: 20, alpha: 1 } })
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 5, g: 10, b: 20, alpha: 1 },
    })
    .png()
    .toFile(`${out}/icon-maskable-${size}.png`);
}

console.log("icons written");
