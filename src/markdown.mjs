// Markdown export (full sheet) and the shorter checklist used by "Copy as checklist".

import { mdInline, strip, formatDate, addDays, splitDuration, shortDuration } from "./lib.mjs";

export function toMarkdown(sheet, site) {
  const ids = sheet.sources.map((s) => s.id);
  const md = (text) => mdInline(text, ids);
  const out = [
    `# ${sheet.title}`,
    "",
    md(sheet.answer),
    "",
    `Version ${sheet.version}${sheet.status === "draft" ? " (draft)" : ""}. Reviewed ${formatDate(sheet.lastReviewed)}, next review ${formatDate(addDays(sheet.lastReviewed, sheet.reviewEveryDays))}.`,
    `Latest version: ${site.baseUrl}/${sheet.slug}/`,
  ];

  for (const block of sheet.blocks) {
    out.push("", `## ${block.title}`, "");
    if (block.intro) out.push(md(block.intro), "");
    out.push(...BLOCKS[block.type](block, md));
  }

  out.push("", "## What changed", "", ...sheet.changes.map((c) => `- ${formatDate(c.date)}, version ${c.version}: ${md(c.text)}`));
  out.push("", "## Sources", "", ...sheet.sources.map((s, i) => `${i + 1}. ${s.title}. ${s.publisher}${s.date ? `, ${s.date}` : ""}. ${s.url}`));
  return out.join("\n") + "\n";
}

const item = (i, md) => (typeof i === "string" ? md(i) : `**${i.title}** ${md(i.text)}`);

const BLOCKS = {
  clock: (b, md) => [
    "| Tier | Applies when | Contain in | Fix within |",
    "| --- | --- | --- | --- |",
    ...b.tiers.map((t) => `| ${t.name} | ${md(t.qualifies)} | ${t.contain ? shortDuration(t.contain) : ""} | ${fmt(t.fix)} |`),
    ...(b.caption ? ["", md(b.caption)] : []),
  ],
  ranked: (b, md) => b.items.map((i, n) => `${n + 1}. ${item(i, md)}`),
  steps: (b, md) => b.items.map((i, n) => `${n + 1}. ${item(i, md)}`),
  list: (b, md) => b.items.map((i) => `- ${md(i)}`),
  columns: (b, md) => b.columns.flatMap((c) => [`### ${c.title}`, "", ...c.items.map((i) => `- ${md(i)}`), ""]),
  timelines: (b, md) =>
    b.items.flatMap((t) => [`### ${t.name}`, "", md(t.scope), "", ...t.steps.map((s) => `- **${s.at}:** ${md(s.what)}`), ""]),
};

const fmt = (d) => {
  const { n, unit } = splitDuration(d);
  return `${n} ${unit}`;
};

// A paste-able task list: the ranked actions and the deadline tiers, without citations.
export function toChecklist(sheet, site) {
  const lines = [`${sheet.title} (version ${sheet.version}, reviewed ${formatDate(sheet.lastReviewed)})`, `${site.baseUrl}/${sheet.slug}/`];
  for (const block of sheet.blocks) {
    if (block.type === "ranked") {
      lines.push("", block.title, ...block.items.map((i) => `- [ ] ${strip(typeof i === "string" ? i : `${i.title} ${i.text}`)}`));
    }
    if (block.type === "clock") {
      lines.push(
        "",
        block.title,
        ...block.tiers.map((t) => `- [ ] ${t.name}: ${t.contain ? `contain in ${fmt(t.contain)}, ` : ""}fix within ${fmt(t.fix)}`)
      );
    }
  }
  return lines.join("\n") + "\n";
}
