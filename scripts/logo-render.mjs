import fs from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const OUT = "scripts/logo";
let svg = fs.readFileSync(`${OUT}/zaqone-logo.svg`, "utf8");

// Report viewBox
const vb = svg.match(/viewBox="([^"]+)"/);
console.log("viewBox:", vb?.[1]);

const render = (svgStr, width) => {
  const r = new Resvg(svgStr, {
    fitTo: { mode: "width", value: width },
    background: "rgba(0,0,0,0)",
  });
  return r.render();
};

// Full lockup at high res
for (const w of [512, 1024, 2048]) {
  const img = render(svg, w);
  fs.writeFileSync(`${OUT}/zaqone-logo-${w}.png`, img.asPng());
  console.log(`wrote ${w}px`);
}
