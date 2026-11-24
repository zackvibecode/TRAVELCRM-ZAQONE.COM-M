import sharp from "sharp";

// Check final logo for speed-line red pixels in the left-of-wing area
const img = await sharp("scripts/logo/zaqone-logo.png").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { data, info } = img;
const { width, height, channels } = info;

// The wing starts ~x 30% of width; scan left third, middle half vertically
let redPx = 0;
for (let y = Math.floor(height * 0.3); y < height * 0.6; y++) {
  for (let x = 0; x < width * 0.35; x++) {
    const i = (y * width + x) * channels;
    if (data[i + 3] > 100 && data[i] > 180 && data[i + 1] < 90) redPx++;
  }
}
console.log("red px left-of-wing in final:", redPx);
