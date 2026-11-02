import { esc } from "./lib.mjs";

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
<link rel="preload" href="${root}assets/fonts/atkinson-hyperlegible-next-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}assets/site.css">
${head}
<script type="module" src="${root}assets/site.js"></script>
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="${root}">${esc(site.name)}</a>
  <nav aria-label="Site">
    <a href="${root}">All sheets</a>
    <a href="${root}#how">How we review</a>
  </nav>
</header>
${body}
</body>
</html>
`;
}
