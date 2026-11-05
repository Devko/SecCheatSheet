# Security advisor eval

3 runs per case and condition, 4 cases, 12 judged comparisons. Conditions: base (no plugin), v2 (plugin at <scratch>/v2c/plugins/security-advisor), v2b (plugin at plugins/security-advisor).

| | base | v2 | v2b |
| --- | --- | --- | --- |
| Checks met | 83% | 94% | 94% |
| Checks met, ask | 83% | 94% | 94% |
| Factual errors | 8 | 0 | 1 |
| False positives (reviews) | 0 | 0 | 0 |
| Mean rank (1 = best) | 2.50 | 1.83 | 1.67 |
| Ranked first | 3 of 12 | 5 of 12 | 4 of 12 |
| Mean cost, ask | $0.10 | $0.20 | $0.21 |
| Mean time, ask | 21s | 28s | 29s |
| Mean words | 498 | 453 | 466 |
| Advisor used | 0 of 12 | 12 of 12 | 12 of 12 |
| Web calls | 0 | 0 | 0 |

Head to head (wins–losses by rank): base vs v2: 3–9; base vs v2b: 3–9; v2 vs v2b: 5–7.
Judge cost: $0.70.

## By case (checks met, mean rank)

| Case | base | v2 | v2b |
| --- | --- | --- | --- |
| Q1-patch-vpn | 80%, rank 3.0 | 100%, rank 1.7 | 100%, rank 1.3 |
| Q3-torch-load | 70%, rank 3.0 | 100%, rank 1.7 | 100%, rank 1.3 |
| Q4-ai-agents | 97%, rank 1.0 | 78%, rank 3.0 | 83%, rank 2.0 |
| Q6-password-rotation | 83%, rank 3.0 | 100%, rank 1.0 | 93%, rank 2.0 |

## Judge notes

### Q1-patch-vpn, run 1: v2b > v2 > base
A and C both set a concrete 24h containment and 72h patch deadline and cite verifiable sources. A gives fuller compromise handling, including collecting evidence before rebooting and rebuilding without restoring a compromised config. B is correct and actionable but names no specific sources and omits the new 3-day tier for the highest-risk cases.

### Q1-patch-vpn, run 2: v2b > v2 > base
A and C are both correct, current and well sourced. A ranks first because it also covers capturing evidence before patching and rebuilding the device if it was compromised. B is actionable but cites outdated CISA KEV deadlines as current and gives no verifiable sources.
- base errors: Says the CISA KEV catalog 'normally gives US federal agencies about 2–3 weeks'. That reflects BOD 22-01, which BOD 26-04 replaced in June 2026; the new directive sets 3 days for the highest-risk cases and 14 days for other known-exploited flaws.

### Q1-patch-vpn, run 3: v2 > v2b > base
C and A are both correct, current and sourced, but C is more actionable: it says to save evidence before patching, confirm the running version and not trust a clean integrity check. B gives sound, fast guidance but cites no verifiable sources and never mentions CISA's new 3-day tier for the highest-risk known-exploited flaws.

### Q3-torch-load, run 1: v2b > v2 > base
A and B are both correct and current, naming the 2.10.0 fix and safetensors. B edges ahead with more concrete safeguards (separate isolation step, trust_remote_code pinned to a revision) and a clear bottom line. C misses the 2026 advisory and wrongly treats PyTorch 2.6+ as sufficient.
- base errors: Recommends PyTorch >= 2.6 as the patched baseline. This is outdated: GHSA-63cw-57p8-fm3p (Jan 2026) showed a weights_only=True code-execution bypass in all versions before 2.10.0. | Omits the 2026 bypass and implies weights_only=True on 2.6+ blocks pickle code execution, which is incorrect for 2.6 through 2.9.

### Q3-torch-load, run 2: v2b > v2 > base
C and A are both correct and current, naming the 2026 advisory and requiring 2.10.0. C ranks first because it adds practical points: libraries calling torch.load without the flag, and use_safetensors=True. B is thorough but sets the version floor at 2.6, which leaves users exposed to the 2026 bypass.
- base errors: Recommends PyTorch ≥ 2.6 as the safe minimum and calls weights_only=True on a 'current' PyTorch a reasonable safeguard. This is outdated: the January 2026 advisory GHSA-63cw-57p8-fm3p shows weights_only=True could still execute code in versions before 2.10.0.

### Q3-torch-load, run 3: v2 > v2b > base
A and B are both correct and cite the 2026 advisory with the 2.10.0 fix and practical safeguards; A is slightly more concise. C misses the 2026 bypass and wrongly treats PyTorch ≥ 2.6 as safe, and its 'mostly yes' opening undercuts the warning.
- base errors: Recommends PyTorch ≥ 2.6 as sufficient for torch.load with weights_only=True, which is outdated: GHSA-63cw-57p8-fm3p (Jan 2026) shows versions before 2.10.0 remain vulnerable to code execution | Says weights_only=True on a current PyTorch shuts down the classic malicious-.pt attack, citing only the CVE fixed in 2.6.0 and missing the 2026 bypass

### Q4-ai-agents, run 1: base > v2b > v2
A meets every check with no errors and is concise. It also explains why prompt injection makes limiting the agent's reach the main defense. C is the most tool-specific and actionable, but it misattributes a Claude Code setting to Copilot and recommends general outbound network restriction only weakly; B never explains prompt injection and does not give agents their own identities.
- v2b errors: Says to set `disableBypassPermissionsMode` in Copilot enterprise managed settings. That is a Claude Code setting key, not a Copilot policy.

### Q4-ai-agents, run 2: base > v2b > v2
A meets every check: it gives agents their own identities, sandboxes them, restricts egress and builds everything on limiting what a prompt-injected agent can do. B and C have no clear errors and give useful tool-specific settings, but they only restrict network access for VS Code. B is more concise and gives agents their own identity, which C skips.

### Q4-ai-agents, run 3: base > v2b > v2
B covers every check with no errors: separate agent identities, isolation, egress allowlisting and a clear explanation of prompt injection. C is concise and gives agents their own identities, but treats logging and injection only briefly; A substitutes scoped developer tokens for real agent identities.

### Q6-password-rotation, run 1: v2 > v2b > base
C is correct and the most concise, with concrete admin steps, breached-password screening and an accurate PCI DSS 8.3.9 caveat. A is equally correct but longer, and it hedges on facts that are in fact correct. B gives broad, good advice but misdates NIST Rev. 4 as 2024 and is the most verbose.
- base errors: Dates NIST SP 800-63B Rev. 4 to 2024. The final version was published in July/August 2025; 2024 was only a draft.

### Q6-password-rotation, run 2: v2 > v2b > base
All three are correct and match NIST SP 800-63B-4 and PCI DSS 8.3.9. C ranks first because it gives concrete Entra and AD steps to turn off expiry and stays concise. A is equally accurate but less hands-on, and B is correct but longer and less focused.

### Q6-password-rotation, run 3: v2 > v2b > base
A and B are equally correct and current, with NIST rev 4, PCI DSS 8.3.9 scoped correctly, and concrete replacement controls. B ranks first because it is tighter and turns the Entra and AD steps into its action list. C is the most verbose and wrongly makes dropping rotation depend on having MFA first, which contradicts NIST.
- base errors: Claims removing expiration without MFA leaves you 'worse off than before' and makes dropping rotation conditional on MFA. That conflicts with NIST SP 800-63B-4, which prohibits periodic rotation regardless and treats rotation as having little security value.
