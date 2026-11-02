// Builds dist/: the library index, one folder per sheet (HTML, Markdown, JSON, PDF) and assets.
// Usage: node src/build.mjs [--no-pdf] [--strict]

import { mkdir, writeFile, readFile, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSheets, loadMap, isWritten } from "./sheets.mjs";
import { renderSheet } from "./render-sheet.mjs";
import { renderIndex } from "./render-index.mjs";
import { toMarkdown, toChecklist } from "./markdown.mjs";
import { buildPdfs } from "./pdf.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const site = JSON.parse(await readFile(path.join(root, "site.config.json"), "utf8"));

const sheets = await loadSheets(path.join(root, "content", "sheets"));
const map = await loadMap(path.join(root, "content", "map.json"), sheets);
const written = sheets.filter(isWritten);

await rm(dist, { recursive: true, force: true });
await cp(path.join(root, "assets"), path.join(dist, "assets"), { recursive: true });
await cp(path.join(root, "src", "freshness.mjs"), path.join(dist, "assets", "freshness.mjs"));

for (const sheet of written) {
  const dir = path.join(dist, sheet.slug);
  await mkdir(dir, { recursive: true });
  const page = renderSheet(sheet, { site, place: map.placeOf(sheet), checklist: toChecklist(sheet, site) });
  await writeFile(path.join(dir, "index.html"), page);
  await writeFile(path.join(dir, `${sheet.slug}.md`), toMarkdown(sheet, site));
  await writeFile(path.join(dir, `${sheet.slug}.json`), JSON.stringify(sheet, null, 2));
  console.log(`HTML ${sheet.slug}/`);
}
await writeFile(path.join(dist, "index.html"), renderIndex(sheets, { site, map }));
console.log(`HTML index (${written.length} written, ${sheets.length - written.length} planned)`);

if (!process.argv.includes("--no-pdf")) {
  const problems = await buildPdfs(written, dist);
  // CI builds with --strict, so a missing browser or an overlong sheet fails the check.
  if (problems.length && process.argv.includes("--strict")) {
    console.error(`Build failed:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
}
