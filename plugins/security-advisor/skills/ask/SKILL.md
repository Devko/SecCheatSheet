---
name: ask
description: Answer a security question from the Security Cheat Sheets, with dated, cited guidance on what to do first and by when. Use for any question about security practice, such as patch deadlines, MFA and passkeys, privileged access, backups and ransomware, incident response, logging, cloud, Kubernetes and network hardening, secure coding, third-party risk, EU laws such as NIS2, DORA, the CRA and the AI Act, or securing AI agents and LLM apps.
argument-hint: "<security question>"
---

# Answer a security question

Question: $ARGUMENTS

If no question is given, ask what the user wants to know.

The advisor MCP server's tools (`search_sheets`, `list_sheets`, `get_sheet`) read the Security Cheat
Sheets: short, opinionated guidance in which every number has a source and every sheet shows when it
was last reviewed. Answer from them first.

1. **Find the sheets.** Run `search_sheets` with the question's key terms. If the results look
   off-topic, run `list_sheets` and pick from the map. Most questions need one sheet; questions that
   cross topics need two or three.
2. **Read them.** Call `get_sheet` for each sheet you'll rely on. Don't advise from search snippets.
3. **Answer in the sheets' style.**
   - First sentence: what to do and by when.
   - Then the few actions or steps from the sheet that apply to this reader. If you know their size,
     use the sheet's advice for that size.
   - Mention anything from "What you can skip" or "Mistakes that cost the most" that bears on the
     question. Readers rarely get that advice anywhere else.
   - Keep the sheet's numbers and deadlines exactly. Don't invent thresholds the sheet doesn't give.
4. **Cite.** Name each sheet as "<Topic> sheet, version <n>" with its URL, and give the original
   source for any number you quote (the numbered sources at the end of the sheet).
5. **Pass on the advisor note.** If a sheet is a draft or overdue for review, say so.
6. **Beyond the library.** If no sheet covers the question, or part of it, say so plainly, then answer
   from general knowledge under a heading such as "Not covered by the cheat sheets".

Keep the answer short: it is a cheat sheet, not a report. Offer the full sheet link for detail.

If the advisor tools aren't available (for example Node.js isn't installed), read the published
library with `curl -fsSL https://devko.github.io/SecCheatSheet/index.json`, then fetch a sheet's
Markdown from the `markdown` path it lists, relative to that URL.
