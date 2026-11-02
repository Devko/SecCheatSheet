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
<!-- Prototype only: self-host this font before launch. Embedding Google Fonts sends visitor IP
     addresses to Google, which LG München ruled a GDPR violation in 2022 (3 O 17493/20). -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,200..800;1,200..800&display=swap">
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
