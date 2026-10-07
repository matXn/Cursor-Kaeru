// Renders the NSIS installer art in src-tauri/installer/*.svg to the 24-bit BMPs NSIS requires.
// Run after editing the SVGs: `node scripts/installer-art.mjs`. Uses the sharp that the
// Tauri/Vite toolchain already installs under node_modules/.pnpm.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const store = join(root, "node_modules/.pnpm");
const sharpDir = readdirSync(store).find((name) => name.startsWith("sharp@"));
if (!sharpDir) throw new Error("sharp is not installed; run pnpm install first");
const sharp = createRequire(import.meta.url)(join(store, sharpDir, "node_modules/sharp"));
const art = join(root, "src-tauri/installer");

for (const name of ["sidebar", "header"]) {
  const { data, info } = await sharp(readFileSync(join(art, `${name}.svg`)))
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  writeFileSync(join(art, `${name}.bmp`), bmp(data, info.width, info.height));
  console.log(`${name}.bmp ${info.width}×${info.height}`);
}

/** Bottom-up BGR rows padded to four bytes, behind a BITMAPFILEHEADER and BITMAPINFOHEADER. */
function bmp(rgb, width, height) {
  const stride = Math.ceil((width * 3) / 4) * 4;
  const file = Buffer.alloc(54 + stride * height);
  file.write("BM", 0, "ascii");
  file.writeUInt32LE(file.length, 2);
  file.writeUInt32LE(54, 10);
  file.writeUInt32LE(40, 14);
  file.writeInt32LE(width, 18);
  file.writeInt32LE(height, 22);
  file.writeUInt16LE(1, 26);
  file.writeUInt16LE(24, 28);
  file.writeUInt32LE(stride * height, 34);
  file.writeInt32LE(2835, 38);
  file.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y += 1) {
    const row = 54 + (height - 1 - y) * stride;
    for (let x = 0; x < width; x += 1) {
      const from = (y * width + x) * 3;
      file[row + x * 3] = rgb[from + 2];
      file[row + x * 3 + 1] = rgb[from + 1];
      file[row + x * 3 + 2] = rgb[from];
    }
  }
  return file;
}
