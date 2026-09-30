// Builds the bundled Chinese UI font: HarmonyOS Sans SC cut down to the characters this app
// actually renders (UI strings, server messages, built-in plugins) plus common punctuation.
// Run after adding Chinese copy:  pnpm run fonts:cjk [font-directory]
// Characters outside the subset fall back to the system Chinese font.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopRoot, "../..");
const fontDirectory = process.argv[2] ?? "C:/Windows/Fonts";
const output = path.join(desktopRoot, "src/shared/assets/fonts");

// Medium is preferred for the 500 weight; Bold stands in when Medium is not installed.
const faces = [
  { weight: 400, sources: ["HarmonyOS_Sans_SC_Regular.ttf"] },
  { weight: 500, sources: ["HarmonyOS_Sans_SC_Medium.ttf", "HarmonyOS_Sans_SC_Bold.ttf"] },
];

const scanned = [
  path.join(desktopRoot, "src"),
  path.join(repoRoot, "server/src"),
  path.join(repoRoot, "server/plugins"),
];
const extensions = new Set([".ts", ".tsx", ".json", ".rs", ".js", ".mjs", ".md"]);
const extra = "，。、；：？！“”‘’（）《》【】—…·「」『』～％＋－＝／０１２３４５６７８９";

function* files(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "target") continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (extensions.has(path.extname(entry.name))) yield full;
  }
}

const characters = new Set(extra);
for (const directory of scanned) {
  for (const file of files(directory)) {
    for (const character of fs.readFileSync(file, "utf8")) {
      if (/[\u3000-\u303f\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/u.test(character)) characters.add(character);
    }
  }
}
const text = [...characters].join("");

for (const face of faces) {
  const source = face.sources.map((name) => path.join(fontDirectory, name)).find((file) => fs.existsSync(file));
  if (!source) throw new Error(`HarmonyOS Sans SC ${face.weight} not found in ${fontDirectory} (tried ${face.sources.join(", ")})`);
  const subset = await subsetFont(fs.readFileSync(source), text, { targetFormat: "woff2" });
  const target = path.join(output, `HarmonyOSSansSC-${face.weight}.woff2`);
  fs.writeFileSync(target, subset);
  console.log(`${path.basename(source)} → ${path.relative(desktopRoot, target)} (${characters.size} chars, ${Math.round(subset.length / 1024)} KB)`);
}
