// Runs every case in cases.json under each condition, several times, in headless Claude Code.
//
//   node evals/advisor/run.mjs --condition base --condition plugin=plugins/security-advisor \
//     [--runs 3] [--concurrency 6] [--cases Q1-patch-vpn,R1-python-api] [--out <dir>]
//
// A condition is "base" (no plugin) or "<name>=<plugin directory>". Every condition gets the same
// tools; plugin conditions also get the advisor's MCP tools. Prompts are plain requests with no slash
// commands, so the test also shows whether the plugin is used without being asked for.
// Finished runs are skipped, so an interrupted run can be resumed with the same --out.
// Then grade with: node evals/advisor/judge.mjs <out>

import { spawn, execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const all = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const one = (name, fallback) => all(name)[0] ?? fallback;

const conditions = all("--condition").map((c) => {
  const [name, dir] = c.split("=");
  return { name, plugin: dir ? path.resolve(dir) : null };
});
if (!conditions.length) {
  console.error("Give at least one --condition, e.g. --condition base --condition plugin=plugins/security-advisor");
  process.exit(2);
}
const runs = Number(one("--runs", 3));
const concurrency = Number(one("--concurrency", 6));
const only = one("--cases", "").split(",").filter(Boolean);
const out = path.resolve(one("--out", path.join(here, "results", new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"))));
const cases = JSON.parse(readFileSync(path.join(here, "cases.json"), "utf8")).filter((c) => !only.length || only.includes(c.id));

const MCP = ["list_sheets", "get_sheet", "search_sheets", "triage_vulnerability"].map((t) => `mcp__plugin_security-advisor_advisor__${t}`);
const TOOLS = ["WebSearch", "WebFetch", "Read", "Grep", "Glob", "Bash(git:*)", "Agent", "Skill"];

// The review cases need git repositories with a feature branch. fixtures.json holds their files, so
// the deliberately vulnerable code isn't picked up by dependency or code scanning in this repository.
function buildRepos() {
  const fixtures = JSON.parse(readFileSync(path.join(here, "fixtures.json"), "utf8"));
  for (const [name, repo] of Object.entries(fixtures)) {
    const dir = path.join(out, "repos", name);
    if (existsSync(dir)) continue;
    const git = (...a) => execFileSync("git", ["-c", "user.name=eval", "-c", "user.email=eval@example.com", ...a], { cwd: dir, stdio: "ignore" });
    const write = (files) => {
      for (const [file, text] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        writeFileSync(path.join(dir, file), text);
      }
    };
    mkdirSync(dir, { recursive: true });
    git("init", "-q", "-b", "main");
    write(repo.main.files);
    git("add", "-A");
    git("commit", "-qm", repo.main.message);
    git("checkout", "-qb", repo.branch.name);
    for (const file of Object.keys(repo.main.files)) if (!(file in repo.branch.files)) rmSync(path.join(dir, file));
    write(repo.branch.files);
    git("add", "-A");
    git("commit", "-qm", repo.branch.message);
  }
}

async function runOne({ c, cond, n }) {
  const id = `${c.id}--${cond.name}--${n}`;
  const file = path.join(out, "runs", `${id}.jsonl`);
  if (existsSync(file) && readFileSync(file, "utf8").includes('"type":"result"')) return;
  const cwd = path.join(out, "work", id);
  rmSync(cwd, { recursive: true, force: true });
  if (c.repo) cpSync(path.join(out, "repos", c.repo), cwd, { recursive: true });
  else mkdirSync(cwd, { recursive: true });

  const flags = ["-p", c.prompt, "--output-format", "stream-json", "--verbose", "--max-turns", "30",
    "--allowedTools", ...TOOLS, ...(cond.plugin ? MCP : [])];
  if (cond.plugin) flags.push("--plugin-dir", cond.plugin);
  const started = Date.now();
  await new Promise((resolve) => {
    const child = spawn("claude", flags, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += `\n${JSON.stringify({ stderr: String(d) })}\n`));
    const timer = setTimeout(() => child.kill("SIGTERM"), 15 * 60_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      writeFileSync(file, `${log}\n${JSON.stringify({ type: "meta", exit: code, wallMs: Date.now() - started })}\n`);
      console.log(`${new Date().toISOString().slice(11, 19)} ${id} (exit ${code}, ${Math.round((Date.now() - started) / 1000)}s)`);
      resolve();
    });
  });
}

mkdirSync(path.join(out, "runs"), { recursive: true });
writeFileSync(path.join(out, "conditions.json"), JSON.stringify({ conditions, runs, cases: cases.map((c) => c.id) }, null, 2));
buildRepos();
const queue = cases.flatMap((c) => conditions.flatMap((cond) => Array.from({ length: runs }, (_, i) => ({ c, cond, n: i + 1 }))));
console.log(`${queue.length} runs into ${out}`);
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (queue.length) await runOne(queue.shift());
}));
console.log(`Done. Grade with: node evals/advisor/judge.mjs ${out}`);
