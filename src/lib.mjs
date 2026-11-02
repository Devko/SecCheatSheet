// Shared helpers: escaping, the inline text syntax, dates and durations.

export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Sheet text supports a small inline syntax:
//   **bold**   `code`   [label](https://...)   [^source-id] for a numbered citation
export function inline(text, sourceIds) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]^][^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\[\^([\w-]+)\]/g, (_, id) => {
      const n = citationNumber(id, sourceIds, text);
      return `<sup class="cite"><a href="#src-${id}" aria-label="Source ${n}">${n}</a></sup>`;
    });
}

// Same syntax for Markdown output: citations become [n], everything else is already Markdown.
export const mdInline = (text, sourceIds) =>
  String(text).replace(/\[\^([\w-]+)\]/g, (_, id) => `[${citationNumber(id, sourceIds, text)}]`);

// Plain text for meta descriptions and PDF footers.
export const strip = (text) =>
  String(text)
    .replace(/\[\^[\w-]+\]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*|`/g, "");

function citationNumber(id, sourceIds, text) {
  const n = sourceIds.indexOf(id) + 1;
  if (!n) throw new Error(`Unknown source "${id}" cited in: ${text}`);
  return n;
}

const DURATION = /^(\d+)\s*(h|d)$/;

export function parseDuration(value) {
  const m = DURATION.exec(value);
  if (!m) throw new Error(`Durations look like "72h" or "14d", got "${value}"`);
  return Number(m[1]) * (m[2] === "d" ? 24 : 1);
}

// "72h" -> { n: 72, unit: "hours" }, used for the large deadline numerals.
export function splitDuration(value) {
  parseDuration(value);
  const [, n, u] = DURATION.exec(value);
  const one = n === "1";
  return { n, unit: u === "h" ? (one ? "hour" : "hours") : one ? "day" : "days" };
}

// "72h" -> "72 h" with a narrow no-break space, for axis ticks and small labels.
export const shortDuration = (value) => {
  const { n } = splitDuration(value);
  return `${n} ${DURATION.exec(value)[2]}`;
};

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const formatDate = (iso) => DATE.format(new Date(`${iso}T00:00:00Z`));

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Escapes a string for use inside a CSS content: "..." value.
export const cssString = (value) => `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
