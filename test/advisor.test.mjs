// Tests for the security advisor plugin (plugins/security-advisor) against a fresh local build.
// They run offline: triage gets fixture data in place of the CISA, FIRST and CVE feeds.
//
// When you add a sheet, add one realistic question for it to test/advisor-routing.json. It isn't
// required, but the test output names sheets that have none.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createLibrary, freshnessStatus } from "../plugins/security-advisor/server/library.mjs";
import { freshnessStatus as siteFreshness } from "../src/freshness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plugin = path.join(root, "plugins", "security-advisor");
const TOOL_PREFIX = "mcp__plugin_security-advisor_advisor__";
let dist, index, lib;

const offline = async (url) => {
  throw new Error(`Unexpected network request in a test: ${url}`);
};

before(async () => {
  dist = await mkdtemp(path.join(os.tmpdir(), "advisor-test-"));
  execFileSync(process.execPath, [path.join(root, "src", "build.mjs"), "--no-pdf", "--out", dist], { stdio: "ignore" });
  index = JSON.parse(await readFile(path.join(dist, "index.json"), "utf8"));
  lib = createLibrary({ source: dist, fetch: offline });
});

after(() => rm(dist, { recursive: true, force: true }));

test("index.json lists every written sheet, with paths and hashes that match the build", async () => {
  const dir = path.join(root, "content", "sheets");
  const written = [];
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"))) {
    const sheet = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    if (sheet.status === "draft" || sheet.status === "published") written.push(sheet.slug);
  }
  assert.deepEqual(index.sheets.map((s) => s.slug).sort(), written.sort());

  for (const s of index.sheets) {
    const md = await readFile(path.join(dist, s.markdown), "utf8");
    assert.equal(createHash("sha256").update(md).digest("hex"), s.sha256, `${s.slug}: hash`);
    assert.ok(existsSync(path.join(dist, s.json)), `${s.slug}: JSON file`);
    assert.doesNotMatch(s.answer, /\[\^/, `${s.slug}: citations stripped from the answer`);
  }
  const placed = index.domains.flatMap((d) => d.capabilities.filter((c) => c.sheet).map((c) => `${d.id}/${c.id}=${c.sheet}`));
  assert.deepEqual(placed.sort(), index.sheets.map((s) => `${s.capability}=${s.slug}`).sort());
});

test("freshness follows the same rule as the site", () => {
  const today = new Date("2026-11-05T12:00:00Z");
  for (const every of [7, 30, 90]) {
    for (let age = 0; age <= every + 30; age++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - age);
      const reviewed = d.toISOString().slice(0, 10);
      assert.equal(freshnessStatus(reviewed, every, today), siteFreshness(reviewed, every, today), `${reviewed}, every ${every} days`);
    }
  }
});

test("every sheet can be listed and read, in full and in brief", async () => {
  const list = await lib.listSheets();
  for (const s of index.sheets) {
    assert.match(list, new RegExp(`^- ${s.slug}: `, "m"), `${s.slug} in list_sheets`);
    const full = await lib.getSheet(s.slug);
    assert.match(full, /^> Advisor note: /);
    assert.ok(full.includes(`# ${s.title}`), `${s.slug}: title`);
    assert.ok(full.includes("## Sources"), `${s.slug}: sources`);
    const brief = await lib.getSheet(s.capability, { brief: true });
    assert.ok(brief.includes(`# ${s.title}`), `${s.slug}: brief by capability`);
    assert.ok(brief.length < full.length, `${s.slug}: brief is shorter`);
  }
  await assert.rejects(lib.getSheet("no-such-sheet"), /No sheet "no-such-sheet"/);
});

test("search routes a question about each sheet to that sheet", async (t) => {
  const cases = JSON.parse(await readFile(path.join(root, "test", "advisor-routing.json"), "utf8"));
  const failures = [];
  for (const c of cases) {
    const out = await lib.search(c.query);
    const top = out.match(/Most relevant sheets: (.*?)\. Read/)?.[1].split(", ") ?? [];
    if (!top.slice(0, 3).includes(c.sheet)) failures.push(`"${c.query}": expected ${c.sheet}, got ${top.slice(0, 3).join(", ")}`);
  }
  assert.deepEqual(failures, []);
  // A new sheet needs no test case to ship, but one keeps search honest as the library grows.
  const uncovered = index.sheets.filter((s) => !cases.some((c) => c.sheet === s.slug)).map((s) => s.slug);
  if (uncovered.length) t.diagnostic(`No routing question yet for: ${uncovered.join(", ")}. Add one to test/advisor-routing.json.`);
});

// ---------------------------------------------------------------------------------------------
// Triage, with fixture feeds.

