// Builds dist/: the library index (HTML and index.json), one folder per sheet (HTML, Markdown, JSON,
// PDF) and assets.
// Usage: node src/build.mjs [--no-pdf] [--strict] [--only <slug>] [--out <dir>]
// --only and --out let several people or agents check one sheet each without sharing dist/.

import { mkdir, writeFile, readFile, cp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSheets, loadMap, isWritten } from "./sheets.mjs";
import { renderSheet } from "./render-sheet.mjs";
import { renderIndex } from "./render-index.mjs";
import { toMarkdown, toChecklist } from "./markdown.mjs";
import { buildPdfs } from "./pdf.mjs";
import { strip } from "./lib.mjs";

const option = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.resolve(option("--out") ?? path.join(root, "dist"));
const only = option("--only");
const site = JSON.parse(await readFile(path.join(root, "site.config.json"), "utf8"));

const sheets = await loadSheets(path.join(root, "content", "sheets"));
const map = await loadMap(path.join(root, "content", "map.json"), sheets);
const written = sheets.filter((sheet) => isWritten(sheet) && (!only || sheet.slug === only));
if (only && !written.length) throw new Error(`--only ${only}: no draft or published sheet with that slug`);

await rm(dist, { recursive: true, force: true });
await cp(path.join(root, "assets"), path.join(dist, "assets"), { recursive: true });
await cp(path.join(root, "src", "freshness.mjs"), path.join(dist, "assets", "freshness.mjs"));

const markdown = new Map();
for (const sheet of written) {
  const dir = path.join(dist, sheet.slug);
  await mkdir(dir, { recursive: true });
  const page = renderSheet(sheet, { site, place: map.placeOf(sheet), checklist: toChecklist(sheet, site) });
  markdown.set(sheet.slug, toMarkdown(sheet, site));
  await writeFile(path.join(dir, "index.html"), page);
  await writeFile(path.join(dir, `${sheet.slug}.md`), markdown.get(sheet.slug));
  await writeFile(path.join(dir, `${sheet.slug}.json`), JSON.stringify(sheet, null, 2));
  console.log(`HTML ${sheet.slug}/`);
}
await writeFile(path.join(dist, "index.html"), renderIndex(sheets, { site, map }));
await writeFile(path.join(dist, "index.json"), JSON.stringify(catalog(), null, 2));
console.log(`HTML index (${written.length} written, ${sheets.length - written.length} planned)`);

// index.json is the machine-readable library: the map plus every sheet in this build. The security
// advisor plugin (plugins/security-advisor) discovers sheets from it, so a new sheet needs no change
// there. Paths are relative to index.json, so it works from the site and from a local dist/.
function catalog() {
  const built = new Set(written.map((sheet) => sheet.slug));
  return {
    format: 1,
    name: site.name,
    description: site.description,
    baseUrl: site.baseUrl,
    domains: map.domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      capabilities: domain.capabilities.map(({ id, name, sheet }) => ({
        id,
        name,
        ...(sheet && built.has(sheet.slug) ? { sheet: sheet.slug } : sheet?.status === "planned" ? { planned: true } : {}),
      })),
    })),
    sheets: written.map((sheet) => ({
      slug: sheet.slug,
      topic: sheet.topic,
      capability: sheet.capability,
      status: sheet.status,
      title: sheet.title,
      short: strip(sheet.short),
      answer: strip(sheet.answer),
      audience: sheet.audience,
      version: sheet.version,
      lastReviewed: sheet.lastReviewed,
      reviewEveryDays: sheet.reviewEveryDays,
      url: `${site.baseUrl}/${sheet.slug}/`,
      markdown: `${sheet.slug}/${sheet.slug}.md`,
      json: `${sheet.slug}/${sheet.slug}.json`,
      sha256: createHash("sha256").update(markdown.get(sheet.slug)).digest("hex"),
    })),
  };
}

if (!process.argv.includes("--no-pdf")) {
  const problems = await buildPdfs(written, dist);
  // CI builds with --strict, so a missing browser or an overlong sheet fails the check.
  if (problems.length && process.argv.includes("--strict")) {
    console.error(`Build failed:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
}
