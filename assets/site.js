// Screen-only behaviour: freshness badges (computed at view time, so unrebuilt pages still age)
// and the "Copy as checklist" button.

import { freshnessStatus } from "./freshness.mjs";

const LABELS = { current: "Current", due: "Review due", overdue: "Past review date" };

for (const badge of document.querySelectorAll("[data-fresh]")) {
  const status = freshnessStatus(badge.dataset.reviewed, Number(badge.dataset.every));
  if (!(status in LABELS)) continue;
  badge.textContent = LABELS[status];
  badge.dataset.status = status;
  badge.hidden = false;
  if (status === "overdue") document.querySelector("[data-stale]")?.removeAttribute("hidden");
}

const status = document.querySelector(".rail__status");
for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(document.getElementById(button.dataset.copy).value);
      status.textContent = "Checklist copied. Paste it into a ticket or doc.";
    } catch {
      status.textContent = "Couldn't reach the clipboard. Use the Markdown download instead.";
    }
  });
}
