import sharp from "sharp";

const SRC = "scripts/logo/source.jpg";
const OUT = "scripts/logo";

const scaled = await sharp(SRC)
  .resize({ width: 2400, kernel: "lanczos3" })
  .toBuffer();

const { data, info } = await sharp(scaled)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const RED = [230, 24, 40]; // canonical brand red (slightly deeper than max)
const NAVY = [10, 20, 32]; // wordmark navy

const out = Buffer.alloc(width * height * 4);
let redPx = 0;
let navyPx = 0;

for (let i = 0, p = 0; i < data.length; i += channels, p += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = (r + g + b) / 3;

  // "ink" = how far this pixel is from white background (0..1)
  const ink = Math.min(1, (255 - lum) / 160);

  if (ink < 0.06) {
    out[p + 3] = 0;
    continue;
  }

  // Red classification: R noticeably above G & B with saturation.
  const isRed = r - g > 40 && r - b > 35 && sat > 0.45;

  const c = isRed ? RED : NAVY;
  out[p] = c[0];
  out[p + 1] = c[1];
  out[p + 2] = c[2];
  out[p + 3] = Math.round(ink * 255);
  if (isRed) redPx++;
  else navyPx++;
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(`${OUT}/artwork-alpha.png`);

// composite on white for visual check
await sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
  .composite([{ input: `${OUT}/artwork-alpha.png` }])
  .png()
  .toFile(`${OUT}/artwork-on-white.png`);

console.log("red:", redPx, "navy:", navyPx);
