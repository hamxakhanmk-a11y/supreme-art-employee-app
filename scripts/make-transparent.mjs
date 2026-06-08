// Convert logo.png white background to transparent.
// Saves alongside as logo-transparent.png
import { Jimp } from "jimp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const input = join(__dirname, "..", "public", "logo.png");
const output = join(__dirname, "..", "public", "logo-transparent.png");

console.log("Reading:", input);
const img = await Jimp.read(input);

// Make near-white pixels transparent
const threshold = 235;
const w = img.bitmap.width;
const h = img.bitmap.height;

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const idx = (y * w + x) * 4;
    const r = img.bitmap.data[idx];
    const g = img.bitmap.data[idx + 1];
    const b = img.bitmap.data[idx + 2];
    if (r >= threshold && g >= threshold && b >= threshold) {
      img.bitmap.data[idx + 3] = 0; // alpha = 0 (transparent)
    }
  }
}

await img.write(output);
console.log("✅ Wrote:", output);
