// The advisor's view of the Security Cheat Sheets: where the sheets come from, how long they are
// cached, and the four operations the MCP server and the CLI expose.
//
// Nothing here lists sheets. Everything is discovered from the library's index.json, which the
// site build writes, so a new or renamed sheet needs no change to the advisor.
//
// Network access is limited on purpose: the sheet source (the published site by default) plus
// three fixed public feeds for vulnerability triage, queried only with a validated CVE ID. The
// advisor reads untrusted content (code under review, user questions), so its tools must not be
// usable as a channel to send data anywhere else.

import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SOURCE = "https://devko.github.io/SecCheatSheet";

const FEEDS = {
  kev: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
  epss: (cve) => `https://api.first.org/data/v1/epss?cve=${cve}`,
  cve: (cve) => `https://cveawg.mitre.org/api/cve/${cve}`,
};

const INDEX_TTL = 15 * 60_000; // picks up a newly deployed sheet within 15 minutes
const FEED_TTL = 6 * 60 * 60_000; // KEV is released a few times a day; EPSS daily
const TIMEOUT = 20_000;

// Same rule as src/freshness.mjs, which the site uses; a test keeps the two in step.
// The plugin is installed on its own, so it can't import files from the rest of the repository.
const GRACE_DAYS = 7;
export function freshnessStatus(lastReviewed, reviewEveryDays, today = new Date()) {
  const reviewed = new Date(`${lastReviewed}T00:00:00Z`);
  const ageDays = Math.floor((today - reviewed) / 86_400_000);
  if (Number.isNaN(ageDays) || !(reviewEveryDays > 0)) return null;
  if (ageDays <= reviewEveryDays) return "current";
  if (ageDays <= reviewEveryDays + GRACE_DAYS) return "due";
  return "overdue";
}

