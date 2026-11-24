import sharp from "sharp";

/**
 * Direct raster logo: take the quantised flat image (red + navy + white),
 * turn white into transparency, and trim to the artwork bounds.
 * This preserves every detail including the thin speed-line strokes.
 */
const OUT = "scripts/logo";

const { data, info } = await sharp(`${OUT}/flat-3color.png`)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const out = Buffer.alloc(width * height * 4);
let minX = width, minY = height, maxX = -1, maxY = -1;

for (let i = 0, p = 0; i < data.length; i += channels, p += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const isWhite = r === 255 && g === 255 && b === 255;
  if (!isWhite) {
    const x = (i / channels) % width;
    const y = Math.floor((i / channels) / width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    out[p] = r; out[p + 1] = g; out[p + 2] = b; out[p + 3] = 255;
  }
}
console.log("artwork bbox:", minX, minY, maxX, maxY);

const pad = 8;
const left = Math.max(0, minX - pad), top = Math.max(0, minY - pad);
const w = Math.min(width, maxX + pad + 1) - left;
const h = Math.min(height, maxY + pad + 1) - top;

// Upscale the tight crop x4 for crisp large renders (nearest to keep hard edges? no - lanczos for smooth)
const tight = await sharp(out, { raw: { width, height, channels: 4 } })
  .extract({ left, top, width: w, height: h })
  .resize({ width: w * 4, kernel: "lanczos3" })
  .png()
  .toBuffer();

await sharp(tight).toFile(`${OUT}/zaqone-logo.png`);
// Smaller sizes
await sharp(tight).resize({ width: 1024 }).png().toFile(`${OUT}/zaqone-logo-1024.png`);
await sharp(tight).resize({ width: 512 }).png().toFile(`${OUT}/zaqone-logo-512.png`);
await sharp(tight).resize({ width: 256 }).png().toFile(`${OUT}/zaqone-logo-256.png`);

// White background variant
const small = await sharp(tight).resize({ width: 1024 }).png().toBuffer();
const smallMeta = await sharp(small).metadata();
await sharp({ create: { width: smallMeta.width, height: smallMeta.height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
  .composite([{ input: small }])
  .png()
  .toFile(`${OUT}/zaqone-logo-white-1024.png`);

// Wing mark: crop top region (wing + speed lines) then square
const probe = await sharp(tight).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const pw = probe.info.width, ph = probe.info.height, pch = probe.info.channels;
let wMinX = pw, wMinY = ph, wMaxX = -1, wMaxY = -1;
const cutoff = Math.floor(ph * 0.5);
for (let y = 0; y < cutoff; y++) {
  for (let x = 0; x < pw; x++) {
    if (probe.data[(y * pw + x) * pch + 3] > 8) {
      if (x < wMinX) wMinX = x;
      if (x > wMaxX) wMaxX = x;
      if (y < wMinY) wMinY = y;
      if (y > wMaxY) wMaxY = y;
    }
  }
}
console.log("wing bbox:", wMinX, wMinY, wMaxX, wMaxY, "of", pw, ph);

const size = Math.max(wMaxX - wMinX, wMaxY - wMinY) + 12;
const sx = Math.max(0, wMinX - 6 + (wMaxX - wMinX - size) / 2 | 0);
const sy = Math.max(0, wMinY - 6);

const mark = await sharp(tight)
  .extract({ left: Math.round(sx), top: Math.round(sy), width: Math.min(size, pw - Math.round(sx)), height: Math.min(size, ph - Math.round(sy)) })
  .resize({ width: 512, height: 512, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await sharp(mark).toFile(`${OUT}/zaqone-mark-512.png`);
await sharp(mark).resize({ width: 256 }).png().toFile(`${OUT}/zaqone-mark-256.png`);
await sharp(mark).resize({ width: 32 }).png().toFile(`${OUT}/zaqone-mark-32.png`);

console.log("done");
