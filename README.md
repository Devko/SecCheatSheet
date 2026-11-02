# Security Cheat Sheets

Short, opinionated security guidance: what to do first, by when, and when we last checked.
Each sheet is one JSON file, built into a web page, a print-ready A4 PDF, a Markdown file and
a copy-paste checklist.

## Build

Requires Node 20+ and, for PDFs, Chrome or Edge (found automatically, or set `CHROME_PATH`).
There are no npm dependencies.

```bash
npm run build      # dist/ with HTML, Markdown, JSON and PDF for every sheet
npm run dev        # HTML only, then serve dist/ at http://localhost:4321
```

Output:

```
dist/
  index.html                  library index
  assets/                     CSS, JS, freshness.mjs
  patching/
    index.html                the sheet
    patching.pdf              A4, printed from the same page with the print stylesheet
    patching.md               full Markdown export
    patching.json             the source data
```

## Writing a sheet

Copy `content/sheets/_template.json`, rename it to the sheet's slug, and set `status`:
`planned` (index only), `draft` (built, with a draft notice) or `published`.

Editorial rules, which are the point of the library:

- **`answer` is the cheat sheet in two sentences.** The first says what to do and by when.
- **At most five ranked actions.** If everything is a priority, nothing is.
- **Always include "What you can skip".** It's the part nobody else publishes.
- **Every number has a source** (`[^source-id]` in any text field) or is labelled as our recommendation.
- **Every sheet is reviewed every 30 days** (`reviewEveryDays`). The review agent does the research
  and opens a pull request; a person approves it.
- **Every review bumps `version`, updates `lastReviewed` and adds a line to `changes`,** even when
  nothing else changed. "Reviewed, still accurate" is useful to readers.

Text fields support `**bold**`, `` `code` ``, `[label](https://...)` and `[^source-id]` citations.
The build fails on unknown citations and missing fields.

### Block types

| Type        | Use it for                                    | Layout                    |
| ----------- | --------------------------------------------- | ------------------------- |
| `ranked`    | The top actions, in priority order           | Boxed, large numerals     |
| `steps`     | A sequence followed in order (triage, setup) | Numbered, connected       |
| `list`      | Unordered points (skip, mistakes, metrics)   | Bullets                   |
| `columns`   | The same advice at different org sizes       | Three columns             |
| `timelines` | Fixed legal or contractual clocks            | Steps on a line           |
| `clock`     | Deadlines by risk on a log time axis         | The full-width chart      |

Blocks are half width by default; set `"span": "full"` for full width.

## Monthly review

The review workflow lives in [`.claude/skills/review-sheets/SKILL.md`](.claude/skills/review-sheets/SKILL.md).
In Claude Code, run `/review-sheets` in this repo to review every sheet that is due; a scheduled agent
can run the same skill every month. It re-checks every source, researches what changed since the
last review, edits the sheets, rebuilds, and opens a pull request. It never merges and never
publishes a draft.

## Before launch

- Self-host the font. The prototype loads Atkinson Hyperlegible Next from Google Fonts, which sends
  visitor IP addresses to Google (ruled a GDPR violation by LG München, 2022).
- Set `baseUrl` in `site.config.json`. It is printed on every PDF page.
