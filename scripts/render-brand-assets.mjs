/**
 * Renders the brand images from their HTML sources in `design/` with the
 * Chromium that is already on the machine (Edge or Chrome), so the share
 * image uses the very fonts and colors of the site and no extra dependency
 * is needed.
 *
 *   node scripts/render-brand-assets.mjs
 *
 * Outputs: public/og.png (1200x630) and src/app/apple-icon.png (180x180).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const browser = CANDIDATES.find((path) => existsSync(path));
if (!browser) {
  console.error("No Edge, Chrome or Chromium found. Install one and retry.");
  process.exit(1);
}

const JOBS = [
  {
    source: "design/og.html",
    target: "public/og.png",
    width: 1200,
    height: 630,
  },
  {
    source: "design/apple-icon.html",
    target: "src/app/apple-icon.png",
    width: 180,
    height: 180,
  },
];

for (const { source, target, width, height } of JOBS) {
  const output = resolve(root, target);
  execFileSync(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${width},${height}`,
      "--virtual-time-budget=3000",
      `--screenshot=${output}`,
      pathToFileURL(resolve(root, source)).href,
    ],
    { stdio: "ignore" },
  );

  // PNG header: width and height are big-endian at bytes 16 and 20.
  const png = readFileSync(output);
  const actual = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
  if (actual !== `${width}x${height}`) {
    throw new Error(
      `${target} came out ${actual}, expected ${width}x${height}`,
    );
  }
  console.log(`${target}  ${actual}  ${(png.length / 1024).toFixed(0)} KB`);
}
