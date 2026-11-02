import { esc } from "./lib.mjs";

// The mark is a tiny capability map: one covered cell, one being written, two gaps.
const mark = `<svg class="mark" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
  <rect x="0" y="0" width="9" height="9" class="mark__covered"/>
  <rect x="11.75" y="0.75" width="7.5" height="7.5" class="mark__planned"/>
  <rect x="0" y="11" width="9" height="9" class="mark__gap"/>
  <rect x="11" y="11" width="9" height="9" class="mark__gap"/>
</svg>`;

// Shared page shell. `root` is the relative path back to the site root, so the output works
// from any subfolder and from file:// (which is how the PDFs are rendered).
export function page({ site, root, title, description, bodyClass = "", head = "", body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="${root}assets/mark.svg" type="image/svg+xml">
<link rel="preload" href="${root}assets/fonts/atkinson-hyperlegible-next-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}assets/site.css">
${head}
<script type="module" src="${root}assets/site.js"></script>
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="${root}">${mark}<span>${esc(site.name)}</span></a>
  <nav aria-label="Site">
    <a href="${root}#map">Capability map</a>
    <a href="${root}#sheets">Sheets</a>
    <a href="${root}#how">How we review</a>
  </nav>
</header>
${body}
<footer class="site-footer">
  <div class="site-footer__inner">
    <p class="site-footer__brand">${mark}<span>${esc(site.name)}</span></p>
    <p class="site-footer__about">${esc(site.description)}</p>
    <nav aria-label="Footer">
      <a href="${root}#map">Capability map</a>
      <a href="${root}#how">How we review</a>
      <a href="${esc(site.repoUrl)}">Source and review history on GitHub</a>
    </nav>
  </div>
</footer>
</body>
</html>
`;
}
