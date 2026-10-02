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

const browser = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find(existsSync);
if (!browser) throw new Error("no Edge or Chrome found");

const child = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "kaeru-hero-"))}`,
  "--hide-scrollbars",
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
  await send("Page.navigate", { url });
  await sleep(settleMs);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(output, Buffer.from(shot.result.data, "base64"));
  console.log(`wrote ${output}`);
  socket.close();
} finally {
  child.kill();
}
