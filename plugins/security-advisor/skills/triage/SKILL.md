---
name: triage
description: Triage one or more CVEs against the Security Cheat Sheets' patching deadlines - whether each is known exploited (CISA KEV), how likely exploitation is (EPSS), its severity from the CVE record, and the tier, contain-by and patch-by dates. Use when the user names a CVE or asks how fast to patch a specific vulnerability.
argument-hint: "<CVE-ID> [more CVE-IDs] [fix released YYYY-MM-DD]"
---

# Triage vulnerabilities

Input: $ARGUMENTS

1. **Look up each CVE** with `triage_vulnerability`. Pass `fix_released` if the user gave the date
   the fix or official workaround came out, or if the vendor advisory in the result states it.
   Without it you can give durations but not dates.
2. **Get what public data can't tell you.** The tier depends on where the affected product runs.
   Unless the conversation already says, ask in one message:
   - Is it reachable from the internet? VPNs, firewalls, gateways, mail and file-transfer systems
     count as exposed by default.
   - What depends on it? Identity systems, edge devices, backups and anything holding customer data
     move up one tier.
   - Who owns the fix?
   If the user can't say, assume the worse case and state that assumption.
3. **Pick the tier** by walking the sheet's triage steps in order and taking the first tier that
   matches. Use the CVE record's or vendor's severity, not a third-party score. Use EPSS only as the
   sheet says: to break ties among the remaining cases.
4. **Answer with a verdict first**, one block per CVE:
   - **Tier** and why, in one line (e.g. "Known exploited since 2024-04-12 (CISA KEV) and the
     firewall is internet-facing").
   - **Contain by** and **patch by**, as dates if you have the release date, otherwise durations.
     If a deadline has already passed, say so first.
   - **Owner**: the name the user gave, or a reminder that the sheet asks for one named owner.
   - **Facts**: KEV status and ransomware use, EPSS, severity and SSVC, each with its source.
   For several CVEs, put them in one table sorted by deadline, then the details.
5. **If the deadline looks hard to meet**, or the product is an edge device that was exploited, read
   the patching sheet with `get_sheet` and give its advice on containment, compensating controls,
   time-limited exceptions and checking for compromise. Check its reporting deadlines too if the user
   may be in scope.

Cite the patching sheet with its version and URL, and pass on its advisor note if it is a draft or
overdue. The deadlines are the sheet's recommendations, not legal requirements; say so if the user
treats them as rules, and point to any legal deadline the sheet lists.
