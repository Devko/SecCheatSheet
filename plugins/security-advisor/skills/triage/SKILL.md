---
name: triage
description: Triage one or more CVEs - whether each is known exploited (CISA KEV), how likely exploitation is (EPSS), its severity, the patch and containment deadline from the Security Cheat Sheets, and the vendor-specific steps to fix it and check for compromise. Use when the user names a CVE or asks how fast to patch a specific vulnerability.
argument-hint: "<CVE-ID> [more CVE-IDs] [fix released YYYY-MM-DD]"
---

# Triage vulnerabilities

Input: $ARGUMENTS

1. **Look up each CVE** with `triage_vulnerability`. Pass `fix_released` if the user gave the date
   the fix or official workaround came out. The result has the KEV, EPSS and CVE record facts, and
   the deadline rules.
2. **Get the vendor specifics.** If you can fetch web pages, open the vendor advisory linked in the
   result. Take from it the fixed versions, any workaround or detection signature, and the vendor's
   tools or guidance for checking compromise, such as an integrity checker or indicators. If you
   can't fetch it, use what you know and say it needs checking against the advisory. Name any related
   CVEs that are exploited together with this one.
3. **Work out the deadline.** Take the first deadline rule that matches. Exposure matters: VPNs,
   firewalls, gateways, mail and file-transfer systems count as internet-facing. If the user hasn't
   said where it runs and it changes the answer, ask once; otherwise assume the worse case and say
   so. Use the vendor's or CNA's severity, and don't let a low EPSS score or moderate CVSS downgrade
   a vulnerability that is already exploited.
4. **Answer, verdict first.** For each CVE:
   - **Patch by** (and **contain by** where it applies) as dates if you know the fix release date,
     otherwise as durations. If a deadline has passed, say so first. Add one line on why.
   - **Do now**: the concrete steps in order, such as the fixed version to install, a mitigation
     until then, how to check for compromise and what to do if it is, and the credentials to rotate.
   - **Facts**: KEV status and date, ransomware use, EPSS, severity, in a few lines.
   For several CVEs, start with one table sorted by deadline.
   Don't explain how the deadline rules work or list the other tiers. The user needs their deadline.
5. **End with a Sources line**: the patching sheet as "Patching sheet v<n>" with its URL, the vendor
   advisory, and CISA KEV. If a deadline might be mistaken for a legal one, say in a few words that
   it's a recommendation. Name any legal reporting deadline that could apply.
