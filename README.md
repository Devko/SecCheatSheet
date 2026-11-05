# Security Cheat Sheets

Short, opinionated security guidance: what to do first, by when, and when we last checked.
Each sheet is one JSON file, built into a web page, a print-ready A4 PDF, a Markdown file and
a copy-paste checklist.

## Build

Requires Node 20+ and, for PDFs, Chrome or Edge (found automatically, or set `CHROME_PATH`).
There are no npm dependencies.

```bash
npm run build      # dist/ with HTML, Markdown, JSON and PDF for every sheet
npm run check      # same, but fails if PDFs can't be built or a sheet runs past 2 pages
npm run dev        # HTML only, then serve dist/ at http://localhost:4321
npm test           # security advisor plugin, against a fresh build
```

To check one sheet without touching `dist/` (useful when several people or agents work at once):

```bash
node src/build.mjs --only patching --out .build/patching --strict
```

Output:

```
dist/
  index.html                  overview: capability map and all sheets
  index.json                  the same, machine-readable, for the security advisor plugin
  assets/                     CSS, JS, freshness.mjs, self-hosted font
  patching/
    index.html                the sheet
    patching.pdf              A4, printed from the same page with the print stylesheet
    patching.md               full Markdown export
    patching.json             the source data
```

## Writing a sheet

Copy `content/sheets/_template.json`, rename it to the sheet's slug, and set `status`:
`planned` (index only), `draft` (built, with a draft notice) or `published`.

Set `capability` to a `domain/capability` pair from [`content/map.json`](content/map.json), such as
`exposure/patching`. The overview's capability map places each sheet there, and gaps in the map are
the topics still missing. Each capability holds one sheet; if a topic needs two, split the capability
in the map. The build fails on capabilities that aren't in the map.

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

## Security advisor

[`plugins/security-advisor`](plugins/security-advisor) is a Claude Code plugin that turns the sheets
into a security advisor: cited answers, read-only code review, CVE triage against the patching
sheet's deadlines and gap assessments. Anyone can install it from this repository:

```
/plugin install security-advisor --marketplace Devko/SecCheatSheet
```

It reads the published sheets through `index.json` at run time, so:

- **A new or updated sheet needs no change to the plugin.** It reaches users when `main` deploys.
  Add one realistic question for a new sheet to `test/advisor-routing.json`; `npm test` checks that
  search finds the right sheet for each question, and names new sheets that have none.
- **Changes to the plugin itself** (its skills, agent or server) need `version` raised in
  `plugins/security-advisor/.claude-plugin/plugin.json`. Users only receive plugin updates when it changes.
- **To try sheets before they're published**, build locally and point the plugin at the build:

  ```bash
  npm run build:html
  SECURITY_ADVISOR_SOURCE="$PWD/dist" claude --plugin-dir plugins/security-advisor
  ```

## Monthly review

The review workflow lives in [`.claude/skills/review-sheets/SKILL.md`](.claude/skills/review-sheets/SKILL.md).
In Claude Code, run `/review-sheets` in this repo to review every sheet that is due; a scheduled agent
can run the same skill every month. It re-checks every source, researches what changed since the
last review, edits the sheets, rebuilds, and opens a pull request. It never merges and never
publishes a draft.

## Hosting

`.github/workflows/site.yml` runs `npm run check` on every pull request and push. Pushes to `main`
also deploy `dist/` to GitHub Pages at https://devko.github.io/SecCheatSheet/. For a custom domain,
set it in the repository's Pages settings and update `baseUrl` in `site.config.json`, which is
printed on every PDF page.

The font (Atkinson Hyperlegible Next, SIL Open Font License) is self-hosted in `assets/fonts/`, so
the site makes no requests to third parties.
