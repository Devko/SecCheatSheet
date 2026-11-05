// Grades a results folder from run.mjs and writes report.md and report.json into it.
//
//   node evals/advisor/judge.mjs <results dir> [--concurrency 6]
//
// For each case and run number, one judge call sees every condition's answer, labelled A, B, C in an
// order shuffled per case and run. It scores each rubric check, lists factual errors (and false
// positives for code reviews) and ranks the answers. Judgments are saved, so a rerun only grades
// what's missing. The judge is Claude without tools, given the case's reference facts as ground truth.

import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? "");
const concurrency = Number(process.argv[process.argv.indexOf("--concurrency") + 1]) || 6;
if (!existsSync(path.join(out, "conditions.json"))) {
  console.error("Usage: judge.mjs <results dir from run.mjs>");
  process.exit(2);
}
const setup = JSON.parse(readFileSync(path.join(out, "conditions.json"), "utf8"));
const names = setup.conditions.map((c) => c.name);
const cases = JSON.parse(readFileSync(path.join(here, "cases.json"), "utf8")).filter((c) => setup.cases.includes(c.id));
mkdirSync(path.join(out, "judgments"), { recursive: true });

// --- What each run did -------------------------------------------------------------------------

function extract(file) {
  if (!existsSync(file)) return null;
  const events = readFileSync(file, "utf8").split("\n").flatMap((l) => {
    try { return [JSON.parse(l)]; } catch { return []; }
  });
  const calls = events.filter((e) => e.type === "assistant").flatMap((e) => e.message.content.filter((c) => c.type === "tool_use"));
  const result = events.find((e) => e.type === "result");
  if (!result?.result) return null;
  const meta = events.find((e) => e.type === "meta") ?? {};
  return {
    answer: result.result,
    cost: result.total_cost_usd ?? 0,
    seconds: (meta.wallMs ?? result.duration_ms ?? 0) / 1000,
    words: result.result.split(/\s+/).length,
    advisorUsed: calls.some((c) => c.name.startsWith("mcp__plugin_security-advisor") || /security-advisor/.test(JSON.stringify(c.input))),
    webCalls: calls.filter((c) => /^Web(Search|Fetch)$/.test(c.name)).length,
  };
}

// --- Judging -----------------------------------------------------------------------------------

const LABELS = "ABCDEFGH";

