import sharp from "sharp";

for (const f of ["scripts/logo/zaqone-logo.png", "scripts/logo/zaqone-logo-1024.png"]) {
  const meta = await sharp(f).metadata();
  const stats = await sharp(f).stats();
  console.log(f, "size:", meta.width, meta.height, "channels:", meta.channels);
  const alphaStats = stats.channels[3];
  if (alphaStats) console.log("  alpha:", alphaStats);
}
