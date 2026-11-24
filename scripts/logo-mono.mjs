import sharp from "sharp";

const OUT = "scripts/logo";

// Take the flat 2-colour image and turn ALL ink (red + navy) into pure white
// => monochrome white logo for use on the red brand panel.
const { data, info } = await sharp(`${OUT}/flat-3color.png`)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const out = Buffer.alloc(width * height * 4);
for (let i = 0, p = 0; i < data.length; i += channels, p += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const isWhite = r === 255 && g === 255 && b === 255;
  if (!isWhite) {
    out[p] = 255; out[p + 1] = 255; out[p + 2] = 255; out[p + 3] = 255;
  }
}

const png = await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
const trimmed = await sharp(png).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
const t = trimmed.info;

// upscale x3 for crispness
const big = await sharp(trimmed.data)
  .resize({ width: t.width * 3, kernel: "lanczos3" })
  .png()
  .toBuffer();

await sharp(big).toFile(`${OUT}/zaqone-logo-mono-white.png`);
await sharp(big).resize({ width: 1024 }).png().toFile(`${OUT}/zaqone-logo-mono-white-1024.png`);
console.log("mono-white done:", t.width * 3, "x", t.height * 3);