function prompt(c, answers) {
  const diff = c.repo ? execFileSync("git", ["diff", "main"], { cwd: path.join(out, "repos", c.repo), encoding: "utf8" }) : "";
  return `You are grading ${answers.length} answers to the same request a user made to an AI coding assistant. Today is 2026-11-05.

Use the reference facts as ground truth. They were checked against primary sources and may be newer than your training data, so trust them over your memory. Don't count a claim as an error just because you can't confirm it; count it only if it contradicts the reference facts or is clearly false.

## Request
${c.prompt}
${diff ? `\n## The change under review (git diff main)\n\`\`\`diff\n${diff}\n\`\`\`\n` : ""}
## Reference facts
${c.facts.map((f) => `- ${f}`).join("\n")}

## Checks
${c.checks.map((k, i) => `${i + 1}. ${k}`).join("\n")}

${answers.map((a, i) => `## Answer ${LABELS[i]}\n${a}`).join("\n\n")}

## Your task
For each answer, score every check: 1 = fully met, 0.5 = partly, 0 = not met. List its factual errors, including outdated facts presented as current.${c.repo ? " List its false positives: claimed vulnerabilities that aren't real in the diff." : ""} Then rank the answers from the one you'd most like to receive as the user to the least: correctness first, then how actionable it is, then concision. Don't reward an answer for citing a particular source or library, only for being correct, current, actionable and verifiable.

Don't use any tools. Reply with only this JSON, with one entry per answer:
{"answers":{${answers.map((_, i) => `"${LABELS[i]}":{"checks":[${c.checks.map(() => "0").join(",")}],"errors":[]${c.repo ? ',"false_positives":[]' : ""}}`).join(",")}},"ranking":[${answers.map((_, i) => `"${LABELS[i]}"`).join(",")}],"reason":"one or two sentences"}`;
}

function callJudge(text) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--output-format", "json", "--max-turns", "2", "--tools", ""], { stdio: ["pipe", "pipe", "ignore"] });
    let raw = "";
    child.stdout.on("data", (d) => (raw += d));
    child.on("close", () => {
      try {
        const r = JSON.parse(raw);
        const verdict = JSON.parse(r.result.slice(r.result.indexOf("{"), r.result.lastIndexOf("}") + 1));
        resolve({ ...verdict, judgeCost: r.total_cost_usd });
      } catch {
        reject(new Error(`Unreadable judge output: ${raw.slice(0, 300)}`));
      }
    });
    child.stdin.end(text);
  });
}

async function judge(c, n) {
  const file = path.join(out, "judgments", `${c.id}--${n}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const runs = names.map((name) => ({ name, run: extract(path.join(out, "runs", `${c.id}--${name}--${n}.jsonl`)) })).filter((x) => x.run);
  if (runs.length < 2) return null;
  // Shuffle by a hash of case and run, so the order is random but stable across reruns.
  const order = runs
    .map((x) => ({ ...x, key: createHash("sha256").update(`${c.id}:${n}:${x.name}`).digest("hex") }))
    .sort((a, b) => a.key.localeCompare(b.key));
  let verdict;
  for (let attempt = 0; attempt < 3 && !verdict; attempt++) {
    verdict = await callJudge(prompt(c, order.map((x) => x.run.answer))).catch((e) => (attempt === 2 ? { error: e.message } : null));
  }
  const byName = {};
  order.forEach((x, i) => {
    const v = verdict.answers?.[LABELS[i]] ?? {};
    byName[x.name] = {
      ...x.run,
      answer: undefined,
      checks: (v.checks ?? []).map(Number),
      errors: v.errors ?? [],
      falsePositives: c.repo ? v.false_positives ?? [] : [],
      rank: (verdict.ranking ?? []).indexOf(LABELS[i]) + 1 || null,
    };
  });
  const judgment = { case: c.id, kind: c.kind, run: n, results: byName, reason: verdict.reason, error: verdict.error, judgeCost: verdict.judgeCost ?? 0 };
  if (!verdict.error) writeFileSync(file, JSON.stringify(judgment, null, 2));
  return judgment;
}

const jobs = cases.flatMap((c) => Array.from({ length: setup.runs }, (_, i) => () => judge(c, i + 1)));
const judgments = [];
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (jobs.length) {
    const j = await jobs.shift()();
    if (j) judgments.push(j);
  }
}));

// --- Report ------------------------------------------------------------------------------------

const graded = judgments.filter((j) => !j.error);
const of = (name, filter = () => true) => graded.filter(filter).map((j) => ({ j, r: j.results[name] })).filter((x) => x.r);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x) => (Number.isNaN(x) ? "–" : `${Math.round(100 * x)}%`);
const checksShare = (rows) => {
  const max = rows.reduce((s, { j }) => s + cases.find((c) => c.id === j.case).checks.length, 0);
  return max ? rows.reduce((s, { r }) => s + r.checks.reduce((a, b) => a + b, 0), 0) / max : NaN;
};
const kinds = [...new Set(cases.map((c) => c.kind))];

const summary = names.map((name) => {
  const rows = of(name);
  return {
    name,
    answers: rows.length,
    checks: checksShare(rows),
    byKind: Object.fromEntries(kinds.map((k) => [k, checksShare(of(name, (j) => j.kind === k))])),
    errors: rows.reduce((s, { r }) => s + r.errors.length, 0),
    falsePositives: rows.reduce((s, { r }) => s + r.falsePositives.length, 0),
    meanRank: mean(rows.map(({ r }) => r.rank).filter(Boolean)),
    firsts: rows.filter(({ r }) => r.rank === 1).length,
    cost: Object.fromEntries(kinds.map((k) => [k, mean(of(name, (j) => j.kind === k).map(({ r }) => r.cost))])),
    seconds: Object.fromEntries(kinds.map((k) => [k, mean(of(name, (j) => j.kind === k).map(({ r }) => r.seconds))])),
    words: mean(rows.map(({ r }) => r.words)),
    advisorUsed: rows.filter(({ r }) => r.advisorUsed).length,
    webCalls: rows.reduce((s, { r }) => s + r.webCalls, 0),
  };
});

