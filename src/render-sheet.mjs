// Renders one cheat sheet. The <article> is the printable document; the rail beside it is screen-only.

import { esc, inline, strip, parseDuration, splitDuration, shortDuration, formatDate, addDays, cssString } from "./lib.mjs";
import { page } from "./layout.mjs";

export function renderSheet(sheet, { site, checklist }) {
  const ids = sheet.sources.map((s) => s.id);
  const t = (text) => inline(text, ids);
  const nextReview = addDays(sheet.lastReviewed, sheet.reviewEveryDays);
  const url = `${site.baseUrl}/${sheet.slug}/`;
  const draft = sheet.status === "draft";

  const body = `
<main id="main" class="sheet-layout">
  <article class="sheet">
    ${draft ? `<p class="note note--draft">Draft for review. Check the facts and deadlines before this goes public.</p>` : ""}
    <p class="note note--stale" data-stale hidden>This sheet is past its review date. Deadlines or advice may have changed since ${formatDate(sheet.lastReviewed)}.</p>
    <header class="sheet__head">
      <h1>${esc(sheet.title)}</h1>
      <p class="answer">${t(sheet.answer)}</p>
      <dl class="meta">
        <div><dt>Reviewed</dt><dd><time datetime="${sheet.lastReviewed}">${formatDate(sheet.lastReviewed)}</time>${freshBadge(sheet)}</dd></div>
        <div><dt>Next review</dt><dd><time datetime="${nextReview}">${formatDate(nextReview)}</time></dd></div>
        <div><dt>Version</dt><dd>${esc(sheet.version)}${draft ? " (draft)" : ""}</dd></div>
        <div><dt>Written for</dt><dd>${esc(sheet.audience)}</dd></div>
        <div class="print-only"><dt>Latest version</dt><dd>${esc(url.replace(/^https?:\/\//, ""))}</dd></div>
      </dl>
    </header>
    <div class="sheet__grid">
${sheet.blocks.map((block) => renderBlock(block, t)).join("\n")}
    </div>
    <footer class="sheet__foot">
      <section aria-labelledby="changes-title">
        <h2 id="changes-title">What changed</h2>
        <dl class="changes">${sheet.changes.map((c) => `
          <div><dt><time datetime="${c.date}">${formatDate(c.date)}</time>, version ${esc(c.version)}</dt><dd>${t(c.text)}</dd></div>`).join("")}
        </dl>
      </section>
      <section id="sources" aria-labelledby="sources-title">
        <h2 id="sources-title">Sources</h2>
        <ol class="sources">${sheet.sources.map((s) => `
          <li id="src-${esc(s.id)}"><a href="${esc(s.url)}">${esc(s.title)}</a>. ${esc(s.publisher)}${s.date ? `, ${esc(s.date)}` : ""}. <span class="sources__host">${esc(new URL(s.url).hostname.replace(/^www\./, ""))}</span></li>`).join("")}
        </ol>
      </section>
    </footer>
  </article>
${rail(sheet)}
  <textarea id="sheet-checklist" hidden readonly>${esc(checklist)}</textarea>
</main>`;

  return page({
    site,
    root: "../",
    title: `${sheet.title} | ${site.name}`,
    description: strip(sheet.answer),
    bodyClass: "page-sheet",
    head: printFooter(sheet, url),
    body,
  });
}

const freshBadge = (sheet) =>
  ` <span class="fresh" data-fresh data-reviewed="${sheet.lastReviewed}" data-every="${sheet.reviewEveryDays}" hidden></span>`;

function rail(sheet) {
  const pdfName = `${sheet.slug}-cheat-sheet-${sheet.lastReviewed}.pdf`;
  const toc = sheet.blocks.map((b) => `<li><a href="#${esc(b.id)}">${esc(b.navTitle ?? b.title)}</a></li>`).join("");
  return `  <aside class="rail" aria-label="Sheet tools">
    <div class="rail__group rail__actions">
      <h2 class="rail__title">Take it with you</h2>
      <a class="button button--primary" href="${sheet.slug}.pdf" download="${pdfName}">Download PDF</a>
      <button class="button" type="button" data-copy="sheet-checklist">Copy as checklist</button>
      <p class="rail__more"><a href="${sheet.slug}.md" download>Markdown</a><a href="${sheet.slug}.json">Data (JSON)</a></p>
      <p class="rail__status" role="status"></p>
    </div>
    <nav class="rail__group rail__toc" aria-label="On this sheet">
      <h2 class="rail__title">On this sheet</h2>
      <ul class="toc">${toc}<li><a href="#sources">Sources</a></li></ul>
    </nav>
  </aside>`;
}

// Chrome prints @page margin boxes, so every PDF page carries the version and where to find the latest one.
function printFooter(sheet, url) {
  const label = `${sheet.topic} cheat sheet, version ${sheet.version}${sheet.status === "draft" ? " (draft)" : ""}. Reviewed ${formatDate(sheet.lastReviewed)}. Latest: ${url.replace(/^https?:\/\//, "")}`;
  return `<style media="print">
@page {
  @bottom-left { content: ${cssString(label)}; font: 7.5pt "Atkinson Hyperlegible Next", sans-serif; color: #555; }
  @bottom-right { content: counter(page) " / " counter(pages); font: 7.5pt "Atkinson Hyperlegible Next", sans-serif; color: #555; }
}
</style>`;
}

