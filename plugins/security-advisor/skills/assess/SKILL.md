---
name: assess
description: Security gap assessment of an organization, team or system against the Security Cheat Sheets. Asks a few questions, then returns the gaps to close first, each with a deadline or next step and the sheet behind it. Use when asked where to start with security, for a security roadmap or health check, or for readiness against a topic such as NIS2, ransomware or AI agents.
argument-hint: "[scope, e.g. 'whole company', 'NIS2 readiness', 'our AWS platform']"
---

# Assess security gaps

Scope: $ARGUMENTS (if empty, assume the whole organization and confirm it in the questions below).

1. **See what the library covers.** Call `list_sheets`. Its domains are the checklist for a
   whole-organization scope. For a narrow scope, pick only the domains and sheets that apply.
2. **Build a profile.** Ask once, in a single message (use a question tool if you have one), skipping
   anything the conversation already answers:
   - Size: small with no security staff, growing with IT or security staff, or enterprise or
     regulated. The sheets give different advice for each.
   - Sector and countries, to decide which laws apply (NIS2, DORA, the CRA, the AI Act, sector rules).
   - What they run: cloud providers, Microsoft 365 or Google Workspace, on-premises servers, OT,
     software they build, AI agents.
   - What is already in place, and any recent incident or worry.
3. **Read the sheets.** Call `get_sheet` with `brief: true` for each sheet in scope: it returns the
   answer, the five ranked actions and the advice by size. Read a sheet in full only when you need
   its steps, deadlines or legal timelines.
4. **Mark each ranked action** as done, partly done, missing or unknown, from the profile. Don't
   guess: if you don't know, mark it unknown.
5. **Prioritize across sheets.** The sheets rank actions within a topic; ranking across topics is
   your judgment, and you must say so. Put first what attackers use most and what can't be undone:
   exposed and exploited systems, admin and remote access, recoverable backups, then legal deadlines
   that already apply. Use the sheets' own deadlines wherever they give one.
6. **Report.**
   - **Start here**: at most ten actions, in order. For each: the action, why now (one line), a
     deadline or next step, and the sheet (topic, version, URL).
   - **By domain**: a short status per domain, with the remaining gaps.
   - **What you can skip**: the items from the sheets' "What you can skip" lists that apply here.
     This is often the most useful part for a small team.
   - **Unknowns**: the questions to answer next, and who in the organization could answer them.
   - **Legal clocks**: any reporting or compliance deadlines from the sheets that apply.
   - **Sheet freshness**: name any draft or overdue sheet you relied on.
   Mark anything not taken from a sheet as your own judgment.

Offer to save the report as a Markdown file for sharing. Don't change any systems or settings: this
is an assessment, not a remediation.

If the advisor tools aren't available, read the published library with
`curl -fsSL https://devko.github.io/SecCheatSheet/index.json` and fetch each sheet's Markdown from
the `markdown` path it lists, relative to that URL.