export function createLibrary({
  source = process.env.SECURITY_ADVISOR_SOURCE || DEFAULT_SOURCE,
  fetch = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  const remote = /^https?:\/\//.test(source);
  const base = remote ? source.replace(/\/+$/, "") : path.resolve(source);
  const cache = new Map();

  async function cached(key, ttl, load) {
    const hit = cache.get(key);
    if (hit && (ttl === Infinity || now() - hit.at < ttl)) return hit.value;
    const value = await load();
    cache.set(key, { value, at: now() });
    return value;
  }

  async function get(url, { json = false, allow404 = false } = {}) {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { "user-agent": "security-advisor" } });
    if (allow404 && res.status === 404) return null;
    if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
    return json ? res.json() : res.text();
  }

  // Reads a file of the library, relative to index.json.
  async function read(rel, opts) {
    if (remote) return get(`${base}/${rel}`, opts);
    const text = await readFile(path.join(base, rel), "utf8");
    return opts?.json ? JSON.parse(text) : text;
  }

  async function index() {
    return cached("index", INDEX_TTL, async () => {
      const idx = await read("index.json", { json: true }).catch((err) => {
        throw new Error(`Can't load the sheet index from ${base}/index.json: ${err.message}`);
      });
      if (idx.format !== 1) throw new Error(`Unsupported index format ${idx.format}; update the security-advisor plugin.`);
      return idx;
    });
  }

  const freshness = (s) => freshnessStatus(s.lastReviewed, s.reviewEveryDays, now());
  const nextReview = (s) => addDays(s.lastReviewed, s.reviewEveryDays);

  async function findSheet(name) {
    const idx = await index();
    const key = String(name ?? "").trim().toLowerCase();
    const sheet = idx.sheets.find((s) => [s.slug, s.capability, s.topic.toLowerCase()].includes(key));
    if (sheet) return sheet;
    const close = idx.sheets.filter((s) => s.slug.includes(key) || key.includes(s.slug)).map((s) => s.slug);
    throw new Error(
      `No sheet "${name}". ${close.length ? `Did you mean ${close.join(", ")}? ` : ""}Use list_sheets for all slugs.`,
    );
  }

  // Sheets are cached by content hash, so an edited sheet is fetched again as soon as the index shows it.
  const markdownOf = (s) => cached(`md:${s.slug}:${s.sha256}`, Infinity, () => read(s.markdown));
  const jsonOf = (s) => cached(`json:${s.slug}:${s.sha256}`, Infinity, () => read(s.json, { json: true }));

  function notice(s) {
    const status = freshness(s);
    const lines = [
      `> Advisor note: ${s.status} sheet, version ${s.version}, last reviewed ${s.lastReviewed}, next review ${nextReview(s)}` +
        ` (${status ?? "unknown freshness"}). Cite it as "${s.topic} sheet, version ${s.version}" with ${s.url}`,
    ];
    if (s.status === "draft") lines.push("> This sheet is a draft that hasn't been fully fact-checked. Say so when you rely on it.");
    if (status === "overdue") lines.push("> This sheet is overdue for review and may be out of date. Say so, and verify time-sensitive facts.");
    return lines.join("\n");
  }

  return {
    source: base,

    async listSheets() {
      const idx = await index();
      const bySlug = new Map(idx.sheets.map((s) => [s.slug, s]));
      const out = [
        `# ${idx.name}: ${idx.sheets.length} sheets`,
        "",
        `${idx.description} Source: ${idx.baseUrl}`,
        "Each line: slug, topic, version, freshness, then the sheet's one-line answer. Read a sheet with get_sheet.",
      ];
      const missing = [];
      for (const domain of idx.domains) {
        out.push("", `## ${domain.name}`);
        for (const cap of domain.capabilities) {
          const s = bySlug.get(cap.sheet);
          if (!s) {
            missing.push(`${cap.name}${cap.planned ? " (planned)" : ""}`);
            continue;
          }
          const flags = [s.status === "draft" ? "draft" : null, freshness(s)].filter(Boolean).join(", ");
          out.push(`- ${s.slug}: ${s.topic}, v${s.version}, ${flags}. ${s.short}`);
        }
      }
      if (missing.length) out.push("", `No sheet yet for: ${missing.join("; ")}. Answer those from general knowledge and say so.`);
      return out.join("\n");
    },

    // brief: only the answer, the ranked actions and the advice by organization size, for scanning
    // many sheets in an assessment. Block types are fixed by the build, so this works for new sheets.
    async getSheet(name, { brief = false } = {}) {
      const s = await findSheet(name);
      if (brief) return `${notice(s)}\n\n${renderBrief(await jsonOf(s))}\n\nRead the full sheet with get_sheet for steps, what to skip and common mistakes.`;
      return `${notice(s)}\n\n${await markdownOf(s)}`;
    },

    async search(query, limit = 8) {
      const idx = await index();
      const terms = [...new Set(tokens(query))];
      if (!terms.length) throw new Error("The query has no searchable words.");
      const sheets = await Promise.all(idx.sheets.map(async (s) => ({ s, chunks: chunk(await markdownOf(s)) })));
      return rank(sheets, terms, Math.min(Math.max(Number(limit) || 8, 1), 20), query);
    },

    async triage(cve, fixReleased) {
      const id = String(cve ?? "").trim().toUpperCase();
      if (!/^CVE-\d{4}-\d{4,}$/.test(id)) throw new Error(`"${cve}" isn't a CVE ID like CVE-2024-3400.`);
      if (fixReleased != null && fixReleased !== "" && Number.isNaN(Date.parse(fixReleased))) {
        throw new Error(`fix_released must be a date like 2026-11-05 or 2026-11-05T14:00Z, got "${fixReleased}".`);
      }
      const [kev, epss, record, patching] = await Promise.allSettled([
        cached("kev", FEED_TTL, () => get(FEEDS.kev, { json: true })),
        cached(`epss:${id}`, FEED_TTL, () => get(FEEDS.epss(id), { json: true })),
        cached(`cve:${id}`, FEED_TTL, () => get(FEEDS.cve(id), { json: true, allow404: true })),
        patchingSheet(),
      ]);
      return triageReport({ id, fixReleased: fixReleased || null, kev, epss, record, patching, today: now() });
    },
  };

  async function patchingSheet() {
    const idx = await index();
    const s = idx.sheets.find((x) => x.capability === "exposure/patching");
    if (!s) throw new Error("The library has no patching sheet (capability exposure/patching).");
    return { meta: s, sheet: await jsonOf(s), notice: notice(s) };
  }
}

// ---------------------------------------------------------------------------------------------
// Search: a small ranked full-text search over sheet sections. Good enough to route a question to
// the right sheets and to find a specific trap or setting across all of them.

