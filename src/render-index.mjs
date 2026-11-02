// The library index: a cheat sheet of cheat sheets. Each row leads with the sheet's short answer.

import { esc, inline, formatDate } from "./lib.mjs";
import { page } from "./layout.mjs";
import { isWritten } from "./sheets.mjs";

export function renderIndex(sheets, { site }) {
  const body = `
<main id="main" class="library">
  <div class="library__intro">
    <h1>Security cheat sheets that tell you what to do first</h1>
    <p class="lede">Each sheet covers one topic. It ranks the actions, gives real deadlines, cites its sources and shows when it was last reviewed. When a sheet is past its review date, it says so.</p>
  </div>
  <ul class="index" role="list">${sheets.map(row).join("")}
  </ul>
  <section class="how" id="how" aria-labelledby="how-title">
    <h2 id="how-title">How we review</h2>
    <dl>
      <div><dt>Ranked, with a skip list</dt><dd>Every sheet opens with at most five actions in priority order, and names what you can safely put off.</dd></div>
      <div><dt>Reviewed every 30 days</dt><dd>Each sheet is checked against its sources and the latest advisories, regulations and research at least once a month. The review date is on every page and every PDF.</dd></div>
      <div><dt>Every number has a source</dt><dd>Deadlines and statistics link to the regulation, advisory or study they come from. Where a number is our own recommendation, the sheet says so.</dd></div>
    </dl>
  </section>
</main>`;

  return page({ site, root: "", title: site.name, description: site.description, bodyClass: "page-library", body });
}

function row(sheet) {
  if (!isWritten(sheet)) {
    return `
    <li class="index__row is-planned">
      <span class="index__topic">${esc(sheet.topic)}</span>
      <span class="index__answer">Being written</span>
      <span class="index__meta"></span>
    </li>`;
  }
  const t = (text) => inline(text, sheet.sources.map((s) => s.id)).replace(/<sup.*?<\/sup>/g, "");
  return `
    <li class="index__row">
      <a class="index__topic" href="${sheet.slug}/">${esc(sheet.topic)}</a>
      <span class="index__answer">${t(sheet.short)}</span>
      <span class="index__meta">Reviewed <time datetime="${sheet.lastReviewed}">${formatDate(sheet.lastReviewed)}</time>${
        sheet.status === "draft" ? ` <span class="tag">Draft</span>` : ""
      } <span class="fresh" data-fresh data-reviewed="${sheet.lastReviewed}" data-every="${sheet.reviewEveryDays}" hidden></span></span>
    </li>`;
}
