import sharp from "sharp";

// Side-by-side comparison: source vs traced logo
const src = await sharp("scripts/logo/source.jpg").resize({ width: 800 }).png().toBuffer();
const traced = await sharp("scripts/logo/zaqone-logo.png").resize({ width: 800 }).png().toBuffer();

const srcMeta = await sharp(src).metadata();
const trMeta = await sharp(traced).metadata();

await sharp({
  create: { width: 800, height: srcMeta.height + trMeta.height + 20, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .composite([
    { input: src, top: 0, left: 0 },
    { input: traced, top: srcMeta.height + 20, left: 0 },
  ])
  .png()
  .toFile("scripts/logo/compare.png");

console.log("src:", srcMeta.width, srcMeta.height);
console.log("traced:", trMeta.width, trMeta.height);
