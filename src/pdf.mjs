// Prints each sheet to PDF with headless Chrome or Edge, using the page's own print stylesheet.
// The browser is found automatically; set CHROME_PATH to point at a specific one.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const run = promisify(execFile);
const MAX_PAGES = 2; // one sheet of paper, front and back

const BROWSERS = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export async function buildPdfs(sheets, dist) {
  const browser = BROWSERS.find((p) => p && existsSync(p));
  if (!browser) {
    console.warn("PDF  skipped: no Chrome or Edge found. Set CHROME_PATH to enable PDFs.");
    return;
  }
  // A throwaway profile keeps headless runs from colliding with a browser that's already open.
  const profile = await mkdtemp(path.join(os.tmpdir(), "sheet-pdf-"));
  try {
    for (const sheet of sheets) {
      const dir = path.join(dist, sheet.slug);
      const out = path.join(dir, `${sheet.slug}.pdf`);
      await run(browser, [
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        `--user-data-dir=${profile}`,
        "--virtual-time-budget=15000", // gives web fonts time to load before printing
        `--print-to-pdf=${out}`,
        pathToFileURL(path.join(dir, "index.html")).href,
      ]);
      // Chrome writes page objects uncompressed, so counting them is enough to catch overflow.
      const pages = (await readFile(out, "latin1")).match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
      console.log(`PDF  ${sheet.slug}/${sheet.slug}.pdf (${pages} pages)`);
      if (pages > MAX_PAGES) console.warn(`     ${sheet.slug} is ${pages} pages; cheat sheets should fit on ${MAX_PAGES}.`);
    }
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
}