// ---- Blocks -------------------------------------------------------------------------------------

const BLOCKS = { clock, ranked, steps, list, columns, timelines };

function renderBlock(block, t) {
  const render = BLOCKS[block.type];
  if (!render) throw new Error(`Unknown block type "${block.type}" in block "${block.id}"`);
  const cls = ["block", `block--${block.type}`, block.span === "full" ? "block--full" : ""].filter(Boolean).join(" ");
  return `      <section class="${cls}" id="${esc(block.id)}" aria-labelledby="${esc(block.id)}-title">
        <h2 id="${esc(block.id)}-title">${esc(block.title)}</h2>
        ${block.intro ? `<p class="block__intro">${t(block.intro)}</p>` : ""}
        ${render(block, t)}
      </section>`;
}

// Deadlines on a log time axis that starts when the fix is out. Positions are fractions (0-1) of the
// scale; CSS maps them onto the track as --pre + p * --span, which leaves room on the left for the
// optional "before the fix" zone and on the right for the deadline numerals.
function clock(block, t) {
  const max = Math.max(...block.axis.map((a) => parseDuration(a.at)), ...block.tiers.map((x) => parseDuration(x.fix)));
  const pos = (d) => (Math.log(Math.max(parseDuration(d), 1)) / Math.log(max)).toFixed(4);

  // Gridlines are real elements, not gradients: Chrome's PDF output renders hard-stop gradients as dashes.
  const grid = block.axis
    .map((a) => `<span class="tier__grid${Number(pos(a.at)) === 0 ? " is-origin" : ""}" style="--p:${pos(a.at)}"></span>`)
    .join("");

  const ticks = block.axis
    .map((a) => {
      const cls = ["clock__tick", a.minor && "is-minor", Number(pos(a.at)) === 0 && "is-origin"].filter(Boolean).join(" ");
      return `<span class="${cls}" style="--p:${pos(a.at)}">${esc(a.label ?? shortDuration(a.at))}</span>`;
    })
    .join("");
  const before = block.before ? `<p class="clock__before">${t(block.before)}</p>` : "";

  const tiers = block.tiers
    .map((tier, i) => {
      const fix = splitDuration(tier.fix);
      const contain = tier.contain
        ? `<span class="tier__contain" style="--p:${pos(tier.contain)}"><span>Contain in ${esc(shortDuration(tier.contain))}</span></span>`
        : "";
      return `
          <li class="tier" style="--tone:var(--t${tier.tone ?? i + 1}); --to:${pos(tier.fix)}; --i:${i}">
            <div class="tier__label">
              <h3 class="tier__name">${esc(tier.name)}</h3>
              <p>${t(tier.qualifies)}</p>
            </div>
            <div class="tier__track">
              <span class="tier__lines" aria-hidden="true">${grid}</span>
              <span class="tier__bar" aria-hidden="true"></span>${contain}
              <span class="tier__deadline"><span class="sr-only">Fix within </span><span class="tier__n">${fix.n}</span> <span class="tier__unit">${fix.unit}</span></span>
            </div>
          </li>`;
    })
    .join("");

  return `<figure class="clock${block.before ? " has-before" : ""}">
          <div class="clock__axis-row"><div class="clock__axis">${before}<div class="clock__ticks" aria-hidden="true">${ticks}</div></div></div>
          <ol class="clock__tiers">${tiers}
          </ol>
          ${block.caption ? `<figcaption>${t(block.caption)}</figcaption>` : ""}
        </figure>`;
}

const titled = (item, t) =>
  typeof item === "string" ? t(item) : `<h3>${esc(item.title)}</h3><p>${t(item.text)}</p>`;

function ranked(block, t) {
  return `<ol class="ranked">${block.items.map((item) => `<li><div>${titled(item, t)}</div></li>`).join("")}</ol>`;
}

function steps(block, t) {
  return `<ol class="steps">${block.items.map((item) => `<li>${titled(item, t)}</li>`).join("")}</ol>`;
}

function list(block, t) {
  return `<ul class="list">${block.items.map((item) => `<li>${t(item)}</li>`).join("")}</ul>`;
}

function columns(block, t) {
  return `<div class="columns">${block.columns
    .map((col) => `<section class="column"><h3>${esc(col.title)}</h3><ul class="list">${col.items.map((i) => `<li>${t(i)}</li>`).join("")}</ul></section>`)
    .join("")}</div>`;
}

function timelines(block, t) {
  return `<div class="timelines">${block.items
    .map(
      (item) => `<section class="timeline">
          <h3>${esc(item.name)}</h3>
          <p class="timeline__scope">${t(item.scope)}</p>
          <ol class="timeline__steps" style="--n:${item.steps.length}">${item.steps
            .map((s) => `<li><span class="timeline__at">${esc(s.at)}</span><span class="timeline__what">${t(s.what)}</span></li>`)
            .join("")}</ol>
        </section>`
    )
    .join("")}</div>`;
}
