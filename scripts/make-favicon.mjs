// Generate a square Supreme Art favicon/app-icon from the logo.
// Crops to the calligraphy area + saves as app/icon.png (Next.js auto-detects it).
import { Jimp } from "jimp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const input = join(__dirname, "..", "public", "logo.png");
const outputIcon = join(__dirname, "..", "app", "icon.png");
const outputApple = join(__dirname, "..", "app", "apple-icon.png");

console.log("Reading:", input);
const img = await Jimp.read(input);

const W = img.bitmap.width;
const H = img.bitmap.height;
console.log(`Source: ${W}x${H}`);

// Make near-white transparent
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const idx = (y * W + x) * 4;
    const r = img.bitmap.data[idx];
    const g = img.bitmap.data[idx + 1];
    const b = img.bitmap.data[idx + 2];
    if (r >= 235 && g >= 235 && b >= 235) {
      img.bitmap.data[idx + 3] = 0;
    }
  }
}

// Find bounding box of non-transparent pixels
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const a = img.bitmap.data[(y * W + x) * 4 + 3];
    if (a > 0) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
}
const cropW = maxX - minX + 1;
const cropH = maxY - minY + 1;
console.log(`Content bounds: ${cropW}x${cropH} @ (${minX},${minY})`);

img.crop({ x: minX, y: minY, w: cropW, h: cropH });

// Pad to square on a deep red background (#A32D2D) for a branded look
const SIZE = 512;
const PAD = 60;
const fitSide = SIZE - PAD * 2;
const scale = Math.min(fitSide / cropW, fitSide / cropH);
img.resize({ w: Math.round(cropW * scale), h: Math.round(cropH * scale) });

// Create a square red canvas
const canvas = new Jimp({ width: SIZE, height: SIZE, color: 0xA32D2Dff });

// Composite logo (now all dark-on-transparent) on red — invert to white first
const w2 = img.bitmap.width;
const h2 = img.bitmap.height;
for (let y = 0; y < h2; y++) {
  for (let x = 0; x < w2; x++) {
    const idx = (y * w2 + x) * 4;
    const a = img.bitmap.data[idx + 3];
    if (a > 0) {
      // Make it pure white (logo art becomes white silhouette)
      img.bitmap.data[idx] = 255;
      img.bitmap.data[idx + 1] = 255;
      img.bitmap.data[idx + 2] = 255;
    }
  }
}

const dx = Math.round((SIZE - w2) / 2);
const dy = Math.round((SIZE - h2) / 2);
canvas.composite(img, dx, dy);

await canvas.write(outputIcon);
await canvas.write(outputApple);
console.log("✅ Wrote:", outputIcon);
console.log("✅ Wrote:", outputApple);
