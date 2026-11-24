import fs from "node:fs";
import sharp from "sharp";
import Imagetracer from "imagetracerjs";

const OUT = "scripts/logo";
const input = fs.readFileSync(`${OUT}/flat-3color.png`);

// Decode to RGBA pixel array
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;

// imagetracerjs expects an ImageData-like object
const imageData = {
  width,
  height,
  data: new Uint8ClampedArray(data),
};

const options = {
  lumaMode: true,
  edgeDetection: 0,
  colorMode: "color",
  numberOfColors: 3,
  colorSampling: 2,
  minArea: 1,
  minStrokeWidth: 0.5,
  maxStrokeWidth: 500,
  pathOmitThreshold: 0.001,
  cornerThreshold: 60,
  lengthThreshold: 0.4,
  maxIterations: 10,
  minCrop: true,
  errorThreshold: 0.6,
  filterSmoothing: true,
  filterSmoothingAlpha: 0.6,
  polygonize: false,
  disableOptimize: false,
};

const svg = Imagetracer.imagedataToSVG(imageData, options);
fs.writeFileSync(`${OUT}/zaqone-logo.svg`, svg);

console.log("svg bytes:", svg.length);
