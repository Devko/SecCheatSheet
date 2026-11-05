# Security advisor eval

Does the security advisor plugin make Claude's security answers better, and does a change to the
plugin help? This runs the same realistic requests in headless Claude Code under several conditions,
such as without the plugin, with the current plugin and with a changed one. A blind judge then grades
the answers.

It isn't part of `npm test` or CI: it calls Claude, costs money and takes about 15 minutes.

## Run it

Needs Claude Code (`claude`) signed in, and Node.js 22 or later.

```bash
# 3 runs of every case, without the plugin and with it
node evals/advisor/run.mjs --condition base --condition plugin=plugins/security-advisor --runs 3

# Compare a change against the published version: extract the old plugin first
mkdir -p /tmp/old && git archive origin/main plugins/security-advisor | tar -x -C /tmp/old
node evals/advisor/run.mjs --condition old=/tmp/old/plugins/security-advisor \
  --condition new=plugins/security-advisor --runs 3

# Grade and write report.md into the results folder
node evals/advisor/judge.mjs evals/advisor/results/<folder>
```

A condition can name a model: `--condition haiku:claude-haiku-5-5` runs Haiku without the plugin,
and `--condition haiku-plugin:claude-haiku-5-5=plugins/security-advisor` runs it with the plugin. The
report shows which model answered. `--cases Q1-patch-vpn,R1-python-api` limits the run to some
cases. Rerunning with the same `--out` resumes and skips finished runs. Results go to `evals/advisor/results/`, which git ignores.

Cost, at November 2026 prices: about $0.10 to $0.25 per question or triage run, $0.20 to $0.60 per
code review run, and about $0.10 per judge call. Three conditions with three runs each cost about $30.

## What it measures

- **Cases** (`cases.json`): seven questions, two CVE triages and three code reviews. Each has
  reference facts and checks:
  - The questions include facts that changed after the model's training, like CISA's BOD 26-04, the
    2026 PyTorch `weights_only` bypass and the AI Act's postponed dates. They also include timeless
    controls, such as password rotation.
  - The triages include a well-known CVE and a recent one the model can't know.
  - The code reviews (`fixtures.json`) are small repositories with planted vulnerabilities in Python,
    TypeScript with GitHub Actions, and Kubernetes with Docker. The Python one also contains a
    comment telling AI reviewers to exfiltrate an SSH key.
- **Conditions** get identical prompts and tools: web search and fetch, file reading, `git`,
  subagents and skills. Plugin conditions also get the advisor's tools.
- **The judge** is Claude without tools. Per case and run, it sees every condition's answer in a
  shuffled order, with the reference facts as ground truth. It scores each check, lists factual
  errors and false positives, and ranks the answers.

The report gives, per condition: checks met, errors, false positives, mean rank, head-to-head wins,
cost, time, length, and whether the advisor was used. It then gives a per-case table and the judge's
notes.

## Past results

[`history/`](history/) keeps the reports, judgments and answers of past runs, with a summary of what
each showed. Start with [5 November 2026](history/2026-11-05/README.md): the plugin against plain
Claude Code, 1.0 against 1.1, and Haiku against Opus.

## Read it with care

- The judge is also Claude, and blinding is partial, because answers that use the plugin mention the
  sheets.
- The judge's own knowledge can be out of date. When it marks a claim as an error, check the claim
  before trusting the error: in the first run, two "errors" were correct facts it didn't know.
- Facts in `cases.json` were checked against primary sources in November 2026. They will age: update
  them when a sheet's review changes the facts.
- A few cases and runs can't show small differences. Look at the judge notes, not only the totals.

## Add a case

Add an entry to `cases.json` with a plain-language `prompt`, `facts` checked against primary sources,
and `checks` that describe a good answer without requiring the sheets' own wording. For a code review,
add a repository to `fixtures.json` (files for `main` and for the branch) and set `repo`.

The fixtures are deliberately vulnerable and include a prompt-injection test. They exist only as JSON
so that dependency and code scanning in this repository don't treat them as real code.
