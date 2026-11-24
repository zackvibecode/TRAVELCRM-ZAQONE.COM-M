import sharp from "sharp";

/**
 * Detect the three white speed-line strokes left of the wing in the source
 * and draw them back into the flat image as red pixels.
 */
const SRC = "scripts/logo/source.jpg";
const OUT = "scripts/logo";

const scaled = await sharp(SRC).resize({ width: 1600, kernel: "lanczos3" }).toBuffer();
const { data, info } = await sharp(scaled).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

// Speed lines: light grey strokes on white. Find pixels that are grey
// (dark-ish but not red/navy) in the region LEFT of the wing (x < ~390 in
// 1600-wide space, y 330..500 roughly covers the wing's trailing strokes).
const strokes = [];
for (let y = 300; y < 520; y++) {
  for (let x = 100; x < 400; x++) {
    const i = (y * width + x) * channels;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = (r + g + b) / 3;
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));
    // grey stroke: mid luminance, low saturation, NOT background (>245) and NOT navy (<60)
    if (lum > 60 && lum < 245 && sat < 0.25) {
      strokes.push({ x, y, lum });
    }
  }
}
console.log("stroke pixels found:", strokes.length);
if (strokes.length) {
  const xs = strokes.map((s) => s.x), ys = strokes.map((s) => s.y);
  console.log("stroke bounds:", Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
}

// Map these into the flat image (same 1600x1200 space) as red
const flat = await sharp(`${OUT}/flat-3color.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const fdata = Buffer.from(flat.data);
const RED = [230, 24, 40];
let painted = 0;
for (const s of strokes) {
  const p = (s.y * width + s.x) * 3;
  fdata[p] = RED[0]; fdata[p + 1] = RED[1]; fdata[p + 2] = RED[2];
  painted++;
}
await sharp(fdata, { raw: { width, height, channels: 3 } }).png().toFile(`${OUT}/flat-3color.png`);
console.log("painted:", painted);
