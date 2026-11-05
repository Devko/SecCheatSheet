# Security Advisor

A security advisor for Claude Code built on the [Security Cheat Sheets](https://devko.github.io/SecCheatSheet/):
short, opinionated guidance on what to do first and by when, with a cited source for every number and a
review date on every sheet.

It answers security questions, reviews code changes, triages CVEs against patch deadlines and assesses
security gaps. Every answer names the sheet, version and sources it relies on, and says when something
isn't covered by the sheets.

## Install

In Claude Code 2.1.275 or later:

```
/plugin install security-advisor --marketplace Devko/SecCheatSheet
```

Or in two steps:

```
/plugin marketplace add Devko/SecCheatSheet
/plugin install security-advisor@seccheatsheet
```

Requires Node.js 20 or later on your `PATH` for the advisor's tools. Node.js 22.21 or later is
needed behind an HTTPS proxy.

## Use

| Command | What it does |
| --- | --- |
| `/security-advisor:ask <question>` | Answers from the sheets: what to do, by when, what you can skip. Claude also uses it on its own for security questions. |
| `/security-advisor:review [base, PR number or files]` | Reviews the current branch, a pull request or files against the secure coding, development, supply chain, API, container, cloud and AI sheets. Reports findings and changes nothing. |
| `/security-advisor:triage <CVE-ID> [more]` | Checks CISA KEV, EPSS and the CVE record, asks where the system runs, and gives the tier and the contain-by and patch-by dates from the patching sheet. |
| `/security-advisor:assess [scope]` | Asks a few questions about your organization, then lists the gaps to close first, with the sheet behind each. |

Examples:

```
/security-advisor:ask Do we need phishing-resistant MFA for admins?
/security-advisor:review main
/security-advisor:triage CVE-2024-3400 on our internet-facing firewall
/security-advisor:assess NIS2 readiness for a 120-person manufacturer
```

## How it works

- **Live content.** The advisor reads the published sheets from the site's `index.json` each session,
  so new and updated sheets reach you without a plugin update. Each sheet comes with its review
  status, and the advisor tells you when a sheet is a draft or overdue for review.
- **Read-only reviews.** Code under review can contain text written to steer an AI reviewer. Reviews
  run in the `security-reviewer` agent, which can only read files and the sheets: no shell, no web
  access, no writes. Instructions planted in code can't make it run commands or send data anywhere,
  and the review reports them as findings. This follows the library's
  [AI agents sheet](https://devko.github.io/SecCheatSheet/agentic-ai/).
- **Fixed rules in code.** Fetching KEV, EPSS and CVE data and computing deadline dates is done by the
  tools, not the model. Matching a vulnerability to a tier needs your context, so the advisor asks.

### What leaves your machine

- Requests for the sheets go to `devko.github.io`.
- For triage only, the CVE ID goes to CISA (`cisa.gov`, the whole KEV catalog is downloaded), FIRST
  (`api.first.org`) and the CVE Program (`cveawg.mitre.org`).

Nothing else is sent by the plugin's tools. Your code and questions go only to Claude, as in any
Claude Code session.

## Use the tools elsewhere

The tools are a standard MCP server with no dependencies. To use them in another MCP client, such as
Claude Desktop, clone this repository and add:

```json
{
  "mcpServers": {
    "security-advisor": {
      "command": "node",
      "args": ["/path/to/SecCheatSheet/plugins/security-advisor/server/mcp.mjs"]
    }
  }
}
```

| Tool | Purpose |
| --- | --- |
| `list_sheets` | Every sheet by domain, with version, freshness and one-line answer |
| `get_sheet` | One sheet in full, or `brief: true` for the answer, top actions and advice by size |
| `search_sheets` | Full-text search across sheets, with the most relevant sheets first |
| `triage_vulnerability` | KEV, EPSS and CVE record facts plus the patching sheet's deadline tiers |

The same tools work from a terminal:

```bash
node server/cli.mjs list
node server/cli.mjs sheet patching --brief
node server/cli.mjs search "torch.load untrusted model"
node server/cli.mjs triage CVE-2024-3400 --fix-released 2024-04-14
```

Set `SECURITY_ADVISOR_SOURCE` (or `--source`) to another copy of the site, or to a local `dist/`
folder, to read sheets from there.

## Limits

The sheets are prioritized guidance, deliberately limited to the actions that matter most. The advisor
is not a vulnerability scanner, a compliance audit or legal advice. Use it alongside the scanners and
linters the sheets recommend, and check legal questions with a lawyer.