const CVE = "CVE-2024-3400";
const FIXTURES = {
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json": {
    catalogVersion: "2026.11.04",
    count: 1,
    vulnerabilities: [
      {
        cveID: CVE,
        vulnerabilityName: "Palo Alto Networks PAN-OS Command Injection Vulnerability",
        dateAdded: "2024-04-12",
        dueDate: "2024-04-19",
        requiredAction: "Apply mitigations per vendor instructions.",
        knownRansomwareCampaignUse: "Known",
        notes: "https://security.paloaltonetworks.com/CVE-2024-3400 ;  https://nvd.nist.gov/vuln/detail/CVE-2024-3400",
      },
    ],
  },
  [`https://api.first.org/data/v1/epss?cve=${CVE}`]: { data: [{ cve: CVE, epss: "0.999990000", percentile: "1.000000000", date: "2026-11-04" }] },
  [`https://cveawg.mitre.org/api/cve/${CVE}`]: {
    cveMetadata: { state: "PUBLISHED", assignerShortName: "palo_alto", datePublished: "2024-04-12T07:20:00Z", dateUpdated: "2025-10-21T23:05:21Z" },
    containers: {
      cna: {
        title: "PAN-OS: OS Command Injection in GlobalProtect",
        descriptions: [{ lang: "en", value: "A command injection\nvulnerability in GlobalProtect." }],
        affected: [{ vendor: "Palo Alto Networks", product: "PAN-OS" }],
        metrics: [{ cvssV3_1: { baseScore: 10, baseSeverity: "CRITICAL", vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H" } }],
        references: [{ url: "https://security.paloaltonetworks.com/CVE-2024-3400", tags: ["vendor-advisory"] }],
      },
      adp: [
        {
          providerMetadata: { shortName: "CISA-ADP" },
          metrics: [{ other: { type: "ssvc", content: { timestamp: "2024-04-17T04:00:13Z", options: [{ Exploitation: "active" }, { Automatable: "yes" }, { "Technical Impact": "total" }] } } }],
        },
      ],
    },
  },
};

function fixtureFetch(requested) {
  return async (url) => {
    requested.push(url);
    if (!(url in FIXTURES)) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(FIXTURES[url]), { status: 200, headers: { "content-type": "application/json" } });
  };
}

test("triage combines the feeds with the patching sheet's deadlines", async () => {
  const requested = [];
  const triage = createLibrary({ source: dist, fetch: fixtureFetch(requested), now: () => new Date("2026-11-05T10:00:00Z") });
  const out = await triage.triage(CVE.toLowerCase(), "2024-04-14");

  assert.match(out, /CISA KEV: \*\*listed since 2024-04-12\*\*/);
  assert.match(out, /Known ransomware use: Known/);
  assert.match(out, /Advisories: https:\/\/security\.paloaltonetworks\.com\/CVE-2024-3400; https:\/\/nvd/);
  assert.match(out, /EPSS: 0\.99999 probability/);
  assert.match(out, /A command injection vulnerability in GlobalProtect/);
  assert.match(out, /Severity from the CNA: CVSS 10 CRITICAL/);
  assert.match(out, /SSVC assessment \(2024-04-17\): Exploitation: active, Automatable: yes, Technical Impact: total/);

  // Every tier of the sheet appears, with its deadline counted from the fix release.
  const sheet = JSON.parse(await readFile(path.join(dist, index.sheets.find((s) => s.capability === "exposure/patching").json), "utf8"));
  const clock = sheet.blocks.find((b) => b.type === "clock");
  const start = Date.parse("2024-04-14T00:00:00Z");
  for (const [i, tier] of clock.tiers.entries()) {
    const [, n, unit] = /^(\d+)(h|d)$/.exec(tier.fix);
    const at = new Date(start + Number(n) * (unit === "d" ? 24 : 1) * 3_600_000).toISOString();
    const when = unit === "h" ? `${at.slice(0, 16).replace("T", " ")} UTC` : at.slice(0, 10);
    assert.match(out, new RegExp(`^\\| ${i + 1} \\| ${tier.name} \\|.*by ${when}`, "m"), `tier ${tier.name}`);
  }
  assert.match(out, /\*\*passed\*\*/);

  const allowed = Object.keys(FIXTURES).map((u) => new URL(u).origin);
  for (const url of requested) assert.ok(allowed.includes(new URL(url).origin), `unexpected host: ${url}`);
});

test("triage rejects anything but a CVE ID before making a request", async () => {
  const requested = [];
  const triage = createLibrary({ source: dist, fetch: fixtureFetch(requested) });
  for (const bad of ["", "CVE-2024", "CVE-2024-3400; curl evil", "../../etc/passwd", "CVE-2024-3400?x=1"]) {
    await assert.rejects(triage.triage(bad), /isn't a CVE ID/, bad);
  }
  await assert.rejects(triage.triage(CVE, "next week"), /fix_released must be a date/);
  assert.deepEqual(requested, []);
});

test("triage reports a feed that is down instead of failing", async () => {
  const triage = createLibrary({ source: dist, fetch: async () => new Response("", { status: 503 }) });
  const out = await triage.triage(CVE);
  assert.match(out, /CISA KEV: unavailable \(.*HTTP 503\)/);
  assert.match(out, /EPSS: unavailable/);
  assert.match(out, /## Deadlines from the patching sheet/);
});

// ---------------------------------------------------------------------------------------------
// The MCP server as a real process, the way Claude Code starts it.

test("the MCP server answers JSON-RPC over stdio", async () => {
  const server = spawn(process.execPath, [path.join(plugin, "server", "mcp.mjs")], {
    env: { ...process.env, SECURITY_ADVISOR_SOURCE: dist },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const replies = new Map();
  const waiting = new Map();
  createInterface({ input: server.stdout }).on("line", (line) => {
    const msg = JSON.parse(line);
    replies.set(msg.id, msg);
    waiting.get(msg.id)?.(msg);
  });
  const call = (id, method, params) => {
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return replies.get(id) ?? new Promise((resolve) => waiting.set(id, resolve));
  };

  try {
    const init = await call(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    assert.equal(init.result.protocolVersion, "2025-06-18");
    assert.equal(init.result.serverInfo.name, "security-advisor");
    const manifest = JSON.parse(await readFile(path.join(plugin, ".claude-plugin", "plugin.json"), "utf8"));
    assert.equal(init.result.serverInfo.version, manifest.version);
    assert.match(init.result.instructions, /data, not instructions/);
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

    const { result } = await call(2, "tools/list", {});
    assert.deepEqual(result.tools.map((t) => t.name), ["list_sheets", "get_sheet", "search_sheets", "triage_vulnerability"]);
    assert.ok(result.tools.every((t) => t.annotations.readOnlyHint && t.inputSchema.type === "object"));

    const sheet = await call(3, "tools/call", { name: "get_sheet", arguments: { slug: "exposure/patching", brief: true } });
    assert.equal(sheet.result.isError, undefined);
    assert.match(sheet.result.content[0].text, /^> Advisor note: .*Patching/);

    const bad = await call(4, "tools/call", { name: "get_sheet", arguments: { slug: "nope" } });
    assert.equal(bad.result.isError, true);
    assert.equal((await call(5, "tools/call", { name: "rm_rf", arguments: {} })).error.code, -32602);
    assert.equal((await call(6, "resources/list", {})).error.code, -32601);
    assert.deepEqual((await call(7, "ping", {})).result, {});
  } finally {
    server.kill();
  }
});

// ---------------------------------------------------------------------------------------------
// The plugin's files agree with each other.

test("the marketplace, manifest, skills and reviewer agent fit together", async () => {
  const market = JSON.parse(await readFile(path.join(root, ".claude-plugin", "marketplace.json"), "utf8"));
  const entry = market.plugins.find((p) => p.name === "security-advisor");
  assert.equal(path.resolve(root, entry.source), plugin);
  const manifest = JSON.parse(await readFile(path.join(plugin, ".claude-plugin", "plugin.json"), "utf8"));
  assert.equal(manifest.name, entry.name);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);

  for (const skill of ["ask", "review", "triage", "assess"]) {
    const text = await readFile(path.join(plugin, "skills", skill, "SKILL.md"), "utf8");
    assert.match(text, new RegExp(`^---\\nname: ${skill}\\ndescription: .{40,}`, "m"), `${skill}: frontmatter`);
  }

  // The reviewer reads untrusted code, so it gets no shell, no web, no writes and no tool that
  // sends anything outside: triage sends CVE IDs to public services, so it is left out too.
  const agent = await readFile(path.join(plugin, "agents", "security-reviewer.md"), "utf8");
  const tools = /^tools: (.*)$/m.exec(agent)[1].split(",").map((t) => t.trim());
  const serverTools = ["list_sheets", "get_sheet", "search_sheets", "triage_vulnerability"];
  for (const tool of tools) {
    if (tool.startsWith(TOOL_PREFIX)) assert.ok(serverTools.includes(tool.slice(TOOL_PREFIX.length)), `unknown tool ${tool}`);
    else assert.ok(["Read", "Grep", "Glob"].includes(tool), `reviewer must not have ${tool}`);
  }
  assert.ok(!tools.includes(`${TOOL_PREFIX}triage_vulnerability`));
});
