import fs from "node:fs";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";

const OUT = "scripts/logo";
const svg = fs.readFileSync(`${OUT}/zaqone-logo.svg`, "utf8");
const viewBox = svg.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
const [vx, vy, vw, vh] = viewBox;
console.log("viewBox:", viewBox);

// Render at large width and locate the wing (top) region bounds.
const probe = new Resvg(svg, {
  fitTo: { mode: "width", value: 2000 },
  background: "rgba(0,0,0,0)",
}).render();
const { data, info } = await sharp(probe.asPng())
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

// Wing occupies roughly the top 38% of the lockup (before the wordmark).
const cutoff = Math.floor(height * 0.42);
let minX = width, minY = height, maxX = -1, maxY = -1;
for (let y = 0; y < cutoff; y++) {
  for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * channels + 3] > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
console.log("wing bbox:", minX, minY, maxX, maxY);

const pad = 6;
const mx = Math.max(0, minX - pad);
const my = Math.max(0, minY - pad);
const mw = maxX + pad - mx;
const mh = maxY + pad - my;

// Square viewBox centred on the wing so it scales nicely as a favicon
const size = Math.max(mw, mh);
const sx = mx + mw / 2 - size / 2;
const sy = my + mh / 2 - size / 2;

const markSvg = svg.replace(
  /viewBox="[^"]*"/,
  `viewBox="${sx} ${sy} ${size} ${size}"`,
);
fs.writeFileSync(`${OUT}/zaqone-mark.svg`, markSvg);

for (const w of [512, 256, 128, 64, 32]) {
  fs.writeFileSync(
    `${OUT}/zaqone-mark-${w}.png`,
    new Resvg(markSvg, {
      fitTo: { mode: "width", value: w },
      background: "rgba(0,0,0,0)",
    })
      .render()
      .asPng(),
  );
}
console.log("mark done");