const STOP = new Set(
  ("a an and are as at be by can do does for from has have how i if in is it its my of on or our should so " +
    "than that the their them then there these this to us was we what when where which who why will with " +
    "you your about into any all also must need want get use using vs").split(" "),
);

const stem = (w) =>
  w.length <= 4 ? w : w.replace(/ies$/, "y").replace(/(ing|ed|es)$/, "").replace(/s$/, "");

export function tokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/\[\d+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

// Splits a sheet's Markdown into searchable items (list items, table rows, paragraphs), each with
// its section heading. Version history and sources are left out: they match too much.
function chunk(md) {
  const out = [];
  let title = "";
  let section = "";
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("# ")) title = line.slice(2);
    else if (line.startsWith("## ")) section = line.slice(3);
    else if (line.startsWith("### ")) section = section.split(" › ")[0] + " › " + line.slice(4);
    else if (!line || line.startsWith("| ---") || line.startsWith("> ") || /^(Version|Latest version)/.test(line)) continue;
    else if (/^(Version history|Sources)/.test(section)) continue;
    else out.push({ title, section, text: line.replace(/^(- |\d+\. )/, "") });
  }
  return out.map((c) => ({ ...c, words: tokens(c.text), head: new Set(tokens(`${c.title} ${c.section}`)) }));
}