const pairs = names.flatMap((a, i) => names.slice(i + 1).map((b) => {
  const both = graded.filter((j) => j.results[a]?.rank && j.results[b]?.rank);
  const aWins = both.filter((j) => j.results[a].rank < j.results[b].rank).length;
  return `${a} vs ${b}: ${aWins}–${both.length - aWins}`;
}));

const perCase = cases.map((c) => {
  const cells = names.map((name) => {
    const rows = of(name, (j) => j.case === c.id);
    return `${pct(checksShare(rows))}, rank ${mean(rows.map(({ r }) => r.rank).filter(Boolean)).toFixed(1)}`;
  });
  return `| ${c.id} | ${cells.join(" | ")} |`;
});

const money = (x) => (Number.isNaN(x) ? "–" : `$${x.toFixed(2)}`);
const md = [
  `# Security advisor eval`,
  "",
  `${setup.runs} runs per case and condition, ${cases.length} cases, ${graded.length} judged comparisons${judgments.length > graded.length ? ` (${judgments.length - graded.length} failed to grade)` : ""}. Conditions: ${setup.conditions.map((c) => `${c.name} (${c.plugin ? `plugin at ${path.relative(process.cwd(), c.plugin).startsWith("..") ? c.plugin : path.relative(process.cwd(), c.plugin)}` : "no plugin"})`).join(", ")}.`,
  "",
  `| | ${names.join(" | ")} |`,
  `| --- | ${names.map(() => "---").join(" | ")} |`,
  `| Checks met | ${summary.map((s) => pct(s.checks)).join(" | ")} |`,
  ...kinds.map((k) => `| Checks met, ${k} | ${summary.map((s) => pct(s.byKind[k])).join(" | ")} |`),
  `| Factual errors | ${summary.map((s) => s.errors).join(" | ")} |`,
  `| False positives (reviews) | ${summary.map((s) => s.falsePositives).join(" | ")} |`,
  `| Mean rank (1 = best) | ${summary.map((s) => s.meanRank.toFixed(2)).join(" | ")} |`,
  `| Ranked first | ${summary.map((s) => `${s.firsts} of ${s.answers}`).join(" | ")} |`,
  ...kinds.map((k) => `| Mean cost, ${k} | ${summary.map((s) => money(s.cost[k])).join(" | ")} |`),
  ...kinds.map((k) => `| Mean time, ${k} | ${summary.map((s) => `${Math.round(s.seconds[k])}s`).join(" | ")} |`),
  `| Mean words | ${summary.map((s) => Math.round(s.words)).join(" | ")} |`,
  `| Advisor used | ${summary.map((s) => `${s.advisorUsed} of ${s.answers}`).join(" | ")} |`,
  `| Web calls | ${summary.map((s) => s.webCalls).join(" | ")} |`,
  "",
  `Head to head (wins–losses by rank): ${pairs.join("; ")}.`,
  `Judge cost: ${money(graded.reduce((s, j) => s + j.judgeCost, 0))}.`,
  "",
  "## By case (checks met, mean rank)",
  "",
  `| Case | ${names.join(" | ")} |`,
  `| --- | ${names.map(() => "---").join(" | ")} |`,
  ...perCase,
  "",
  "## Judge notes",
  "",
  ...graded
    .sort((a, b) => a.case.localeCompare(b.case) || a.run - b.run)
    .flatMap((j) => [
      `### ${j.case}, run ${j.run}: ${Object.entries(j.results).sort((a, b) => a[1].rank - b[1].rank).map(([n]) => n).join(" > ")}`,
      j.reason ?? "",
      ...Object.entries(j.results).flatMap(([n, r]) => [
        ...(r.errors.length ? [`- ${n} errors: ${r.errors.join(" | ")}`] : []),
        ...(r.falsePositives.length ? [`- ${n} false positives: ${r.falsePositives.join(" | ")}`] : []),
      ]),
      "",
    ]),
].join("\n");

writeFileSync(path.join(out, "report.json"), JSON.stringify({ setup, summary, pairs, judgments }, null, 2));
writeFileSync(path.join(out, "report.md"), md);
console.log(md.split("## Judge notes")[0]);
