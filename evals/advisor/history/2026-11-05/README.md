# Security advisor evals, 5 November 2026

Three rounds of the [advisor eval](../../README.md), run while the plugin was built. Each folder has:
- `report.md`: the judge's scores and notes;
- `report.json`: every judgment;
- `answers.json`: every final answer, with model, cost, time and the tools used.

The raw run logs (about 22 MB) were not kept.

All runs used Claude Code 2.1.318 in headless mode, with the same tools in every condition and plain
prompts with no slash commands. The judge was Claude Opus 5.5 without tools, given reference facts
checked against primary sources.

## Plugin versions in these runs

| Label in the reports | Plugin |
| --- | --- |
| `base`, `opus`, `haiku` | No plugin |
| `plugin` (round 1), `v1` (round 2) | 1.0.0, the first release |
| `v2` (round 2), `opus-plugin` and `haiku-plugin` (round 3, questions and triage) | 1.1.0 before the "full strength" rule (commit 3dafcd2) |
| `v2b` (round 2 follow-up) | 1.1.0 as released |
| `haiku-plugin` (round 3, code reviews) | 1.1.1: wait for the reviewer in the foreground |

## Round 1: does the plugin help at all? (`1-first-ab`, Opus, 1 run per case)

Plugin 1.0.0 against no plugin. Rubric checks met: 97% with the plugin, 92% without. The judge
preferred the plain answers 7 to 5. The plugin won on facts newer than the model and on prompt
injection. It lost on answers that described the cheat sheets instead of the user's situation, on CVE
triage without vendor specifics, and on review cost (3.5 times as much). That led to 1.1.0.

## Round 2: did 1.1.0 fix it? (`2-v1.0-vs-v1.1`, Opus, 3 runs per case)

| | No plugin | 1.0.0 | 1.1.0 |
| --- | --- | --- | --- |
| Rubric checks met | 91% | 94% | 98% |
| Factual errors | 21 | 8 | 7 (5 after checking the judge) |
| Ranked best | 8 of 36 | 4 of 36 | 24 of 36 |
| Cost per question / review | $0.12 / $0.16 | $0.21 / $0.52 | $0.21 / $0.40 |

- 1.1.0 won head to head 28–8 against no plugin and 30–6 against 1.0.0.
- Without the plugin, Claude gave outdated security advice: it treated PyTorch 2.6 or later as safe
  with `weights_only=True` (that was fixed only in 2.10.0), and quoted CISA deadlines from the replaced
  BOD 22-01.
- In the Python review, both plugin versions flagged the planted prompt injection in 3 of 3 runs.
  Plain Claude Code missed it in all 3.
- The follow-up (`followup-v1.1b`) added the rule to keep the sheets' advice at full strength. After
  it, the AI-agents answer recommended separate agent identities in 3 of 3 runs, up from 0 of 3.

## Round 3: does the library bring Haiku to Opus level? (`3-haiku-vs-opus`, 3 runs per case)

| | Haiku | Haiku + library | Opus | Opus + library |
| --- | --- | --- | --- | --- |
| Questions: checks met | 80% | 94% | 90% | 96% |
| CVE triage: checks met | 73% | 90% | 97% | 100% |
| Code reviews: checks met | 100% | 78% | 93% | 100% |
| Factual errors | 50 | 18 | 19 | 5 |
| Cost per question | $0.01 | $0.01 | $0.12 | $0.21 |

Head to head: Haiku with the library beat plain Haiku 24–11, came close to plain Opus (15–20), and
lost to Opus with the library 8–27.

- **Questions:** Haiku with the library performs at plain-Opus level, at about a twelfth of the cost.
- **CVE triage:** most of the gap closes, but vendor-specific steps are weaker than Opus's.
- **Code reviews:** worse with the library, because Haiku doesn't follow the review procedure. It
  started the read-only reviewer in the background and ended its turn, so in a headless run the
  report was lost. In 5 of 9 runs it skipped the reviewer and read the diff itself, which also loses
  the protection against prompt injection. Plugin 1.1.1 tells it to wait, which lifted review checks
  from 59% (`report-before-review-fix.md`) to 78%. Plain Haiku found every planted bug, so this is a
  procedure problem, not a capability problem.

## The judge's knowledge goes out of date

Several "errors" the judge counted were correct facts newer than its training. Check a claimed error
before trusting it. These were confirmed at the primary source:

- npm 12 turned dependency install scripts off by default (GitHub Changelog, 8 July 2026).
- GitHub blocks `pull_request_target` by default from 2 December 2026 (GitHub Changelog, 2 November 2026).
- The Digital Omnibus softened the AI Act's AI literacy duty from July 2026 (Regulation (EU) 2026/1744).

The same answers graded twice can also differ: plain Opus scored 14 and then 19 errors.

## Open next step: make reviews independent of the model

The review currently depends on the model following steps: save the diff without reading it, hand it
to the `security-reviewer` agent, wait, then show the report. Opus does this; Haiku often doesn't.
A sturdier design runs the review skill inside the read-only agent (`context: fork` with
`agent: security-advisor:security-reviewer`), with the diff inserted by Claude Code before the model
sees anything (`` !`git diff …` `` in the skill). Then no model has to orchestrate the review, and the
main session never reads untrusted code. Two things need testing first:
- whether a skill's `agent:` field accepts a plugin's agent;
- how to pass a base branch or PR number into the inserted command.

To check it: rerun the code-review cases (`--cases R1-python-api,R2-node-actions,R3-k8s-docker`) for
Haiku and Opus, and compare with round 3.
