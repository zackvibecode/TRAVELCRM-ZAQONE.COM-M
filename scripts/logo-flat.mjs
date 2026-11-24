import sharp from "sharp";

const SRC = "scripts/logo/source.jpg";
const OUT = "scripts/logo";

const scaled = await sharp(SRC)
  .resize({ width: 1600, kernel: "lanczos3" })
  .toBuffer();

const { data, info } = await sharp(scaled)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const RED = [230, 24, 40];
const NAVY = [10, 20, 32];
const WHITE = [255, 255, 255];

const out = Buffer.alloc(width * height * 3);
let redPx = 0;
let navyPx = 0;

for (let i = 0, p = 0; i < data.length; i += channels, p += 3) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = (r + g + b) / 3;

  const isRed = r - g > 40 && r - b > 35 && sat > 0.45;
  const isInk = lum < 210;

  let c;
  if (!isInk) c = WHITE;
  else if (isRed) {
    c = RED;
    redPx++;
  } else {
    c = NAVY;
    navyPx++;
  }

  out[p] = c[0];
  out[p + 1] = c[1];
  out[p + 2] = c[2];
}

await sharp(out, { raw: { width, height, channels: 3 } })
  .png({ compressionLevel: 9 })
  .toFile(`${OUT}/flat-3color.png`);

console.log("size:", width, "x", height, "red:", redPx, "navy:", navyPx);
