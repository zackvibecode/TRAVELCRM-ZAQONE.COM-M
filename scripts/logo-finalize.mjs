import fs from "node:fs";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";

const OUT = "scripts/logo";
const svgPath = `${OUT}/zaqone-logo.svg`;
let svg = fs.readFileSync(svgPath, "utf8");

// Split into <path> blocks and report fills
const paths = [...svg.matchAll(/<path\b[^>]*\/>/g)].map((m) => m[0]);
console.log("path count:", paths.length);
for (const p of paths) {
  const fill = p.match(/fill="([^"]+)"/)?.[1];
  const d = p.match(/d="([^"]*)"/)?.[1] ?? "";
  console.log(" fill:", fill, "dlen:", d.length);
}

// Drop the white layer(s) - the canvas backdrop and the letter counters.
// On a transparent background those counters must stay transparent, not white.
let withoutWhite = svg.replace(
  /<path\b[^>]*fill="rgb\(255,255,255\)"[^>]*\/>/g,
  "",
);
console.log("removed white paths:", paths.length - [...withoutWhite.matchAll(/<path\b/g)].length);

// Restore the original traced dimensions for the viewBox
withoutWhite = withoutWhite.replace(
  /viewBox="[^"]*"/,
  'viewBox="0 0 1600 1200"',
);
fs.writeFileSync(svgPath, withoutWhite);

// Render + trim to the real artwork bounds
const probe = new Resvg(withoutWhite, {
  fitTo: { mode: "width", value: 2000 },
  background: "rgba(0,0,0,0)",
}).render();
const { data, info } = await sharp(probe.asPng())
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

let minX = width, minY = height, maxX = -1, maxY = -1;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * channels + 3] > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
console.log("bbox:", minX, minY, maxX, maxY, "of", width, height);

const pad = 6;
const vbX = Math.max(0, minX - pad);
const vbY = Math.max(0, minY - pad);
const vbW = Math.min(width, maxX + pad) - vbX;
const vbH = Math.min(height, maxY + pad) - vbY;

const finalSvg = withoutWhite
  .replace(/<svg([^>]*)width="\d+"/, "<svg$1")
  .replace(/<svg([^>]*)height="\d+"/, "<svg$1")
  .replace(/viewBox="[^"]*"/, `viewBox="${vbX} ${vbY} ${vbW} ${vbH}"`)
  .replace(/<svg(?![^>]*viewBox)/, `<svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}"`);
fs.writeFileSync(svgPath, finalSvg);
console.log("final viewBox:", vbX, vbY, vbW, vbH);

const renderPng = (w, file) =>
  fs.writeFileSync(
    file,
    new Resvg(finalSvg, {
      fitTo: { mode: "width", value: w },
      background: "rgba(0,0,0,0)",
    })
      .render()
      .asPng(),
  );

renderPng(2048, `${OUT}/zaqone-logo.png`);
renderPng(1024, `${OUT}/zaqone-logo-1024.png`);
renderPng(512, `${OUT}/zaqone-logo-512.png`);
renderPng(256, `${OUT}/zaqone-logo-256.png`);

// White-background variants (for og:image, favicon fallback, printing)
const whiteSvg = finalSvg.replace(
  /(<svg[^>]*>)/,
  `$1<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#ffffff"/>`,
);
fs.writeFileSync(`${OUT}/zaqone-logo-white.svg`, whiteSvg);
for (const w of [1024, 512]) {
  fs.writeFileSync(
    `${OUT}/zaqone-logo-white-${w}.png`,
    new Resvg(whiteSvg, {
      fitTo: { mode: "width", value: w },
      background: "#ffffff",
    })
      .render()
      .asPng(),
  );
}
console.log("done");
