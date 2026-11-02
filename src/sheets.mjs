import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// "planned" sheets only appear in the index; "draft" and "published" sheets get a page and a PDF.
export const isWritten = (sheet) => sheet.status === "draft" || sheet.status === "published";

const REQUIRED = ["title", "short", "answer", "audience", "version", "lastReviewed", "reviewEveryDays", "blocks", "changes", "sources"];

// Loads content/sheets/*.json (files starting with "_" are templates) and fails loudly on gaps.
export async function loadSheets(dir) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const sheets = [];
  for (const file of files) {
    const sheet = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    const need = ["slug", "topic", "status", "capability", ...(isWritten(sheet) ? REQUIRED : [])];
    const missing = need.filter((key) => sheet[key] == null);
    if (missing.length) throw new Error(`${file}: missing ${missing.join(", ")}`);
    if (isWritten(sheet) && !/^\d{4}-\d{2}-\d{2}$/.test(sheet.lastReviewed)) {
      throw new Error(`${file}: lastReviewed must be YYYY-MM-DD`);
    }
    sheets.push(sheet);
  }
  return sheets.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.topic.localeCompare(b.topic));
}

// Loads content/map.json and places each sheet in its capability ("domain/capability").
// One sheet per capability keeps the map readable: if a topic needs two, split the capability.
export async function loadMap(file, sheets) {
  const map = JSON.parse(await readFile(file, "utf8"));
  const places = new Map();
  for (const domain of map.domains) {
    for (const capability of domain.capabilities) places.set(`${domain.id}/${capability.id}`, { domain, capability });
  }
  for (const sheet of sheets) {
    const place = places.get(sheet.capability);
    if (!place) throw new Error(`${sheet.slug}: capability "${sheet.capability}" is not in content/map.json`);
    if (place.capability.sheet) throw new Error(`${sheet.slug}: "${sheet.capability}" already has the sheet "${place.capability.sheet.slug}"`);
    place.capability.sheet = sheet;
  }
  return { domains: map.domains, placeOf: (sheet) => places.get(sheet.capability) };
}
