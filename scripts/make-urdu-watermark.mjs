// Crops just the Urdu calligraphy from the logo for use as a watermark.
// Detects the horizontal gap between the Urdu calligraphy and the "SUPREME ART (PVT) LTD" line.
import { Jimp } from "jimp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const input = join(__dirname, "..", "public", "logo.png");
const output = join(__dirname, "..", "public", "logo-urdu.png");

const img = await Jimp.read(input);
const W = img.bitmap.width;
const H = img.bitmap.height;

// 1) Make near-white transparent
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const idx = (y * W + x) * 4;
    const r = img.bitmap.data[idx];
    const g = img.bitmap.data[idx + 1];
    const b = img.bitmap.data[idx + 2];
    if (r >= 235 && g >= 235 && b >= 235) img.bitmap.data[idx + 3] = 0;
  }
}

// 2) For each row, count non-transparent pixels
const rowCounts = new Array(H).fill(0);
for (let y = 0; y < H; y++) {
  let c = 0;
  for (let x = 0; x < W; x++) {
    if (img.bitmap.data[(y * W + x) * 4 + 3] > 0) c++;
  }
  rowCounts[y] = c;
}

// 3) Find vertical bounding box of all content
let topY = 0, bottomY = H - 1;
for (let y = 0; y < H; y++) if (rowCounts[y] > 0) { topY = y; break; }
for (let y = H - 1; y >= 0; y--) if (rowCounts[y] > 0) { bottomY = y; break; }

// 4) Within bbox, find the largest contiguous "gap" (empty rows) — this is the Urdu/English divider
let gapStart = -1, gapEnd = -1, bestStart = -1, bestEnd = -1, bestLen = 0;
for (let y = topY; y <= bottomY; y++) {
  if (rowCounts[y] === 0) {
    if (gapStart === -1) gapStart = y;
    gapEnd = y;
  } else {
    if (gapStart !== -1 && gapEnd - gapStart + 1 > bestLen) {
      bestLen = gapEnd - gapStart + 1;
      bestStart = gapStart;
      bestEnd = gapEnd;
    }
    gapStart = -1;
  }
}

// 5) Crop to everything ABOVE the largest gap (the Urdu calligraphy)
const urduTop = topY;
const urduBottom = bestStart > 0 ? bestStart - 1 : Math.floor((topY + bottomY) * 0.65);

// Find horizontal bbox within the Urdu band
let minX = W, maxX = 0;
for (let y = urduTop; y <= urduBottom; y++) {
  for (let x = 0; x < W; x++) {
    if (img.bitmap.data[(y * W + x) * 4 + 3] > 0) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
}

const cropW = maxX - minX + 1;
const cropH = urduBottom - urduTop + 1;
console.log(`Cropping Urdu band: ${cropW}x${cropH} @ (${minX},${urduTop})`);
console.log(`Detected gap: ${bestLen} rows at y=${bestStart}-${bestEnd}`);

img.crop({ x: minX, y: urduTop, w: cropW, h: cropH });
await img.write(output);
console.log("✅ Wrote:", output);
