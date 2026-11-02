// The overview: a capability map of every security domain, then all sheets with their short answers.

import { esc, inline, formatDate } from "./lib.mjs";
import { page } from "./layout.mjs";
import { isWritten } from "./sheets.mjs";

export function renderIndex(sheets, { site, map }) {
  const body = `
<main id="main" class="library">
  <div class="library__intro">
    <h1>Security cheat sheets that tell you what to do first</h1>
    <p class="lede">Each sheet covers one topic. It ranks the actions, sets deadlines, cites its sources and shows when it was last reviewed. When a sheet is past its review date, it says so.</p>
  </div>
${capabilityMap(map)}
  <section class="sheets" id="sheets" aria-labelledby="sheets-title">
    <h2 id="sheets-title">Sheets</h2>
    <ul class="index" role="list">${sheets.filter(isWritten).map(row).join("")}
    </ul>
  </section>
  <section class="how" id="how" aria-labelledby="how-title">
    <h2 id="how-title">How we review</h2>
    <dl>
      <div><dt>Ranked, with a skip list</dt><dd>Every sheet ranks at most five actions and names what you can skip.</dd></div>
      <div><dt>Reviewed every 30 days</dt><dd>Each sheet is checked against its sources and the latest advisories, regulations and research at least once a month. The review date is on every page and every PDF.</dd></div>
      <div><dt>Every number has a source</dt><dd>Deadlines and statistics link to the regulation, advisory or study they come from. Where a number is our own recommendation, the sheet says so.</dd></div>
    </dl>
  </section>
</main>`;

  return page({ site, root: "", title: site.name, description: site.description, bodyClass: "page-library", body });
}

// The overview links to the sheet, which carries the citations, so they are dropped here.
const short = (sheet) => inline(sheet.short, sheet.sources.map((s) => s.id)).replace(/<sup.*?<\/sup>/g, "");

const isCovered = (capability) => capability.sheet && isWritten(capability.sheet);

function capabilityMap(map) {
  const capabilities = map.domains.flatMap((d) => d.capabilities);
  return `  <section class="map" id="map" aria-labelledby="map-title">
    <div class="map__head">
      <h2 id="map-title">Capability map</h2>
      <p>Sheets cover ${capabilities.filter(isCovered).length} of ${capabilities.length} capabilities so far. Each sheet sits in one capability, so the map also shows what is still missing.</p>
      <ul class="map__legend" role="list">
        <li><span class="swatch swatch--covered"></span>Sheet available</li>
        <li><span class="swatch swatch--planned"></span>Being written</li>
        <li><span class="swatch swatch--gap"></span>Not covered yet</li>
      </ul>
    </div>
    <div class="map__grid">${map.domains.map(domain).join("")}
    </div>
  </section>`;
}

function domain(d) {
  return `
      <section class="domain" id="d-${esc(d.id)}" aria-labelledby="d-${esc(d.id)}-title">
        <h3 id="d-${esc(d.id)}-title">${esc(d.name)} <span class="domain__count">${d.capabilities.filter(isCovered).length} of ${d.capabilities.length}</span></h3>
        <ul class="domain__caps" role="list">${d.capabilities.map(capability).join("")}
        </ul>
      </section>`;
}

function capability(c) {
  if (isCovered(c)) {
    return `
          <li class="cap cap--covered">
            <a class="cap__name" href="${c.sheet.slug}/">${esc(c.name)}</a>
            <span class="cap__answer">${short(c.sheet)}</span>
          </li>`;
  }
  if (c.sheet) {
    return `
          <li class="cap cap--planned"><span class="cap__name">${esc(c.name)}</span><span class="cap__status">Being written</span></li>`;
  }
  return `
          <li class="cap cap--gap"><span class="cap__name">${esc(c.name)}</span><span class="sr-only">Not covered yet</span></li>`;
}

// Topics still being written appear only in the map; this list is what can be read today.
function row(sheet) {
  return `
    <li class="index__row">
      <a class="index__topic" href="${sheet.slug}/">${esc(sheet.topic)}</a>
      <span class="index__answer">${short(sheet)}</span>
      <span class="index__meta">
        <span>Reviewed <time datetime="${sheet.lastReviewed}">${formatDate(sheet.lastReviewed)}</time></span>
        <span class="index__badges">${sheet.status === "draft" ? `<span class="tag">Draft</span>` : ""}<span class="fresh" data-fresh data-reviewed="${sheet.lastReviewed}" data-every="${sheet.reviewEveryDays}" hidden></span></span>
        <a class="index__pdf" href="${sheet.slug}/${sheet.slug}.pdf" download="${sheet.slug}-cheat-sheet-${sheet.lastReviewed}.pdf">Download PDF</a>
      </span>
    </li>`;
}
