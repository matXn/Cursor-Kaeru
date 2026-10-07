// Builds the release installer end to end:
//   desktop NSIS package ──► src-tauri/payload/ ──► acrylic setup exe ──► target/release/bundle/setup/
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const setup = join(dirname(fileURLToPath(import.meta.url)), "..");
const desktop = join(setup, "../desktop");
const release = join(setup, "../../target/release");
const { version } = JSON.parse(readFileSync(join(desktop, "package.json"), "utf8"));
const run = (command, cwd) => execSync(command, { cwd, stdio: "inherit" });

run("pnpm exec tauri build --bundles nsis", desktop);
mkdirSync(join(setup, "src-tauri/payload"), { recursive: true });
copyFileSync(
  join(release, `bundle/nsis/Cursor Kaeru_${version}_x64-setup.exe`),
  join(setup, "src-tauri/payload/cursor-kaeru-nsis.exe"),
);

run("pnpm exec tauri build", setup);
const output = join(release, "bundle/setup");
mkdirSync(output, { recursive: true });
const installer = join(output, `Cursor Kaeru_${version}_x64-setup.exe`);
copyFileSync(join(release, "cursor-kaeru-setup.exe"), installer);
console.log(`\n${installer}`);
