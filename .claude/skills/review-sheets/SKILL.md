---
name: review-sheets
description: Review and update the security cheat sheets in content/sheets. Re-checks every cited source and deadline, researches what changed since each sheet's last review, edits the sheet JSON, bumps version and changelog, rebuilds, and opens a pull request for a person to approve. Use when asked to review, refresh or update cheat sheets, and on the monthly review schedule.
---

# Review the cheat sheets

Every sheet is reviewed every `reviewEveryDays` days (30). Your job is to keep each sheet correct
and current, not to rewrite it. A person approves every change through a pull request: never merge
it yourself, never push to `main`, and never change a sheet's `status` or `capability`, or
`content/map.json`. If a topic seems to belong elsewhere in the map, say so in the pull request.

## 1. Pick the sheets

Review each `content/sheets/*.json` with `status` "draft" or "published" whose next review
(`lastReviewed` + `reviewEveryDays`) is today, has passed, or falls within the next 7 days.
If the request names sheets, review those instead. Skip "planned" sheets and files starting with `_`.

## 2. Check what each sheet already claims

For every entry in `sources`:

- Open the URL. Confirm it still resolves and still supports each sentence that cites it (`[^id]`).
- Look for anything that supersedes it: a revoked directive, a newer edition of a report, an amended
  regulation. Replace the source and the claim together.

For every number without a citation, confirm the sheet presents it as our recommendation.

## 3. Find what changed since `lastReviewed`

Search for developments on the sheet's topic since that date. Use primary sources: agencies and
regulators (CISA, ENISA, EUR-Lex, NIST, BSI, NCSC), standards bodies (FIRST, PCI SSC) and the
original reports (Mandiant M-Trends, Verizon DBIR, VulnCheck, Google Threat Intelligence). Treat
press coverage and vendor blogs as leads to a primary source, never as the source.

Change the sheet only when a development changes what a reader should do, or makes a stated fact
wrong. Interesting but non-actionable news stays out.

## 4. Edit the sheet

Follow the editorial rules in README.md: at most five ranked actions, keep "What you can skip",
every number cited, short sentences. Keep any "What changed" block to the last 12 months.

The PDF must stay at two pages. If you add text, cut something weaker.

In every reviewed sheet, even when nothing else changed:

- set `lastReviewed` to today (YYYY-MM-DD)
- raise `version` by 0.1 (0.1 becomes 0.2)
- add an entry at the top of `changes` saying what changed and why, or "Reviewed; no changes needed."

## 5. Build and check

Run `npm run build`. It fails on unknown citations and missing fields, and prints each PDF's page
count; fix any sheet over two pages. Then run `npm test`, which checks that the security advisor
plugin can still read every sheet and that its search still finds the right one for each question. If no Chrome or Edge is available the PDF step is skipped:
say so in the pull request.

## 6. Open a pull request

Use branch `review/YYYY-MM-DD` and one commit per sheet. In the description, for each sheet:

- what changed and why, with the source for each change
- the sources you checked that needed no change
- anything you could not verify from a primary source, or that needs a judgment call, such as
  changing a recommended deadline. Keep unverified facts out of the sheet and list them here.