function rank(sheets, terms, limit, query) {
  const all = sheets.flatMap(({ s, chunks }) => chunks.map((c) => ({ ...c, s })));
  const df = new Map(terms.map((t) => [t, all.filter((c) => c.words.includes(t) || c.head.has(t)).length]));
  const idf = (t) => Math.log(1 + all.length / (1 + df.get(t)));

  for (const c of all) {
    const hits = terms.filter((t) => c.words.includes(t));
    const headHits = terms.filter((t) => c.head.has(t) && !hits.includes(t));
    const weight = hits.reduce((sum, t) => sum + idf(t), 0) + 0.5 * headHits.reduce((sum, t) => sum + idf(t), 0);
    const coverage = (hits.length + headHits.length) / terms.length;
    c.score = weight * (0.5 + coverage);
  }
  const hits = all.filter((c) => c.score > 0).sort((a, b) => b.score - a.score);

  // A sheet ranks by its best few items plus how well its title and summary match the query.
  const bySheet = new Map();
  for (const c of hits) (bySheet.get(c.s.slug) ?? bySheet.set(c.s.slug, []).get(c.s.slug)).push(c.score);
  const sheetRank = sheets
    .map(({ s }) => {
      const top = (bySheet.get(s.slug) ?? []).slice(0, 3).reduce((a, b) => a + b, 0);
      const about = new Set(tokens(`${s.topic} ${s.title} ${s.short}`));
      const aboutScore = terms.filter((t) => about.has(t)).reduce((sum, t) => sum + idf(t), 0);
      return { s, score: top + 2 * aboutScore };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!hits.length) return `# Search: "${query}"\n\nNo matches. Try other words, or use list_sheets to browse.`;
  const clip = (t) => (t.length > 320 ? `${t.slice(0, 317)}...` : t);
  return [
    `# Search: "${query}"`,
    "",
    `Most relevant sheets: ${sheetRank.slice(0, 5).map((r) => r.s.slug).join(", ")}. Read one with get_sheet before you advise; bracketed numbers are that sheet's sources.`,
    "",
    ...hits.slice(0, limit).map((c, i) => `${i + 1}. ${c.s.slug} › ${c.section}: ${clip(c.text)}`),
  ].join("\n");
}

// ---------------------------------------------------------------------------------------------
// Triage: the public facts about a CVE, plus the patching sheet's deadline tiers. Choosing the tier
// needs the reader's own context (is the system exposed, what depends on it), so this reports the
// facts and the rules and leaves the match to the advisor and the user.

function triageReport({ id, fixReleased, kev, epss, record, patching, today }) {
  const out = [`# ${id}: triage facts`, "", `Looked up ${today.toISOString().slice(0, 16).replace("T", " ")} UTC.`];

  out.push("", "## Known exploited?");
  if (kev.status === "rejected") out.push(`- CISA KEV: unavailable (${kev.reason.message}). Check https://www.cisa.gov/known-exploited-vulnerabilities-catalog`);
  else {
    const entry = kev.value.vulnerabilities?.find((v) => v.cveID === id);
    if (!entry) out.push(`- CISA KEV: not listed (catalog ${kev.value.catalogVersion}, ${kev.value.count} entries). Also check the vendor advisory and your national CERT: KEV isn't complete.`);
    else
      out.push(
        `- CISA KEV: **listed since ${entry.dateAdded}**: ${entry.vulnerabilityName}.`,
        `- Known ransomware use: ${entry.knownRansomwareCampaignUse}.`,
        `- CISA's due date for US federal agencies: ${entry.dueDate}. Required action: ${entry.requiredAction}`,
        ...(entry.notes ? [`- Advisories: ${entry.notes.trim().split(/\s*;\s*/).filter(Boolean).join("; ")}`] : []),
      );
  }

  out.push("", "## How likely is exploitation soon?");
  if (epss.status === "rejected") out.push(`- EPSS: unavailable (${epss.reason.message}).`);
  else {
    const e = epss.value.data?.[0];
    out.push(
      e
        ? `- EPSS: ${Number(Number(e.epss).toFixed(5))} probability of exploitation activity in the next 30 days; percentile ${(Number(e.percentile) * 100).toFixed(1)} (scored ${e.date}).`
        : "- EPSS: no score yet (new, reserved or rejected CVE).",
    );
  }

  out.push("", "## What is it?");
  if (record.status === "rejected") out.push(`- CVE record: unavailable (${record.reason.message}).`);
  else if (!record.value) out.push("- CVE record: not found. Check the ID; it may be reserved but not yet published.");
  else out.push(...describeRecord(record.value));

  out.push("", "## Deadlines from the patching sheet");
  if (patching.status === "rejected") out.push(`Unavailable: ${patching.reason.message}`);
  else out.push(...deadlines(patching.value, fixReleased, today));
  return out.join("\n");
}

function describeRecord(r) {
  const meta = r.cveMetadata ?? {};
  const cna = r.containers?.cna ?? {};
  const out = [];
  if (meta.state === "REJECTED") return ["- CVE record: **rejected** by its CNA. There is nothing to patch under this ID."];
  const desc = (cna.descriptions?.find((d) => d.lang?.startsWith("en"))?.value ?? "").replace(/\s+/g, " ").trim();
  out.push(`- ${cna.title ? `${cna.title}. ` : ""}${desc.length > 700 ? `${desc.slice(0, 697)}...` : desc}`);
  out.push(`- Published ${meta.datePublished?.slice(0, 10) ?? "?"} by ${meta.assignerShortName ?? "?"}; updated ${meta.dateUpdated?.slice(0, 10) ?? "?"}.`);

  const products = [...new Set((cna.affected ?? []).map((a) => [a.vendor, a.product].filter(Boolean).join(" ")))].filter(Boolean);
  if (products.length) out.push(`- Affected: ${products.slice(0, 6).join("; ")}${products.length > 6 ? "; ..." : ""}.`);

  const cvss = bestCvss(cna.metrics);
  const adp = (r.containers?.adp ?? []).flatMap((a) => (a.metrics ?? []).map((m) => ({ m, by: a.providerMetadata?.shortName })));
  const adpCvss = !cvss && bestCvss(adp.map((x) => x.m));
  if (cvss) out.push(`- Severity from the CNA: CVSS ${cvss}.`);
  else if (adpCvss) out.push(`- Severity (no CNA score; from an ADP such as CISA): CVSS ${adpCvss}.`);
  else out.push("- Severity: no CVSS score in the record. Take it from the vendor advisory.");

  const ssvc = adp.find((x) => x.m.other?.type === "ssvc")?.m.other.content;
  if (ssvc?.options) {
    const opts = ssvc.options.map((o) => Object.entries(o)[0].join(": ")).join(", ");
    out.push(`- CISA SSVC assessment (${ssvc.timestamp?.slice(0, 10) ?? "undated"}): ${opts}.`);
  }
  const refs = (cna.references ?? []).filter((x) => x.tags?.some((t) => ["vendor-advisory", "patch", "mitigation"].includes(t)));
  for (const ref of (refs.length ? refs : cna.references ?? []).slice(0, 3)) out.push(`- Reference: ${ref.url}`);
  return out;
}

function bestCvss(metrics = []) {
  for (const key of ["cvssV4_0", "cvssV3_1", "cvssV3_0", "cvssV2_0"]) {
    const m = metrics.find((x) => x[key])?.[key];
    if (m) return `${m.baseScore}${m.baseSeverity ? ` ${m.baseSeverity}` : ""} (${m.vectorString ?? key})`;
  }
  return null;
}

function deadlines({ meta, sheet, notice }, fixReleased, today) {
  const clock = sheet.blocks.find((b) => b.type === "clock");
  if (!clock) return [`The ${meta.slug} sheet has no deadline tiers any more. Read it with get_sheet.`];
  const { md, sources } = citations(sheet);
  const start = fixReleased ? new Date(/T/.test(fixReleased) ? fixReleased : `${fixReleased}T00:00:00Z`) : null;
  const due = (d) => {
    if (!d || !start) return d ? human(d) : "";
    const at = new Date(start.getTime() + hours(d) * 3_600_000);
    const when = d.endsWith("h") ? `${at.toISOString().slice(0, 16).replace("T", " ")} UTC` : at.toISOString().slice(0, 10);
    return `${human(d)}: by ${when}${at < today ? " (**passed**)" : ""}`;
  };

  const out = [
    notice,
    "",
    md(clock.intro ?? "Use the first tier that matches."),
    start ? `Counted from the fix or workaround release: ${fixReleased}.` : "Give fix_released to get dates instead of durations.",
    "",
    "| # | Tier | Applies when | Contain | Patch |",
    "| --- | --- | --- | --- | --- |",
    ...clock.tiers.map((t, i) => `| ${i + 1} | ${t.name} | ${md(t.qualifies)} | ${due(t.contain)} | ${due(t.fix)} |`),
  ];
  for (const note of [clock.before, clock.caption].filter(Boolean)) out.push("", md(note));
  const steps = sheet.blocks.find((b) => b.type === "steps");
  if (steps) out.push("", `### ${steps.title} (from the sheet)`, "", ...steps.items.map((s, i) => `${i + 1}. **${s.title}** ${md(s.text)}`));
  const cited = sources();
  if (cited.length) out.push("", "Sources:", ...cited);
  out.push(
    "",
    "Public data can't say whether the system is reachable from the internet or what depends on it. Ask the user, or check their inventory, before choosing a tier. For what to do when a deadline can't be met, read the full sheet with get_sheet.",
  );
  return out;
}

// Sheet text cites sources as [^id]. Numbers them like the sheet's Markdown export, and lists
// the sources actually cited.
function citations(sheet) {
  const ids = sheet.sources.map((s) => s.id);
  const used = new Set();
  const md = (t) =>
    String(t ?? "").replace(/\[\^([\w-]+)\]/g, (_, id) => {
      used.add(id);
      return `[${ids.indexOf(id) + 1}]`;
    });
  const sources = () =>
    [...used]
      .sort((a, b) => ids.indexOf(a) - ids.indexOf(b))
      .map((id) => {
        const s = sheet.sources[ids.indexOf(id)];
        return `[${ids.indexOf(id) + 1}] ${s.title}. ${s.publisher}${s.date ? `, ${s.date}` : ""}. ${s.url}`;
      });
  return { md, sources };
}

function renderBrief(sheet) {
  const { md, sources } = citations(sheet);
  const item = (i) => (typeof i === "string" ? md(i) : `**${i.title}** ${md(i.text)}`);
  const out = [`# ${sheet.title}`, "", md(sheet.answer)];
  for (const b of sheet.blocks.filter((b) => b.type === "ranked" || b.id === "by-size")) {
    out.push("", `## ${b.title}`, "");
    if (b.type === "ranked") out.push(...b.items.map((i, n) => `${n + 1}. ${item(i)}`));
    else out.push(...b.columns.flatMap((c) => [`### ${c.title}`, ...c.items.map((i) => `- ${md(i)}`), ""]));
  }
  const cited = sources();
  if (cited.length) out.push("", "Sources:", ...cited);
  return out.join("\n").trim();
}

const DURATION = /^(\d+)\s*(h|d)$/;
const hours = (d) => {
  const m = DURATION.exec(d);
  if (!m) throw new Error(`Unexpected duration "${d}" in the patching sheet.`);
  return Number(m[1]) * (m[2] === "d" ? 24 : 1);
};
const human = (d) => {
  const [, n, u] = DURATION.exec(d);
  return `${n} ${u === "h" ? "hour" : "day"}${n === "1" ? "" : "s"}`;
};

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
