// Renders demo/hero.html with a real-time headless browser and writes docs/hero.png.
// Real time matters: the count-up and the page's row measuring both run on animation frames.
// Needs the demo server running (`pnpm exec vite --config vite.demo.config.ts`, port 5178)
// and Edge or Chrome installed. Usage: `pnpm run hero:capture`.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, "../../../docs/hero.png");
const url = process.env.HERO_URL ?? "http://localhost:5178/product-demo/demo/hero.html";
const settleMs = 9000;
const port = 9333;

// Chrome first: Edge can force-dark the capture when Windows is in dark mode.
const browser = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find(existsSync);
if (!browser) throw new Error("no Edge or Chrome found");

// A browser left over from an earlier run would answer on this port and be captured instead.
if (await fetch(`http://127.0.0.1:${port}/json/version`).then(() => true, () => false)) {
  throw new Error(`something already listens on :${port}; close that browser first`);
}

const child = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "kaeru-hero-"))}`,
  "--hide-scrollbars",
  // Capture what the page draws, not what the browser would do to it at night.
  "--disable-features=WebContentsForceDark,Translate",
  "--window-size=2000,1200",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  let targets;
  for (let attempt = 0; !targets && attempt < 50; attempt += 1) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); }
  }
  const page = targets?.find((target) => target.type === "page");
  if (!page) throw new Error("browser did not start");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    pending.get(message.id)?.(message);
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    id += 1;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });

  await send("Emulation.setDeviceMetricsOverride", { width: 2000, height: 1200, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setAutoDarkModeOverride", { enabled: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await send("Page.navigate", { url });
  await sleep(settleMs);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(output, Buffer.from(shot.result.data, "base64"));
  console.log(`wrote ${output}`);
  // Edge relaunches itself, so the spawned process is not the browser: ask it to quit.
  await send("Browser.close");
  socket.close();
} finally {
  child.kill();
}
